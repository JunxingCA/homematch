import { describe, expect, it } from "vitest";
import { samplePreference } from "@/domain/fixtures";
import {
  geographicMetres,
  monthWindow,
  quantile,
  rankAreas,
  scoreArea,
  pricesFor,
  type RouteEvidence,
  type ResearchSnapshot,
  facilitySchema,
} from "@/domain/recommendations";
import { lifestyleCategories } from "@/domain/preferences";
const preference = () => ({
  ...structuredClone(samplePreference),
  lifestyles: [{ category: "Parks" as const, priority: 3, radius: 800 }],
});
const area = {
  id: "a",
  name: "A",
  originLabel: "A MRT",
  latitude: 1.3,
  longitude: 103.8,
};
const route: RouteEvidence = {
  destination: samplePreference.destinations[0].location!.label,
  visits: 5,
  mode: "public",
  minutes: 45,
  metres: 10000,
  geometry: [],
};
describe("provisional deterministic area scores", () => {
  it("rejects an empty quantile sample and orders equidistant facilities by name", () => {
    expect(() => quantile([], 0.5)).toThrow("Empty price sample");
    const result = scoreArea(
      area,
      preference(),
      [1, 2, 3, 4, 5],
      [route],
      [
        { ...area, name: "Z park", category: "Parks" },
        { ...area, name: "A park", category: "Parks" },
      ],
    );
    expect(result.amenities[0].facilities.map((f) => f.name)).toEqual([
      "A park",
      "Z park",
    ]);
  });
  it.each([
    { destination: "Other destination" },
    { mode: "private" as const },
    { visits: 7 },
    { minutes: -1 },
    { metres: NaN },
    { metres: -1 },
  ])("rejects mismatched or invalid route evidence %j", (change) => {
    expect(() =>
      scoreArea(
        area,
        preference(),
        [1, 2, 3, 4, 5],
        [{ ...route, ...change }],
        [],
      ),
    ).toThrow("Incomplete routing evidence");
  });
  it.each(lifestyleCategories)(
    "validates and scores %s without mixing categories",
    (category) => {
      const facility = facilitySchema.parse({
        ...area,
        name: "Known facility",
        category,
      });
      const p = {
        ...preference(),
        lifestyles: [{ category, radius: 800, priority: 3 }],
      };
      const r = scoreArea(area, p, [1, 2, 3, 4, 5], [route], [facility]);
      expect(r.lifestyleScore).toBe(100);
      expect(r.amenities[0].category).toBe(category);
      expect(r.amenities[0].count).toBe(1);
    },
  );
  it("uses all prices and inclusive budget bounds with interpolated quartiles", () => {
    const r = scoreArea(
      area,
      preference(),
      [300000, 400000, 500000, 750000, 1000000],
      [route],
      [{ ...area, name: "Park", category: "Parks" }],
    );
    expect(r.destinationScore).toBe(50);
    expect(r.lifestyleScore).toBe(100);
    expect(r.affordabilityScore).toBe(60);
    expect(r.overall).toBe(68);
    expect(r.median).toBe(500000);
    expect(r.p25).toBe(400000);
    expect(r.p75).toBe(750000);
  });
  it("weights journeys by weekly visits", () => {
    const p = preference();
    p.destinations.push({ ...p.destinations[0], visits: 1 });
    const r = scoreArea(
      area,
      p,
      [1, 2, 3, 4, 5],
      [route, { ...route, visits: 1, minutes: 15 }],
      [],
    );
    expect(r.weightedMinutes).toBe(40);
    expect(r.lifestyleScore).toBe(0);
  });
  it("handles an inactive lifestyle component", () => {
    const p = preference();
    p.lifestyles = [];
    p.weights = { destination: 50, lifestyle: 0, affordability: 50 };
    expect(
      scoreArea(area, p, [1, 2, 3, 4, 5], [route], []).lifestyleScore,
    ).toBeNull();
  });
  it("rejects insufficient or missing route evidence", () => {
    expect(() =>
      scoreArea(area, preference(), [1, 2, 3, 4], [route], []),
    ).toThrow("Insufficient");
    expect(() =>
      scoreArea(area, preference(), [1, 2, 3, 4, 5], [], []),
    ).toThrow("Incomplete");
    expect(() =>
      scoreArea(
        area,
        preference(),
        [1, 2, 3, 4, 5],
        [{ ...route, minutes: NaN }],
        [],
      ),
    ).toThrow("Incomplete");
  });
  it("caps long journeys at zero, ties by id, and reproduces scores", () => {
    const r = scoreArea(
      area,
      preference(),
      [1, 2, 3, 4, 5],
      [{ ...route, minutes: 120 }],
      [],
    );
    expect(r.destinationScore).toBe(0);
    expect(
      rankAreas([{ ...r, area: { ...area, id: "z" } }, r]).map(
        (x) => x.area.id,
      ),
    ).toEqual(["a", "z"]);
    expect(scoreArea(area, preference(), [1, 2, 3, 4, 5], [route], [])).toEqual(
      scoreArea(area, preference(), [5, 4, 3, 2, 1], [route], []),
    );
  });
  it("freezes complete-month boundaries in Singapore", () => {
    expect(monthWindow(new Date("2026-09-30T16:00:00Z"), 12)).toEqual({
      fromMonth: "2025-10",
      toMonthExclusive: "2026-10",
    });
    expect(monthWindow(new Date("2026-01-01T00:00:00Z"), 3)).toEqual({
      fromMonth: "2025-10",
      toMonthExclusive: "2026-01",
    });
  });
  it("filters by type and month before budget, retaining expensive observations", () => {
    const snapshot = {
      prices: [
        { town: "A", month: "2026-08", flatType: "4-room", values: [1000000] },
        { town: "A", month: "2026-10", flatType: "4-room", values: [1] },
        { town: "A", month: "2026-08", flatType: "3-room", values: [2] },
      ],
    } as ResearchSnapshot;
    expect(
      pricesFor(snapshot, area, preference(), {
        fromMonth: "2025-10",
        toMonthExclusive: "2026-10",
      }),
    ).toEqual([1000000]);
  });
  it("measures geographic distances and continuous quartiles", () => {
    expect(geographicMetres(area, area)).toBe(0);
    expect(geographicMetres(area, { ...area, latitude: 1.301 })).toBeCloseTo(
      111.195,
      2,
    );
    expect(quantile([10, 20, 30, 40], 0.25)).toBe(17.5);
  });
});
