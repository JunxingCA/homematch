import { describe, expect, it } from "vitest";
import catalogueJson from "../../data/bto-2026-06.json";
import { samplePreference } from "@/domain/fixtures";
import {
  btoCatalogueSchema,
  marketFiltersSchema,
  normaliseUra,
  svy21Point,
  type PrivateSnapshot,
} from "@/domain/marketEvidence.mjs";
import {
  btoCandidates,
  marketRankingInput,
  privateCandidates,
  rangeBudgetScore,
  scoreMarketCandidate,
} from "@/domain/marketRecommendations";
import { priceHeading, priceRange, type Area } from "@/domain/recommendations";
const filters = marketFiltersSchema.parse({});
const catalogue = btoCatalogueSchema.parse(catalogueJson);
const preference = {
  ...structuredClone(samplePreference),
  category: "BTO" as const,
  flatTypes: ["4-room" as const],
  lifestyles: [],
  weights: { destination: 70, lifestyle: 0, affordability: 30 },
};
const origins: Area[] = [...new Set(catalogue.projects.map((p) => p.town))].map(
  (name) => ({
    id: name,
    name,
    latitude: 1.33,
    longitude: 103.8,
    originLabel: "Verified town MRT",
  }),
);
const routes = preference.destinations.map((d) => ({
  destination: d.location!.label,
  mode: d.mode,
  visits: d.visits,
  minutes: 30,
  metres: 5000,
  geometry: [],
}));
const raw = (overrides = {}) => ({
  contractDate: "0926",
  district: "04",
  propertyType: "Condominium",
  price: "1200000",
  area: "90",
  typeOfArea: "Strata",
  typeOfSale: "3",
  noOfUnits: "1",
  ...overrides,
});
const batches = (transactions = [raw()]) => [
  {
    Status: "Success",
    Result: [
      {
        project: "Public fixture",
        street: "Example road",
        x: "28001.642",
        y: "38744.572",
        transaction: transactions,
      },
    ],
  },
  ...Array.from({ length: 3 }, () => ({ Status: "Success", Result: [] })),
];
const privateSnapshot = () =>
  normaliseUra(
    batches(
      Array.from({ length: 5 }, (_, i) =>
        raw({ price: String(1000000 + i * 100000) }),
      ),
    ),
    "2026-10-14T00:00:00.000Z",
    "fixture",
  );

