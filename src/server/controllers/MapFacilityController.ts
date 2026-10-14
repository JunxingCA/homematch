import "server-only";
import { facilitiesNear, mapFacilityQuery } from "@/domain/mapFacilities";
import { RecommendationController } from "./RecommendationController";
import { DataGovAdapter } from "../adapters/DataGovAdapter";
import { AppError } from "../http";

export class MapFacilityController {
  async get(discoveryId: string, input: unknown) {
    const query = mapFacilityQuery.parse(input);
    const discovery = await new RecommendationController().get(discoveryId);
    const result = discovery.results.find((r) => r.area.id === query.areaId);
    if (!result)
      throw new AppError("NOT_FOUND", "Area not found in this search.", 404);
    // Latest public facilities are for exploration only; saved scores are never updated.
    const snapshot = await new DataGovAdapter().snapshot();
    if (Date.now() - Date.parse(snapshot.fetchedAt) > 30 * 86400000)
      throw new AppError(
        "DATASET_STALE",
        "The amenity map needs a data refresh. Saved score evidence is unchanged.",
        503,
        true,
      );
    return facilitiesNear(snapshot, result.area, query.radius);
  }
}
