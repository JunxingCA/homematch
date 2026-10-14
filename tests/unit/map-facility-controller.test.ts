import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn(), snapshot: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/controllers/RecommendationController", () => ({
  RecommendationController: class {
    get = mocks.get;
  },
}));
vi.mock("@/server/adapters/DataGovAdapter", () => ({
  DataGovAdapter: class {
    snapshot = mocks.snapshot;
  },
}));
import { MapFacilityController } from "@/server/controllers/MapFacilityController";
const discoveryId = "22222222-2222-4222-8222-222222222222";
const area = {
  id: "bedok",
  name: "BEDOK",
  originLabel: "Bedok MRT",
  latitude: 1.3,
  longitude: 103.8,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({
    results: [{ area, overall: 80 }],
    preference: { lifestyles: [] },
  });
  mocks.snapshot.mockResolvedValue({
    id: "map-only",
    fetchedAt: new Date().toISOString(),
    supportedFacilities: ["Gym"],
    facilitySources: [{ category: "Gym", updatedAt: new Date().toISOString() }],
    facilities: [{ ...area, name: "Gym venue", category: "Gym" }],
  });
});
it("loads public amenities only after the saved discovery is authorised", async () => {
  mocks.get.mockRejectedValue(Error("Not owned / session expired"));
  await expect(
    new MapFacilityController().get(discoveryId, { areaId: "bedok" }),
  ).rejects.toThrow("Not owned");
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it("rejects an area outside the owned discovery and stale snapshots", async () => {
  await expect(
    new MapFacilityController().get(discoveryId, { areaId: "forged" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.snapshot).not.toHaveBeenCalled();
  mocks.snapshot.mockResolvedValue({ fetchedAt: "2020-01-01T00:00:00Z" });
  await expect(
    new MapFacilityController().get(discoveryId, { areaId: "bedok" }),
  ).rejects.toMatchObject({ code: "DATASET_STALE" });
});
it("uses the trusted origin and current dataset without recomputing or persisting any score", async () => {
  const result = await new MapFacilityController().get(discoveryId, {
    areaId: "bedok",
    radius: "1000",
  });
  expect(result.origin).toEqual(area);
  expect(result.layers.find((l) => l.category === "Gym")?.count).toBe(1);
  expect(result).not.toHaveProperty("overall");
  expect(mocks.get).toHaveBeenCalledWith(discoveryId);
});
