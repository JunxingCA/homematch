import "server-only";
import { z } from "zod";
import { confirmedProfileSchema } from "@/domain/preferences";
import {
  FORMULA_VERSION,
  monthWindow,
  pricesFor,
  rankAreas,
  scoreArea,
  type AreaResult,
  type Discovery,
} from "@/domain/recommendations";
import { DataGovAdapter } from "../adapters/DataGovAdapter";
import { OneMapRoutingAdapter } from "../adapters/OneMapRoutingAdapter";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { adminClient, requireSession } from "../supabase";
import { AppError } from "../http";
import { acquireOperation } from "../operationLimits";

const running = new Set<string>();
const lastRequest = new Map<string, number>();

export class RecommendationController {
  async create(input: unknown): Promise<Discovery> {
    const { profileId, revision } = z
      .object({ profileId: z.uuid(), revision: z.number().int().positive() })
      .strict()
      .parse(input);
    const { client, user } = await requireSession();
    const profile = await new ProfileRepository(client, user.id).get(profileId);
    if (!profile.confirmed || profile.revision !== revision)
      throw new AppError(
        "PROFILE_NOT_CONFIRMED",
        "Confirm and save the current profile before finding areas.",
        409,
      );
    const preference = confirmedProfileSchema.parse(profile.preference);
    if (preference.category !== "Resale HDB")
      throw new AppError(
        "CATEGORY_NOT_SUPPORTED",
        "Area ranking currently supports Resale HDB. BTO and private housing need separate price evidence.",
        422,
      );
    if (running.has(user.id))
      throw new AppError(
        "DISCOVERY_BUSY",
        "Your previous search is still running. Check recent searches after it finishes, or wait before trying again.",
        429,
        true,
        15,
      );
    const cooldown = Math.ceil(
      (15000 - (Date.now() - (lastRequest.get(user.id) ?? 0))) / 1000,
    );
    if (cooldown > 0)
      throw new AppError(
        "DISCOVERY_BUSY",
        `Please wait ${cooldown} seconds before starting another search.`,
        429,
        true,
        cooldown,
      );
    let release: (() => Promise<void>) | undefined;
    if (lastRequest.size > 1000) lastRequest.clear();
    running.add(user.id);
    lastRequest.set(user.id, Date.now());
    try {
      release = await acquireOperation("discovery", user.id);
      const snapshot = await new DataGovAdapter().snapshot();
      if (Date.now() - Date.parse(snapshot.fetchedAt) > 30 * 86400000)
        throw new AppError(
          "DATASET_STALE",
          "The research snapshot is over 30 days old. Refresh the dataset before ranking areas.",
          503,
          true,
        );
      const unsupported = preference.lifestyles.filter(
        (p) => !snapshot.supportedFacilities.includes(p.category),
      );
      if (unsupported.length)
        throw new AppError(
          "AMENITY_NOT_SUPPORTED",
          `Verified facility data is not connected for ${unsupported.map((p) => p.category).join(", ")}. This search supports ${snapshot.supportedFacilities.join(", ")}. Update and confirm your profile to continue.`,
          422,
        );
      for (const source of snapshot.facilitySources.filter((s) =>
        preference.lifestyles.some((p) => p.category === s.category),
      )) {
        if (
          Date.now() - Date.parse(source.updatedAt) >
          (source.maxAgeDays ?? 30) * 86400000
        )
          throw new AppError(
            "AMENITY_DATA_STALE",
            `${source.category} source data is too old to publish a new ranking. Refresh its layer and retry.`,
            503,
            true,
          );
      }
      const now = new Date();
      if (snapshot.latestMonth < monthWindow(now, 2).fromMonth)
        throw new AppError(
          "PRICE_DATA_STALE",
          "The latest published HDB transaction month is more than two months behind this search. Refresh the dataset and retry.",
          503,
          true,
        );
      const window = monthWindow(now, preference.lookbackMonths);
      // Tomorrow 08:00 Singapore time; both the date and assumption are frozen in results.
      const departure =
        new Date(now.getTime() + 86400000 + 8 * 3600000)
          .toISOString()
          .slice(0, 10) + "T08:00:00+08:00";
      const excluded: Discovery["excluded"] = [];
      const candidates = snapshot.areas
        .map((area) => ({
          area,
          prices: pricesFor(snapshot, area, preference, window),
        }))
        .filter(({ area, prices }) => {
          if (prices.length >= 5) return true;
          excluded.push({
            area: area.name,
            reason: `Only ${prices.length} matching transactions; at least 5 are required.`,
          });
          return false;
        });
      const results: AreaResult[] = [];
      const router = new OneMapRoutingAdapter();
      const cancellation = new AbortController();
      const deadline = setTimeout(() => cancellation.abort(), 150000);
      let cursor = 0;
      try {
        await Promise.all(
          Array.from({ length: Math.min(3, candidates.length) }, async () => {
            while (cursor < candidates.length) {
              if (cancellation.signal.aborted)
                throw new AppError(
                  "DISCOVERY_TIMEOUT",
                  "The area search took too long. Please retry.",
                  503,
                  true,
                );
              const { area, prices } = candidates[cursor++];
              const routes = [];
              for (const destination of preference.destinations)
                routes.push(
                  await router.route(
                    area,
                    destination,
                    departure,
                    cancellation.signal,
                  ),
                );
              results.push(
                scoreArea(
                  area,
                  preference,
                  prices,
                  routes,
                  snapshot.facilities,
                ),
              );
            }
          }),
        );
      } catch (error) {
        cancellation.abort();
        throw error;
      } finally {
        clearTimeout(deadline);
      }
      const discovery: Discovery = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        formulaVersion: FORMULA_VERSION,
        snapshotId: snapshot.id,
        profileId,
        profileRevision: profile.revision,
        preference,
        ...window,
        sourceUrl: snapshot.sourceUrl,
        fetchedAt: snapshot.fetchedAt,
        latestMonth: snapshot.latestMonth,
        facilitySources: snapshot.facilitySources,
        departure,
        results: rankAreas(results),
        excluded,
      };
      const verified = await requireSession(false);
      if (verified.user.id !== user.id)
        throw new AppError(
          "SIGN_IN_REQUIRED",
          "Sign in again to complete your search.",
          401,
        );
      const current = await new ProfileRepository(verified.client, user.id).get(
        profileId,
      );
      if (!current.confirmed || current.revision !== revision)
        throw new AppError(
          "PROFILE_NOT_CONFIRMED",
          "This profile changed during the search. Reload and confirm it before searching again.",
          409,
        );
      const { error } = await adminClient().from("discoveries").insert({
        id: discovery.id,
        user_id: user.id,
        profile_id: profileId,
        payload: discovery,
      });
      if (error)
        throw new AppError(
          "DISCOVERY_SAVE_FAILED",
          "Your results could not be stored. Please retry.",
          503,
          true,
        );
      return discovery;
    } finally {
      running.delete(user.id);
      await release?.();
    }
  }
  async list() {
    const { client } = await requireSession();
    const { data, error } = await client.rpc("recent_discoveries");
    if (error)
      throw new AppError(
        "DISCOVERY_LOAD_FAILED",
        "Saved results are unavailable. Please retry.",
        503,
        true,
      );
    return (data ?? []).map(
      (row: { id: string; created_at: string; profile_name: string }) => ({
        id: row.id,
        createdAt: row.created_at,
        profileName: row.profile_name,
      }),
    );
  }
  async clearHistory(input: unknown) {
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(input);
    const { client } = await requireSession();
    const { error } = await client.rpc("clear_discovery_history");
    if (error)
      throw new AppError(
        "HISTORY_CLEAR_FAILED",
        "Recent searches could not be cleared. Please retry.",
        503,
        true,
      );
    return { cleared: true };
  }
  async get(id: string): Promise<Discovery> {
    const { client, user } = await requireSession();
    const { data, error } = await client
      .from("discoveries")
      .select("payload")
      .eq("id", z.uuid().parse(id))
      .eq("user_id", user.id)
      .maybeSingle();
    if (error)
      throw new AppError(
        "DISCOVERY_LOAD_FAILED",
        "Saved results are unavailable. Please retry.",
        503,
        true,
      );
    if (!data) throw new AppError("NOT_FOUND", "Area search not found.", 404);
    return data.payload as Discovery;
  }
}
