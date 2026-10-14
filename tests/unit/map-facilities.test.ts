import { expect, it } from "vitest";
import {
  facilitiesNear,
  mapFacilityQuery,
  mapFacilitiesSchema,
} from "@/domain/mapFacilities";
import { lifestyleCategories } from "@/domain/preferences";
import type { ResearchSnapshot } from "@/domain/recommendations";
const origin = {
  id: "bedok",
  name: "BEDOK",
  originLabel: "Bedok MRT",
  latitude: 1.3,
  longitude: 103.8,
};
const snapshot = {
  id: "public-snapshot",
  fetchedAt: "2026-10-13T00:00:00Z",
  supportedFacilities: [...lifestyleCategories],
  facilitySources: lifestyleCategories.map((category) => ({
    category,
    theme: "test",
    updatedAt: "2026-10-13T00:00:00Z",
  })),
  facilities: lifestyleCategories.map((category) => ({
    name: `${category} venue`,
    category,
    latitude: 1.301,
    longitude: 103.8,
  })),
} as ResearchSnapshot;
it("browses all categories independently of saved lifestyle preferences, within a geographic radius", () => {
  const data = facilitiesNear(snapshot, origin, 1000);
  expect(data.layers.find((l) => l.category === "Gym")?.count).toBe(1);
  expect(data.layers).toHaveLength(13);
  expect(
    facilitiesNear(snapshot, origin, 100).layers.every((l) => l.count === 0),
  ).toBe(true);
  expect(mapFacilitiesSchema.safeParse(data).success).toBe(true);
});
it("distinguishes an unavailable category from zero nearby points", () => {
  const data = facilitiesNear(
    { ...snapshot, supportedFacilities: ["Parks"] },
    origin,
    100,
  );
  expect(data.layers.find((l) => l.category === "Gym")).toMatchObject({
    available: false,
    count: 0,
    facilities: [],
  });
  expect(data.layers.find((l) => l.category === "Parks")).toMatchObject({
    available: true,
    count: 0,
  });
});
it("limits rendered points per category without misstating the total", () => {
  const data = facilitiesNear(
    {
      ...snapshot,
      facilities: Array.from({ length: 150 }, (_, i) => ({
        ...origin,
        name: `Park ${i}`,
        category: "Parks",
      })),
    },
    origin,
    1000,
  );
  expect(data.layers.find((l) => l.category === "Parks")).toMatchObject({
    count: 150,
    truncated: true,
  });
  expect(
    data.layers.find((l) => l.category === "Parks")?.facilities,
  ).toHaveLength(100);
});
it("rejects forged coordinates, oversized radii and unknown query parameters", () => {
  for (const query of [
    { areaId: "bedok", radius: 0 },
    { areaId: "bedok", radius: 5001 },
    { areaId: "bedok", latitude: 1.3 },
  ])
    expect(mapFacilityQuery.safeParse(query).success).toBe(false);
  expect(mapFacilityQuery.parse({ areaId: "bedok" }).radius).toBe(1000);
});
