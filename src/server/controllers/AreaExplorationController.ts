import "server-only";
import {
  explorationInput,
  routeDeparture,
  type ExplorationDetails,
} from "@/domain/exploration";
import { facilitiesNear } from "@/domain/mapFacilities";
import { confirmedProfileSchema } from "@/domain/preferences";
import { AppError } from "../http";
import { requireSession } from "../supabase";
import { DataGovAdapter } from "../adapters/DataGovAdapter";
import { OneMapRoutingAdapter } from "../adapters/OneMapRoutingAdapter";
import { ProfileRepository } from "../repositories/ProfileRepository";
import { acquireOperation } from "../operationLimits";

const routing = new Set<string>();

async function freshSnapshot() {
  const snapshot = await new DataGovAdapter().snapshot();
  if (Date.now() - Date.parse(snapshot.fetchedAt) > 30 * 86400000)
    throw new AppError(
      "DATASET_STALE",
      "The area explorer needs a dataset refresh. Your saved preferences are unchanged.",
      503,
      true,
    );
  return snapshot;
}
export class AreaExplorationController {
  async catalogue() {
    await requireSession();
    const snapshot = await freshSnapshot();
    return {
      snapshotId: snapshot.id,
      fetchedAt: snapshot.fetchedAt,
      areas: snapshot.areas.toSorted((a, b) => a.name.localeCompare(b.name)),
    };
  }
  async details(input: unknown): Promise<ExplorationDetails> {
    const query = explorationInput.parse(input);
    const { client, user } = await requireSession();
    const repository = new ProfileRepository(client, user.id);
    const profile = await repository.get(query.profileId);
    if (!profile.confirmed || profile.revision !== query.revision)
      throw new AppError(
        "PROFILE_NOT_CONFIRMED",
        "Reload and confirm the current profile before exploring areas.",
        409,
      );
    const preference = confirmedProfileSchema.parse(profile.preference);
    if (preference.category === "Resale HDB")
      throw new AppError(
        "CATEGORY_NOT_SUPPORTED",
        "Use the Resale HDB recommendation search for this profile.",
        422,
      );
    const snapshot = await freshSnapshot();
    const area = snapshot.areas.find((a) => a.id === query.areaId);
    if (!area)
      throw new AppError(
        "NOT_FOUND",
        "This area is not in the imported catalogue.",
        404,
      );
    const result: ExplorationDetails = {
      profileId: profile.id,
      profileRevision: profile.revision,
      category: preference.category,
      facilities: facilitiesNear(snapshot, area, query.radius),
      journeys: null,
    };
    if (query.includeRoutes) {
      if (routing.has(user.id))
        throw new AppError(
          "EXPLORATION_BUSY",
          "Wait for your current journey request before retrying.",
          429,
          true,
          15,
        );
      let release: (() => Promise<void>) | undefined;
      routing.add(user.id);
      try {
        release = await acquireOperation("journeys", user.id);
        const signal = AbortSignal.timeout(65000);
        const departure = routeDeparture(new Date());
        const adapter = new OneMapRoutingAdapter();
        const routes = [];
        for (const destination of preference.destinations)
          routes.push(
            await adapter.route(area, destination, departure, signal),
          );
        result.journeys = {
          departure,
          fetchedAt: new Date().toISOString(),
          routes,
        };
      } finally {
        routing.delete(user.id);
        await release?.();
      }
    }
    // Do not return private journeys after expiry, account switch or profile revision changes.
    const current = await requireSession(false);
    if (current.user.id !== user.id)
      throw new AppError(
        "SIGN_IN_REQUIRED",
        "Sign in again to view this exploration.",
        401,
      );
    const latest = await new ProfileRepository(current.client, user.id).get(
      query.profileId,
    );
    if (!latest.confirmed || latest.revision !== query.revision)
      throw new AppError(
        "PROFILE_NOT_CONFIRMED",
        "This profile changed while loading. Reload it before exploring again.",
        409,
      );
    return result;
  }
}
