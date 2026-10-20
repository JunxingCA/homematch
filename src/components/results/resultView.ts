import type { AreaResult, Discovery } from "@/domain/recommendations";
import { amenityPresentation } from "../amenityPresentation";

export const town = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Overall match shown as windows: 0–100 becomes 0–10 lit. */
export function litWindows(overall: number): number {
  return Math.max(0, Math.min(10, Math.round(overall / 10)));
}

export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

export type ScoreKey = "destination" | "lifestyle" | "affordability";

export const SCORE_TILES: {
  key: ScoreKey;
  label: string;
  tint: string;
}[] = [
  { key: "destination", label: "Getting around", tint: "var(--pastel-pink)" },
  { key: "lifestyle", label: "Life nearby", tint: "var(--mint)" },
  { key: "affordability", label: "Value", tint: "var(--amber-soft)" },
];

export function scoreFor(result: AreaResult, key: ScoreKey): number | null {
  return key === "destination"
    ? result.destinationScore
    : key === "lifestyle"
      ? result.lifestyleScore
      : result.affordabilityScore;
}

/** The word for a ranked unit in this market. */
export function areaWord(discovery: Discovery, plural: boolean): string {
  const word =
    discovery.market?.kind === "private"
      ? "district"
      : discovery.market?.kind === "bto"
        ? "launch area"
        : "town";
  return plural ? `${word}s` : word;
}

/** Straight-line metres to minutes on foot at about 80 m a minute. */
export function walkMinutes(metres: number): number {
  return Math.max(1, Math.round(metres / 80));
}

/** One-way minutes for every weekly trip, there and back. */
export function weeklyTravelHours(result: AreaResult): number {
  const minutes = result.routes.reduce(
    (sum, r) => sum + r.minutes * 2 * r.visits,
    0,
  );
  return Math.round((minutes / 60) * 10) / 10;
}

export type MomentPlace = "home" | "station" | "amenity" | "destination";

export type Moment = {
  time: string;
  short: string;
  title: string;
  detail: string;
  place: MomentPlace;
  placeLabel: string;
  night: boolean;
};

const clock = (minutes: number) => {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * A weekday built only from this search's evidence: the routed trip to the most-visited
 * destination (searched for an 08:00 departure) and the nearest imported facilities.
 */
export function weekdayMoments(
  discovery: Discovery,
  result: AreaResult,
): Moment[] {
  const name = town(result.area.name);
  const moments: Moment[] = [
    {
      time: "07:40",
      short: "Out the door",
      title: `Morning in ${name}`,
      detail: `Starting from ${result.area.originLabel}`,
      place: "home",
      placeLabel: "Home",
      night: false,
    },
  ];
  const main = result.routes.toSorted((a, b) => b.visits - a.visits)[0];
  if (main) {
    const how = main.mode === "public" ? "public transport" : "driving";
    moments.push(
      {
        time: "08:00",
        short: "On the way",
        title: `${Math.round(main.minutes)} min to ${main.destination}`,
        detail: `By ${how} · ${(main.metres / 1000).toFixed(1)} km`,
        place: "station",
        placeLabel: main.mode === "public" ? "Station" : "Road",
        night: false,
      },
      {
        time: clock(8 * 60 + main.minutes),
        short: "Arrive",
        title: `At ${main.destination}`,
        detail: `${main.visits} ${main.visits === 1 ? "trip" : "trips"} a week`,
        place: "destination",
        placeLabel: main.destination,
        night: false,
      },
      {
        time: clock(18 * 60 + main.minutes),
        short: "Home again",
        title: `Back in ${name}`,
        detail: `${Math.round(main.minutes)} min the other way`,
        place: "home",
        placeLabel: "Home",
        night: false,
      },
    );
  }
  const nearby = result.amenities
    .filter((a) => a.nearest)
    .toSorted((a, b) => b.priority - a.priority)
    .slice(0, 2);
  nearby.forEach((a, i) => {
    const label =
      amenityPresentation[a.category as keyof typeof amenityPresentation]
        ?.label ?? a.category;
    const metres = Math.round(a.nearest!.metres);
    moments.push({
      time: i === 0 ? "19:15" : "20:15",
      short: label,
      title: a.nearest!.name,
      detail:
        metres < 50
          ? "Right by the starting point"
          : `${metres} m straight-line · about ${walkMinutes(metres)} min on foot`,
      place: "amenity",
      placeLabel: label,
      night: true,
    });
  });
  const hours = weeklyTravelHours(result);
  moments.push({
    time: "22:30",
    short: "Lights on",
    title: "Your window, one of thousands",
    detail: result.routes.length
      ? `About ${hours} hours of travel a week`
      : `${result.area.originLabel} area`,
    place: "home",
    placeLabel: "Home",
    night: true,
  });
  return moments;
}

/** Which compared result leads on a score; ties name nobody. */
export function leader(
  results: AreaResult[],
  value: (r: AreaResult) => number | null,
): string | null {
  const scored = results
    .map((r) => ({ id: r.area.id, v: value(r) }))
    .filter((x): x is { id: string; v: number } => x.v !== null);
  if (scored.length < 2) return null;
  const best = Math.max(...scored.map((x) => x.v));
  const top = scored.filter((x) => x.v === best);
  return top.length === 1 ? top[0].id : null;
}

/** One plain sentence on the compared results, from their scores and weighted journeys. */
export function verdict(results: AreaResult[]): string {
  if (results.length < 2) return "";
  const best = results.toSorted((a, b) => b.overall - a.overall)[0];
  const tied = results.filter((r) => r.overall === best.overall).length > 1;
  if (tied) return "A tie on your weighting. Go and see both on a weekend.";
  const faster = results
    .filter((r) => r !== best)
    .toSorted((a, b) => a.weightedMinutes - b.weightedMinutes)[0];
  const lead = `${town(best.area.name)} fits your week best`;
  return faster && faster.weightedMinutes < best.weightedMinutes
    ? `${lead}, though ${town(faster.area.name)} gets you there faster.`
    : `${lead}.`;
}

/** Latitude/longitude onto the 400×240 island outline. */
export function project(latitude: number, longitude: number): [number, number] {
  const x = 30 + ((longitude - 103.6) / (104.05 - 103.6)) * 345;
  const y = 38 + ((1.47 - latitude) / (1.47 - 1.24)) * 167;
  return [
    Math.round(Math.max(24, Math.min(380, x))),
    Math.round(Math.max(30, Math.min(210, y))),
  ];
}

export const SINGAPORE_OUTLINE =
  "M30 130 C40 100 70 90 100 80 C130 60 160 40 200 38 C240 36 270 50 300 60 C330 70 360 80 375 100 " +
  "C385 115 370 135 345 145 C320 160 290 170 260 185 C230 200 200 205 170 200 C140 196 110 190 85 175 " +
  "C60 165 35 150 30 130 Z";
