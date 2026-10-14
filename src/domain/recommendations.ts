import type { z } from "zod";
import type { BtoRange, MarketFilters } from "./marketEvidence.mjs";
import { confirmedProfileSchema, type Preference } from "./preferences";

export const FORMULA_VERSION = "hdb-town-v1";
import {
  pointSchema,
  areaSchema,
  facilitySchema,
  snapshotSchema,
} from "./researchSnapshot.mjs";
export { pointSchema, areaSchema, facilitySchema, snapshotSchema };
export type ResearchSnapshot = z.infer<typeof snapshotSchema>;
export type Area = z.infer<typeof areaSchema>;
export type Facility = z.infer<typeof facilitySchema>;
export type Point = z.infer<typeof pointSchema>;
export type RouteEvidence = {
  destination: string;
  visits: number;
  mode: "public" | "private";
  minutes: number;
  metres: number;
  geometry: [number, number][][];
};
export type AreaResult = {
  priceEvidence?:
    | {
        kind: "bto-range";
        launch: string;
        applicationOpens: string;
        applicationCloses: string;
        classification: string;
        waitingMonths: string;
        ranges: BtoRange[];
      }
    | {
        kind: "private-transactions";
        district: string;
        filters: MarketFilters;
      };
  area: Area;
  overall: number;
  destinationScore: number;
  lifestyleScore: number | null;
  affordabilityScore: number;
  transactions: number;
  withinBudget: number;
  median: number;
  p25: number;
  p75: number;
  weightedMinutes: number;
  routes: RouteEvidence[];
  amenities: {
    category: string;
    radius: number;
    priority: number;
    count: number;
    nearest: (Facility & { metres: number }) | null;
    facilities: (Facility & { metres: number })[];
    score: number;
  }[];
};
export type Discovery = {
  market?: {
    kind: "bto" | "private";
    filters: MarketFilters;
    coverage: string;
  };
  id: string;
  createdAt: string;
  formulaVersion: string;
  snapshotId: string;
  profileId: string;
  profileRevision: number;
  preference: Preference;
  fromMonth: string;
  toMonthExclusive: string;
  sourceUrl: string;
  fetchedAt: string;
  latestMonth: string;
  facilitySources: ResearchSnapshot["facilitySources"];
  departure: string;
  results: AreaResult[];
  excluded: { area: string; reason: string }[];
};

export function monthWindow(date: Date, months: number) {
  const current = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  const y = Number(current.find((x) => x.type === "year")!.value);
  const m = Number(current.find((x) => x.type === "month")!.value);
  const from = new Date(Date.UTC(y, m - 1 - months, 1));
  return {
    fromMonth: from.toISOString().slice(0, 7),
    toMonthExclusive: `${y}-${String(m).padStart(2, "0")}`,
  };
}
export function quantile(sorted: number[], q: number) {
  if (!sorted.length) throw new Error("Empty price sample");
  const position = (sorted.length - 1) * q;
  const low = Math.floor(position),
    high = Math.ceil(position);
  return sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}
export function geographicMetres(a: Point, b: Point) {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude),
    lon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return 6371008.8 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function pricesFor(
  snapshot: ResearchSnapshot,
  area: Area,
  preference: Preference,
  window: ReturnType<typeof monthWindow>,
) {
  return snapshot.prices
    .filter(
      (g) =>
        g.town === area.name &&
        preference.flatTypes.includes(
          g.flatType as Preference["flatTypes"][number],
        ) &&
        g.month >= window.fromMonth &&
        g.month < window.toMonthExclusive,
    )
    .flatMap((g) => g.values)
    .sort((a, b) => a - b);
}
export function scoreArea(
  area: Area,
  preference: Preference,
  prices: number[],
  routes: RouteEvidence[],
  facilities: Facility[],
): AreaResult {
  if (prices.length < 5) throw new Error("Insufficient transactions");
  const context = scoreAreaContext(area, preference, routes, facilities);
  const sorted = [...prices].sort((a, b) => a - b);
  const withinBudget = sorted.filter(
    (price) => price >= preference.budgetMin && price <= preference.budgetMax,
  ).length;
  const affordabilityScore = (100 * withinBudget) / sorted.length;
  return {
    ...context,
    overall: weightedOverall(
      preference,
      context.destinationScore,
      context.lifestyleScore,
      affordabilityScore,
    ),
    affordabilityScore,
    transactions: sorted.length,
    withinBudget,
    median: quantile(sorted, 0.5),
    p25: quantile(sorted, 0.25),
    p75: quantile(sorted, 0.75),
  };
}
export function weightedOverall(
  preference: Preference,
  destinationScore: number,
  lifestyleScore: number | null,
  affordabilityScore: number,
) {
  return (
    (preference.weights.destination * destinationScore +
      preference.weights.lifestyle * (lifestyleScore ?? 0) +
      preference.weights.affordability * affordabilityScore) /
    100
  );
}
export function scoreAreaContext(
  area: Area,
  preference: Preference,
  routes: RouteEvidence[],
  facilities: Facility[],
) {
  confirmedProfileSchema.parse(preference);
  if (
    routes.length !== preference.destinations.length ||
    routes.some(
      (r, i) =>
        r.destination !== preference.destinations[i].location?.label ||
        r.mode !== preference.destinations[i].mode ||
        r.visits !== preference.destinations[i].visits ||
        !Number.isFinite(r.minutes) ||
        r.minutes < 0 ||
        !Number.isFinite(r.metres) ||
        r.metres < 0,
    )
  )
    throw new Error("Incomplete routing evidence");
  const weightedMinutes =
    routes.reduce((sum, r) => sum + r.minutes * r.visits, 0) /
    routes.reduce((sum, r) => sum + r.visits, 0);
  const destinationScore = 100 * clamp(1 - weightedMinutes / 90);
  const amenities = preference.lifestyles.map((p) => {
    const matches = facilities
      .filter((f) => f.category === p.category)
      .map((f) => ({ ...f, metres: geographicMetres(area, f) }))
      .filter((f) => f.metres <= p.radius)
      .sort((a, b) => a.metres - b.metres || a.name.localeCompare(b.name));
    return {
      category: p.category,
      radius: p.radius,
      priority: p.priority,
      count: matches.length,
      nearest: matches[0] ?? null,
      facilities: matches.slice(0, 10),
      score: matches.length ? 100 * clamp(1 - matches[0].metres / p.radius) : 0,
    };
  });
  const lifestyleScore = amenities.length
    ? amenities.reduce((sum, p) => sum + p.priority * p.score, 0) /
      amenities.reduce((sum, p) => sum + p.priority, 0)
    : null;
  return {
    area,
    destinationScore,
    lifestyleScore,
    weightedMinutes,
    routes,
    amenities,
  };
}
export const priceHeading = (result: AreaResult) =>
  result.priceEvidence?.kind === "bto-range"
    ? "Published range upper bound"
    : "Historical median";
export const priceRangeHeading = (result: AreaResult) =>
  result.priceEvidence?.kind === "bto-range"
    ? "Published price range"
    : "Price quartiles";
export const priceRange = (result: AreaResult) =>
  result.priceEvidence?.kind === "bto-range"
    ? {
        min: Math.min(...result.priceEvidence.ranges.map((r) => r.min)),
        max: Math.max(...result.priceEvidence.ranges.map((r) => r.max)),
      }
    : { min: result.p25, max: result.p75 };
export function rankAreas(results: AreaResult[]) {
  return [...results].sort(
    (a, b) => b.overall - a.overall || a.area.id.localeCompare(b.area.id),
  );
}
