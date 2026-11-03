import "server-only";
import {
  btoCandidates,
  privateCandidates,
  marketRankingInput,
  scoreMarketCandidate,
} from "@/domain/marketRecommendations";
import { confirmedProfileSchema } from "@/domain/preferences";
import {
  monthWindow,
  rankAreas,
  type Discovery,
  type AreaResult,
} from "@/domain/recommendations";
import { routeDeparture } from "@/domain/exploration";
import { MarketPriceAdapter } from "../adapters/MarketPriceAdapter";
import { DataGovAdapter } from "../adapters/DataGovAdapter";
import { OneMapRoutingAdapter } from "../adapters/OneMapRoutingAdapter";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { adminClient, requireSession } from "../supabase";
import { acquireOperation } from "../operationLimits";
import { AppError } from "../http";

const running = new Set<string>();
export class MarketRecommendationController {
  async create(input: unknown): Promise<Discovery> {
    const query = marketRankingInput.parse(input);
    const { client, user } = await requireSession();
    const profile = await new ProfileRepository(client, user.id).get(
      query.profileId,
    );
    if (!profile.confirmed || profile.revision !== query.revision)
      throw new AppError(
        "PROFILE_NOT_CONFIRMED",
        "Confirm and save the current profile before ranking.",
        409,
      );
    const preference = confirmedProfileSchema.parse(profile.preference);
    if (preference.category === "Resale HDB")
      throw new AppError(
        "CATEGORY_NOT_SUPPORTED",
        "Use the resale HDB search for this profile.",
        422,
      );
    if (running.has(user.id))
      throw new AppError(
        "DISCOVERY_BUSY",
        "Wait for your current search before retrying.",
        429,
        true,
        15,
      );
    running.add(user.id);
    let release: (() => Promise<void>) | undefined;
    try {
      release = await acquireOperation("discovery", user.id);
      const now = new Date(),
        snapshot = await new DataGovAdapter().snapshot();
      if (Date.now() - Date.parse(snapshot.fetchedAt) > 30 * 86400000)
        throw new AppError(
          "DATASET_STALE",
          "Refresh the amenity snapshot before ranking.",
          503,
          true,
        );
      for (const p of preference.lifestyles) {
        const source = snapshot.facilitySources.find(
          (s) => s.category === p.category,
        );
        if (
          !snapshot.supportedFacilities.includes(p.category) ||
          !source ||
          Date.now() - Date.parse(source.updatedAt) >
            (source.maxAgeDays ?? 30) * 86400000
        )
          throw new AppError(
            "AMENITY_DATA_STALE",
            `Verified ${p.category} evidence needs refreshing before ranking.`,
            503,
            true,
          );
      }
      const adapter = new MarketPriceAdapter();
      const market =
        preference.category === "BTO" ? adapter.bto() : await adapter.private();
      if (
        market.kind === "private" &&
        (Date.parse(market.fetchedAt) > now.getTime() + 60000 ||
          now.getTime() - Date.parse(market.fetchedAt) > 7 * 86400000 ||
          market.latestMonth < monthWindow(now, 2).fromMonth)
      )
        throw new AppError(
          "PRIVATE_DATA_STALE",
          "Refresh the URA transaction snapshot before ranking private areas.",
          503,
          true,
        );
      const window = monthWindow(now, preference.lookbackMonths);
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Singapore",
      }).format(now);
      const { candidates, excluded } =
        market.kind === "bto"
          ? btoCandidates(
              market,
              snapshot.areas,
              preference,
              query.filters,
              today,
            )
          : privateCandidates(market, preference, query.filters, window);
      const departure = routeDeparture(now),
        results: AreaResult[] = [];
      const router = new OneMapRoutingAdapter(),
        cancellation = new AbortController();
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
              const candidate = candidates[cursor++],
                routes = [];
              for (const destination of preference.destinations)
                routes.push(
                  await router.route(
                    candidate.area,
                    destination,
                    departure,
                    cancellation.signal,
                  ),
                );
              results.push(
                scoreMarketCandidate(
                  candidate,
                  preference,
                  query.filters,
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
      const verified = await requireSession(false);
      if (verified.user.id !== user.id)
        throw new AppError(
          "SIGN_IN_REQUIRED",
          "Sign in again to complete your search.",
          401,
        );
      const current = await new ProfileRepository(verified.client, user.id).get(
        profile.id,
      );
      if (!current.confirmed || current.revision !== query.revision)
        throw new AppError(
          "PROFILE_NOT_CONFIRMED",
          "Your profile changed during this search. Reload it before ranking again.",
          409,
        );
      const discovery: Discovery = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        formulaVersion:
          market.kind === "bto" ? "bto-launch-area-v1" : "private-district-v1",
        snapshotId: `${market.id}:${snapshot.id}`,
        profileId: profile.id,
        profileRevision: profile.revision,
        preference,
        ...window,
        sourceUrl: market.sourceUrl,
        fetchedAt:
          market.kind === "private"
            ? market.fetchedAt
            : `${market.publishedOn}T00:00:00.000Z`,
        latestMonth:
          market.kind === "private" ? market.latestMonth : market.launch,
        facilitySources: snapshot.facilitySources,
        departure,
        results: rankAreas(results),
        excluded,
        market: {
          kind: market.kind,
          filters: query.filters,
          coverage:
            market.kind === "bto"
              ? "Published 99-year-lease indicative ranges before grants, not available units. Two-room Flexi sizes are combined; 3Gen/short leases are excluded. Town MRT proxies are used, not project entrances. Closed launches included in simulation remain closed for application. Budget score measures range coverage, not a probability or share of flats."
              : `URA single-unit sales grouped by postal district, not individual listings. Apartment/Condominium and landed categories are separate; Executive Condominiums are excluded. HDB room types are not private bedroom counts and are not used. Unknown coordinates excluded: ${market.skippedCoordinates}; multi-unit transactions excluded: ${market.skippedMultiUnit}. Origins are means of matching project locations. Historical prices are not asking prices or valuations.`,
        },
      };
      const { error } = await adminClient()
        .from("discoveries")
        .insert({
          id: discovery.id,
          user_id: user.id,
          profile_id: profile.id,
          payload: discovery,
        });
      if (error)
        throw new AppError(
          "DISCOVERY_SAVE_FAILED",
          "Your ranking could not be stored. Please retry.",
          503,
          true,
        );
      return discovery;
    } finally {
      running.delete(user.id);
      await release?.();
    }
  }
}
