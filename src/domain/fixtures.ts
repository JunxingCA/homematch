import type { Location, Preference } from "./preferences";

// Deliberately small preview catalog. Never presented as live OneMap results.
export const fixtureLocations: Location[] = [
  {
    id: "fixture-ntu",
    label: "Nanyang Technological University",
    latitude: 1.3483,
    longitude: 103.6831,
    source: "fixture",
  },
  {
    id: "fixture-raffles",
    label: "Raffles Place MRT",
    latitude: 1.2841,
    longitude: 103.8515,
    source: "fixture",
  },
  {
    id: "fixture-tampines",
    label: "Tampines MRT",
    latitude: 1.3545,
    longitude: 103.9452,
    source: "fixture",
  },
  {
    id: "fixture-bishan",
    label: "Bishan MRT",
    latitude: 1.3509,
    longitude: 103.8482,
    source: "fixture",
  },
];
export const samplePreference: Preference = {
  name: "Our next home",
  category: "Resale HDB",
  budgetMin: 400000,
  budgetMax: 750000,
  flatTypes: ["4-room"],
  lookbackMonths: 12,
  weights: { destination: 40, lifestyle: 30, affordability: 30 },
  destinations: [
    {
      query: fixtureLocations[0].label,
      location: fixtureLocations[0],
      visits: 5,
      mode: "public",
    },
  ],
  lifestyles: [
    { category: "Badminton", priority: 4, radius: 1000 },
    { category: "Parks", priority: 3, radius: 800 },
  ],
};
