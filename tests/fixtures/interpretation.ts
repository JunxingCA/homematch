import type { Interpretation } from "../../src/domain/interpretation";
export const description =
  "A 4-room resale HDB under $600k. I visit NTU five times a week by MRT and play badminton. I also want a quiet area.";
export const interpreted = (): Interpretation => ({
  name: null,
  category: "Resale HDB",
  budgetMin: null,
  budgetMax: 600000,
  flatTypes: ["4-room"],
  lookbackMonths: null,
  destinations: [{ query: "NTU", visits: 5, mode: "public" }],
  lifestyles: [{ category: "Badminton", radius: null, priority: null }],
  weights: null,
  ambiguities: [],
  unsupported: ["Quietness is not a supported filter"],
  evidence: [
    { field: "category", quote: "resale HDB" },
    { field: "budgetMax", quote: "under $600k" },
    { field: "flatTypes", quote: "4-room" },
    { field: "destinations", quote: "I visit NTU five times a week by MRT" },
    { field: "lifestyles", quote: "play badminton" },
  ],
});
