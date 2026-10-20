import type { Preference } from "@/domain/preferences";

export type LifestylePresetId = "hawker" | "family" | "runner" | "commuter";
type Lifestyle = Preference["lifestyles"][number];

/** "Pick a life" starting points. They only pre-fill the form; nothing is saved. */
const PRESETS: Record<
  LifestylePresetId,
  {
    lifestyles: Lifestyle[] | null;
    weights: Preference["weights"];
    flatTypes?: Preference["flatTypes"];
  }
> = {
  hawker: {
    lifestyles: [
      { category: "Hawker centres", priority: 5, radius: 500 },
      { category: "Groceries", priority: 3, radius: 800 },
    ],
    weights: { destination: 30, lifestyle: 50, affordability: 20 },
  },
  family: {
    lifestyles: [
      { category: "Schools", priority: 5, radius: 1000 },
      { category: "Parks", priority: 3, radius: 1000 },
      { category: "Healthcare", priority: 3, radius: 2000 },
    ],
    weights: { destination: 30, lifestyle: 45, affordability: 25 },
    flatTypes: ["4-room", "5-room"],
  },
  runner: {
    lifestyles: [
      { category: "Parks", priority: 5, radius: 800 },
      { category: "Running tracks", priority: 5, radius: 1500 },
      { category: "Gym", priority: 3, radius: 1000 },
    ],
    weights: { destination: 30, lifestyle: 50, affordability: 20 },
  },
  commuter: {
    lifestyles: null,
    weights: { destination: 60, lifestyle: 15, affordability: 25 },
  },
};

export function applyPreset(
  preference: Preference,
  id: LifestylePresetId,
): Preference {
  const preset = PRESETS[id];
  const lifestyles = preset.lifestyles ?? preference.lifestyles;
  let weights = preset.weights;
  // The profile rules require a 0% lifestyle weight when no lifestyles are chosen.
  if (!lifestyles.length)
    weights = {
      destination: weights.destination + weights.lifestyle,
      lifestyle: 0,
      affordability: weights.affordability,
    };
  return {
    ...preference,
    lifestyles: lifestyles.map((l) => ({ ...l })),
    weights: { ...weights },
    flatTypes: preset.flatTypes ? [...preset.flatTypes] : preference.flatTypes,
  };
}
