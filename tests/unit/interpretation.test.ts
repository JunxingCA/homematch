import { expect, it } from "vitest";
import {
  draftProposal,
  interpretationRequest,
  validateInterpretation,
} from "@/domain/interpretation";
import { confirmedProfileSchema } from "@/domain/preferences";
import { samplePreference } from "@/domain/fixtures";
import { description, interpreted } from "../fixtures/interpretation";
it("requires explicit consent and bounds description input", () => {
  expect(
    interpretationRequest.parse({ text: description, consent: true }).text,
  ).toBe(description);
  for (const input of [
    { text: description, consent: false },
    { text: "x", consent: true },
    { text: "x".repeat(4001), consent: true },
    { text: description, consent: true, userId: "forged" },
  ])
    expect(interpretationRequest.safeParse(input).success).toBe(false);
});
it("validates a grounded draft and retains null/missing details", () => {
  const draft = validateInterpretation(interpreted(), description);
  expect(draft.budgetMin).toBeNull();
  expect(draft.lookbackMonths).toBeNull();
  expect(draft.weights).toBeNull();
  expect(draft.lifestyles![0].radius).toBeNull();
});
it("rejects unsupported fields, coordinates, IDs and forged evidence", () => {
  for (const extra of [
    { scores: [100] },
    { confirmed: true },
    { model: "override" },
  ])
    expect(() =>
      validateInterpretation({ ...interpreted(), ...extra }, description),
    ).toThrow();
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        destinations: [{ ...interpreted().destinations![0], latitude: 1.3 }],
      },
      description,
    ),
  ).toThrow();
  expect(() =>
    validateInterpretation({ ...interpreted(), evidence: [] }, description),
  ).toThrow("source quote");
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        evidence: [{ field: "category", quote: "not in the text" }],
      },
      description,
    ),
  ).toThrow();
});
it("rejects duplicate categories and values outside the app's domain", () => {
  expect(() =>
    validateInterpretation(
      { ...interpreted(), flatTypes: ["4-room", "4-room"] },
      description,
    ),
  ).toThrow("Repeated");
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        lifestyles: [
          interpreted().lifestyles![0],
          interpreted().lifestyles![0],
        ],
      },
      description,
    ),
  ).toThrow("Repeated");
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        destinations: [{ query: "NTU", visits: 50, mode: "public" }],
      },
      description,
    ),
  ).toThrow();
});
it("proposes disclosed defaults without mutating or saving the current form", () => {
  const base = structuredClone(samplePreference),
    before = structuredClone(base);
  const result = draftProposal(base, interpreted());
  expect(base).toEqual(before);
  expect(result.preference.budgetMax).toBe(600000);
  expect(result.proposed).toContain(
    "Minimum budget (SGD): current form value retained (400000)",
  );
  expect(result.proposed).toContain("Badminton: proposed 1000 m radius");
  expect(result.preference.destinations[0].location).toBeNull();
  expect(confirmedProfileSchema.safeParse(result.preference).success).toBe(
    false,
  );
});
it("does not silently repair conflicting budgets or weights", () => {
  const draft = {
    ...interpreted(),
    budgetMin: 900000,
    weights: { destination: 10, lifestyle: 10, affordability: 10 },
  };
  const proposed = draftProposal(samplePreference, draft).preference;
  expect(proposed.budgetMin).toBe(900000);
  expect(proposed.weights.destination).toBe(10);
  expect(confirmedProfileSchema.safeParse(proposed).success).toBe(false);
});
it("rejects destinations repeated with different casing", () => {
  const item = interpreted().destinations![0];
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        destinations: [item, { ...item, query: item.query.toLowerCase() }],
      },
      description,
    ),
  ).toThrow("Repeated destination");
});
it("rejects an invented extra quotation even when all populated fields have valid evidence", () => {
  expect(() =>
    validateInterpretation(
      {
        ...interpreted(),
        evidence: [
          ...interpreted().evidence,
          { field: "weights", quote: "not in the supplied description" },
        ],
      },
      description,
    ),
  ).toThrow("Invented source quotation");
});
it("preserves contradictory numbers, adds review notices and leaves the source object untouched", () => {
  const text = "Minimum 900000, maximum 600000; weights 50, 30, 30.";
  const draft = {
    ...interpreted(),
    name: null,
    category: null,
    budgetMin: 900000,
    budgetMax: 600000,
    flatTypes: null,
    destinations: null,
    lifestyles: null,
    weights: { destination: 50, lifestyle: 30, affordability: 30 },
    evidence: [
      { field: "budgetMin", quote: "900000" },
      { field: "budgetMax", quote: "600000" },
      { field: "weights", quote: "weights 50, 30, 30" },
    ],
  };
  const before = structuredClone(draft);
  const result = validateInterpretation(draft, text);
  expect(result.ambiguities).toEqual(
    expect.arrayContaining([
      expect.stringContaining("Minimum budget exceeds"),
      expect.stringContaining("do not total 100%"),
    ]),
  );
  expect(result.budgetMin).toBe(900000);
  expect(result.weights?.affordability).toBe(30);
  expect(draft).toEqual(before);
});
it("does not treat partial weights as a complete numeric total", () => {
  const draft = {
    ...interpreted(),
    weights: { destination: 50, lifestyle: null, affordability: null },
    evidence: [...interpreted().evidence, { field: "weights", quote: "50%" }],
  };
  expect(
    validateInterpretation(draft, description + " 50%").ambiguities,
  ).toEqual([]);
});
it("retains all current values for an entirely unspecified draft without aliasing mutable arrays", () => {
  const draft = Object.fromEntries(
    Object.keys(interpreted()).map((key) => [
      key,
      ["evidence", "ambiguities", "unsupported"].includes(key) ? [] : null,
    ]),
  );
  const validated = validateInterpretation(draft, "I have not decided yet.");
  const result = draftProposal(samplePreference, validated);
  expect(result.preference).toEqual(samplePreference);
  result.preference.destinations[0].query = "Changed";
  expect(samplePreference.destinations[0].query).not.toBe("Changed");
  expect(result.proposed).toContain(
    "Frequent destinations: current form values retained",
  );
  expect(result.proposed).toContain(
    "Lifestyle preferences: current form values retained",
  );
});
it("discloses missing per-item defaults but never copies a previously selected destination", () => {
  const draft = {
    ...interpreted(),
    destinations: [{ query: "NTU", visits: null, mode: null }],
    lifestyles: [{ category: "Gym" as const, priority: null, radius: null }],
  };
  const result = draftProposal(samplePreference, draft);
  expect(result.preference.destinations[0]).toEqual({
    query: "NTU",
    visits: 5,
    mode: "public",
    location: null,
  });
  expect(result.proposed).toEqual(
    expect.arrayContaining([
      "NTU: proposed 5 visits/week",
      "NTU: proposed public transport",
      "Gym: proposed priority 3/5",
      "Gym: proposed 1000 m radius",
    ]),
  );
});
it("retains explicit per-item values and partial numeric weights instead of replacing them", () => {
  const draft = {
    ...interpreted(),
    name: "Explicit",
    budgetMin: 450000,
    lookbackMonths: 6,
    destinations: [{ query: "NTU", visits: 2, mode: "private" as const }],
    lifestyles: [{ category: "Gym" as const, priority: 5, radius: 800 }],
    weights: { destination: 60, lifestyle: null, affordability: 20 },
  };
  const result = draftProposal(samplePreference, draft);
  expect(result.preference).toMatchObject({
    name: "Explicit",
    budgetMin: 450000,
    lookbackMonths: 6,
    weights: {
      destination: 60,
      lifestyle: samplePreference.weights.lifestyle,
      affordability: 20,
    },
    lifestyles: [{ category: "Gym", priority: 5, radius: 800 }],
    destinations: [
      { query: "NTU", visits: 2, mode: "private", location: null },
    ],
  });
  expect(result.proposed.some((message) => message.includes("proposed"))).toBe(
    false,
  );
});
it("accepts explicit empty activities but does not silently change the current lifestyle weight", () => {
  const text = "I want no hobbies.";
  const draft = validateInterpretation(
    {
      ...interpreted(),
      category: null,
      budgetMax: null,
      flatTypes: null,
      destinations: null,
      lifestyles: [],
      evidence: [{ field: "lifestyles", quote: "no hobbies" }],
    },
    text,
  );
  const result = draftProposal(samplePreference, draft);
  expect(result.preference.lifestyles).toEqual([]);
  expect(result.preference.weights.lifestyle).toBe(
    samplePreference.weights.lifestyle,
  );
  expect(confirmedProfileSchema.safeParse(result.preference).success).toBe(
    false,
  );
});