describe("separate BTO and private pricing evidence", () => {
  it("validates seven real June launch projects without pretending they are open", () => {
    expect(catalogue.projects).toHaveLength(7);
    const closed = btoCandidates(
      catalogue,
      origins,
      preference,
      filters,
      "2026-10-14",
    );
    expect(closed.candidates).toHaveLength(0);
    expect(closed.excluded).toHaveLength(7);
    const archived = btoCandidates(
      catalogue,
      origins,
      preference,
      { ...filters, includeClosedLaunches: true },
      "2026-10-14",
    );
    expect(archived.candidates).toHaveLength(7);
    expect(archived.candidates[0].bto!.ranges).toEqual([
      { flatType: "4-room", min: 320000, max: 437000 },
    ]);
    expect(archived.candidates[0].area.originLabel).toContain(
      "town proxy, not project entrance",
    );
    expect(
      btoCandidates(catalogue, origins, preference, filters, "2026-06-17")
        .candidates,
    ).toHaveLength(7);
    expect(
      btoCandidates(catalogue, origins, preference, filters, "2026-06-24")
        .candidates,
    ).toHaveLength(7);
    expect(
      btoCandidates(
        catalogue,
        origins,
        preference,
        { ...filters, includeClosedLaunches: true },
        "2026-06-01",
      ).candidates,
    ).toHaveLength(0);
  });
  it("excludes unoffered types and missing verified town origins", () => {
    expect(
      btoCandidates(
        catalogue,
        origins,
        { ...preference, flatTypes: ["Executive"] },
        filters,
        "2026-06-20",
      ).candidates,
    ).toHaveLength(0);
    expect(
      btoCandidates(catalogue, [], preference, filters, "2026-06-20")
        .candidates,
    ).toHaveLength(0);
    expect(() =>
      btoCatalogueSchema.parse({
        ...catalogue,
        projects: [catalogue.projects[0], catalogue.projects[0]],
      }),
    ).toThrow();
    expect(() =>
      btoCatalogueSchema.parse({
        ...catalogue,
        sourceUrl: "https://evil.test/prices",
      }),
    ).toThrow();
  });
  it.each([
    [100, 200, 100],
    [0, 99, 0],
    [150, 200, 50],
    [125, 175, 50],
    [200, 300, 0],
  ])(
    "calculates explicit range coverage for budget %s-%s",
    (min, max, expected) => {
      expect(
        rangeBudgetScore(
          [{ flatType: "4-room", min: 100, max: 200 }],
          min,
          max,
        ),
      ).toBe(expected);
    },
  );
  it("handles fixed quotes and equal-weight selected types without invented unit counts", () => {
    expect(
      rangeBudgetScore([{ flatType: "4-room", min: 100, max: 100 }], 100, 100),
    ).toBe(100);
    expect(
      rangeBudgetScore([{ flatType: "4-room", min: 100, max: 100 }], 101, 200),
    ).toBe(0);
    expect(() => rangeBudgetScore([], 0, 100)).toThrow();
    const candidate = btoCandidates(
      catalogue,
      origins,
      preference,
      filters,
      "2026-06-20",
    ).candidates[0];
    const result = scoreMarketCandidate(
      candidate,
      preference,
      filters,
      routes,
      [],
    );
    expect(result.transactions).toBe(0);
    expect(result.priceEvidence?.kind).toBe("bto-range");
    expect(priceHeading(result)).toBe("Published range upper bound");
    expect(priceRange(result)).toEqual({ min: 320000, max: 437000 });
    expect(result.median).toBe(437000);
    expect(Number.isFinite(result.overall)).toBe(true);
  });
  it("uses the standard projection library for URA's SVY21 coordinates", () => {
    const point = svy21Point(28001.642, 38744.572);
    expect(point.latitude).toBeCloseTo(1.36666666666667, 7);
    expect(point.longitude).toBeCloseTo(103.833333333333, 7);
    expect(() => svy21Point("", "")).toThrow();
    expect(() => svy21Point(99999999, 99999999)).toThrow();
  });
  it("requires all four successful batches, preserves repeated single-unit caveats and excludes bulk sales", () => {
    expect(() =>
      normaliseUra(batches().slice(0, 3), "2026-10-14T00:00:00.000Z", "bad"),
    ).toThrow();
    const incomplete = batches();
    incomplete[2].Status = "Failure";
    expect(() =>
      normaliseUra(incomplete, "2026-10-14T00:00:00.000Z", "bad"),
    ).toThrow();
    const snapshot = normaliseUra(
      batches([raw(), raw(), raw({ noOfUnits: "2" })]),
      "2026-10-14T00:00:00.000Z",
      "ok",
    );
    expect(snapshot.projects[0].transactions).toHaveLength(2);
    expect(snapshot.skippedMultiUnit).toBe(1);
    expect(snapshot.latestMonth).toBe("2026-09");
  });
  it.each([
    { contractDate: "1326" },
    { contractDate: "1126" },
    { price: "NaN" },
    { price: "0" },
    { district: "15" },
    { noOfUnits: "bad" },
    { propertyType: "Unknown property" },
  ])("rejects malformed/future/misbatched evidence %o", (overrides) => {
    expect(() =>
      normaliseUra(
        batches([raw(overrides)]),
        "2026-10-14T00:00:00.000Z",
        "bad",
      ),
    ).toThrow();
  });
  it("keeps private categories, time, area and sale-type filters separate from HDB room types", () => {
    const snapshot = privateSnapshot();
    const p = {
      ...preference,
      category: "Condominium" as const,
      flatTypes: ["Executive" as const],
    };
    const window = { fromMonth: "2025-10", toMonthExclusive: "2026-10" };
    const result = privateCandidates(snapshot, p, filters, window);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].prices).toHaveLength(5);
    expect(result.candidates[0].area.name).toBe("District 04");
    expect(
      privateCandidates(
        snapshot,
        { ...p, category: "Private / landed" },
        filters,
        window,
      ).candidates,
    ).toHaveLength(0);
    expect(
      privateCandidates(snapshot, p, { ...filters, minAreaSqm: 100 }, window)
        .candidates,
    ).toHaveLength(0);
    expect(
      privateCandidates(snapshot, p, { ...filters, areaType: "Land" }, window)
        .candidates,
    ).toHaveLength(0);
    expect(
      privateCandidates(snapshot, p, { ...filters, saleType: "1" }, window)
        .candidates,
    ).toHaveLength(0);
    expect(
      privateCandidates(snapshot, p, filters, {
        ...window,
        fromMonth: "2026-10",
      }).candidates,
    ).toHaveLength(0);
    snapshot.projects[0].transactions.forEach(
      (t) => (t.propertyType = "Executive Condominium"),
    );
    expect(
      privateCandidates(snapshot, p, filters, window).candidates,
    ).toHaveLength(0);
  });
  it("retains every matching price before applying budget and enforces five transactions", () => {
    const snapshot = privateSnapshot(),
      p = {
        ...preference,
        category: "Condominium" as const,
        budgetMin: 1000000,
        budgetMax: 1100000,
      };
    const window = { fromMonth: "2025-10", toMonthExclusive: "2026-10" };
    const candidate = privateCandidates(snapshot, p, filters, window)
      .candidates[0];
    const result = scoreMarketCandidate(candidate, p, filters, routes, []);
    expect(result.transactions).toBe(5);
    expect(result.withinBudget).toBe(2);
    expect(result.median).toBe(1200000);
    expect(result.affordabilityScore).toBe(40);
    expect(result.priceEvidence?.kind).toBe("private-transactions");
    snapshot.projects[0].transactions.pop();
    expect(
      privateCandidates(snapshot, p, filters, window).candidates,
    ).toHaveLength(0);
  });
  it("rejects client-controlled ownership, scores and invalid numeric filters", () => {
    const input = { profileId: crypto.randomUUID(), revision: 1, filters: {} };
    expect(marketRankingInput.parse(input).filters).toEqual(filters);
    expect(() =>
      marketRankingInput.parse({ ...input, userId: crypto.randomUUID() }),
    ).toThrow();
    expect(() =>
      marketRankingInput.parse({ ...input, filters: { score: 100 } }),
    ).toThrow();
    expect(() =>
      marketFiltersSchema.parse({ minAreaSqm: 200, maxAreaSqm: 100 }),
    ).toThrow();
    expect(() =>
      privateCandidates({} as PrivateSnapshot, preference, filters, {
        fromMonth: "2026-01",
        toMonthExclusive: "2026-10",
      }),
    ).toThrow();
  });
});
