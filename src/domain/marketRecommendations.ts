import { z } from "zod";
import type { Preference } from "./preferences";
import {
  scoreArea,
  scoreAreaContext,
  weightedOverall,
  type Area,
  type AreaResult,
  type Facility,
  type RouteEvidence,
} from "./recommendations";
import {
  marketFiltersSchema,
  type MarketFilters,
  type BtoCatalogue,
  type PrivateSnapshot,
  type BtoRange,
} from "./marketEvidence.mjs";

export const marketRankingInput = z
  .object({
    profileId: z.uuid(),
    revision: z.number().int().positive(),
    filters: marketFiltersSchema,
  })
  .strict();
export type MarketCandidate = {
  area: Area;
  prices: number[];
  bto?: {
    catalogue: BtoCatalogue;
    project: BtoCatalogue["projects"][number];
    ranges: BtoRange[];
  };
  district?: string;
};
export function btoCandidates(
  catalogue: BtoCatalogue,
  origins: Area[],
  preference: Preference,
  filters: MarketFilters,
  today: string,
) {
  if (preference.category !== "BTO") throw Error("BTO profile required");
  const excluded: { area: string; reason: string }[] = [];
  const candidates: MarketCandidate[] = [];
  for (const project of catalogue.projects) {
    const origin = origins.find((a) => a.name === project.town);
    const ranges = project.ranges.filter((r) =>
      preference.flatTypes.includes(r.flatType),
    );
    const reason =
      today < catalogue.applicationOpens
        ? "Applications have not opened."
        : today > catalogue.applicationCloses && !filters.includeClosedLaunches
          ? "This published launch is closed. Historical research is available separately."
          : !ranges.length
            ? "No selected flat type is offered in this source."
            : !origin
              ? "No verified town reference origin."
              : null;
    if (reason || !origin) {
      excluded.push({ area: project.name, reason: reason! });
      continue;
    }
    candidates.push({
      area: {
        ...origin,
        id: `bto-${catalogue.launch}-${project.id}`,
        name: project.name,
        originLabel: `${project.town}: ${origin.originLabel} (town proxy, not project entrance)`,
      },
      prices: [],
      bto: { catalogue, project, ranges },
    });
  }
  return { candidates, excluded };
}
export function privateCandidates(
  snapshot: PrivateSnapshot,
  preference: Preference,
  filters: MarketFilters,
  window: { fromMonth: string; toMonthExclusive: string },
) {
  if (
    preference.category !== "Condominium" &&
    preference.category !== "Private / landed"
  )
    throw Error("Private housing profile required");
  const allowed =
    preference.category === "Condominium"
      ? ["Condominium", "Apartment"]
      : [
          "Detached",
          "Semi-detached",
          "Terrace",
          "Strata Detached",
          "Strata Semidetached",
          "Strata Terrace",
        ];
  const districts = new Map<
    string,
    {
      prices: number[];
      origins: Map<string, { latitude: number; longitude: number }>;
    }
  >();
  for (const project of snapshot.projects)
    for (const t of project.transactions) {
      if (
        !allowed.includes(t.propertyType) ||
        t.month < window.fromMonth ||
        t.month >= window.toMonthExclusive ||
        t.areaSqm < filters.minAreaSqm ||
        t.areaSqm > filters.maxAreaSqm ||
        (filters.areaType !== "Any" && t.areaType !== filters.areaType) ||
        (filters.saleType !== "Any" && t.saleType !== filters.saleType)
      )
        continue;
      let district = districts.get(t.district);
      if (!district) {
        district = { prices: [], origins: new Map() };
        districts.set(t.district, district);
      }
      district.prices.push(t.price);
      district.origins.set(
        `${project.name}:${project.latitude}:${project.longitude}`,
        project,
      );
    }
  const candidates: MarketCandidate[] = [],
    excluded: { area: string; reason: string }[] = [];
  for (let n = 1; n <= 28; n++) {
    const code = String(n).padStart(2, "0"),
      record = districts.get(code);
    if (!record || record.prices.length < 5) {
      excluded.push({
        area: `District ${code}`,
        reason: `Only ${record?.prices.length ?? 0} matching single-unit transactions; at least five are required.`,
      });
      continue;
    }
    const origins = [...record.origins.values()];
    candidates.push({
      area: {
        id: `private-district-${code}`,
        name: `District ${code}`,
        originLabel: `District ${code}: mean of ${origins.length} matching imported project locations, not a home entrance or district centroid`,
        latitude:
          origins.reduce((sum, p) => sum + p.latitude, 0) / origins.length,
        longitude:
          origins.reduce((sum, p) => sum + p.longitude, 0) / origins.length,
      },
      prices: record.prices,
      district: code,
    });
  }
  return { candidates, excluded };
}
export function rangeBudgetScore(
  ranges: BtoRange[],
  budgetMin: number,
  budgetMax: number,
) {
  if (!ranges.length) throw Error("Missing quoted ranges");
  return (
    ranges.reduce(
      (sum, r) =>
        sum +
        (r.min === r.max
          ? r.min >= budgetMin && r.max <= budgetMax
            ? 100
            : 0
          : (100 *
              Math.max(
                0,
                Math.min(r.max, budgetMax) - Math.max(r.min, budgetMin),
              )) /
            (r.max - r.min)),
      0,
    ) / ranges.length
  );
}
export function scoreMarketCandidate(
  candidate: MarketCandidate,
  preference: Preference,
  filters: MarketFilters,
  routes: RouteEvidence[],
  facilities: Facility[],
): AreaResult {
  if (!candidate.bto)
    return {
      ...scoreArea(
        candidate.area,
        preference,
        candidate.prices,
        routes,
        facilities,
      ),
      priceEvidence: {
        kind: "private-transactions",
        district: candidate.district!,
        filters,
      },
    };
  const { catalogue, project, ranges } = candidate.bto;
  const context = scoreAreaContext(
    candidate.area,
    preference,
    routes,
    facilities,
  );
  const affordabilityScore = rangeBudgetScore(
    ranges,
    preference.budgetMin,
    preference.budgetMax,
  );
  const min = Math.min(...ranges.map((r) => r.min)),
    max = Math.max(...ranges.map((r) => r.max));
  return {
    ...context,
    overall: weightedOverall(
      preference,
      context.destinationScore,
      context.lifestyleScore,
      affordabilityScore,
    ),
    affordabilityScore,
    // Legacy price fields carry display bounds, never fabricated BTO sales or percentiles.
    transactions: 0,
    withinBudget: 0,
    median: max,
    p25: min,
    p75: max,
    priceEvidence: {
      kind: "bto-range",
      launch: catalogue.launch,
      applicationOpens: catalogue.applicationOpens,
      applicationCloses: catalogue.applicationCloses,
      classification: project.classification,
      waitingMonths: project.waitingMonths,
      ranges,
    },
  };
}
