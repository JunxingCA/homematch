import type { Preference } from "@/domain/preferences";
import { amenityPresentation } from "../amenityPresentation";

type Category = Preference["category"];

/** Slider range per housing category; the exact-number fields accept anything the schema allows. */
export const BUDGET_SCALE: Record<
  Category,
  { min: number; max: number; step: number }
> = {
  BTO: { min: 100_000, max: 1_200_000, step: 10_000 },
  "Resale HDB": { min: 100_000, max: 1_500_000, step: 10_000 },
  Condominium: { min: 500_000, max: 5_000_000, step: 50_000 },
  "Private / landed": { min: 1_000_000, max: 20_000_000, step: 100_000 },
};

export const MUST = 5;
export const NICE = 3;
/** Must/Nice is the visible control; existing 1–5 priorities read as Must from 4 up. */
export function priorityLevel(priority: number): "must" | "nice" {
  return priority >= 4 ? "must" : "nice";
}

export function shortMoney(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  return `$${Math.round(n / 1000)}K`;
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(n);
}

export function radiusLabel(metres: number): string {
  return metres >= 1000 ? `${metres / 1000} km` : `${metres} m`;
}

function joinList(xs: string[]): string {
  if (xs.length <= 1) return xs.join("");
  return xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];
}

const CATEGORY_TEXT: Record<Category, string> = {
  BTO: "A new BTO",
  "Resale HDB": "A resale",
  Condominium: "A condominium",
  "Private / landed": "A private or landed home",
};

/** "Your home, in one sentence" — built only from the fields the user has set. */
export function preferenceSentence(p: Preference): string {
  const hdb = p.category === "BTO" || p.category === "Resale HDB";
  const flats = hdb && p.flatTypes.length ? ` ${joinList(p.flatTypes)}` : "";
  const musts = p.lifestyles
    .filter((l) => priorityLevel(l.priority) === "must")
    .map((l) => amenityPresentation[l.category].label.toLowerCase());
  const place = [...p.destinations]
    .filter((d) => d.location || d.query.trim())
    .sort((a, b) => b.visits - a.visits)[0];
  const placeName = place
    ? (place.location?.label ?? place.query).split(",")[0]
    : "";
  return (
    `${CATEGORY_TEXT[p.category]}${hdb && !flats ? " flat" : ""}${flats} between ${money(p.budgetMin)} and ${money(p.budgetMax)}` +
    (musts.length ? `, with ${joinList(musts)} close by` : "") +
    (placeName ? ` and an easy trip to ${placeName}` : "") +
    "."
  );
}
