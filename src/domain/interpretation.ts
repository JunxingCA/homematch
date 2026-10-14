import { z } from "zod";
import {
  categories,
  flatTypes,
  lifestyleCategories,
  type Preference,
  type Location,
} from "./preferences";
export const draftFields = [
  "name",
  "category",
  "budgetMin",
  "budgetMax",
  "flatTypes",
  "lookbackMonths",
  "destinations",
  "lifestyles",
  "weights",
] as const;
export const fieldLabels: Record<(typeof draftFields)[number], string> = {
  name: "Profile name",
  category: "Property type",
  budgetMin: "Minimum budget (SGD)",
  budgetMax: "Maximum budget (SGD)",
  flatTypes: "Flat types",
  lookbackMonths: "Complete months of price evidence",
  destinations: "Frequent destinations",
  lifestyles: "Lifestyle preferences",
  weights: "Journey / lifestyle / budget weights",
};
const integer = (min: number, max: number) =>
  z.number().int().min(min).max(max).nullable();
export const interpretationSchema = z
  .object({
    name: z.string().min(1).max(60).nullable(),
    category: z.enum(categories).nullable(),
    budgetMin: integer(0, 20000000),
    budgetMax: integer(1, 20000000),
    flatTypes: z.array(z.enum(flatTypes)).max(5).nullable(),
    lookbackMonths: integer(1, 60),
    destinations: z
      .array(
        z
          .object({
            query: z.string().min(2).max(250),
            visits: integer(1, 21).describe(
              "Weekly visits, or null when unstated/out of range. Keep the named destination even when this is null.",
            ),
            mode: z
              .enum(["public", "private"])
              .nullable()
              .describe(
                "Explicit travel mode, or null when unstated. Do not discard the destination.",
              ),
          })
          .strict(),
      )
      .max(4)
      .nullable(),
    lifestyles: z
      .array(
        z
          .object({
            category: z.enum(lifestyleCategories),
            priority: integer(1, 5).describe(
              "Explicit priority, or null when unstated/out of range; retain the mentioned category.",
            ),
            radius: integer(100, 5000).describe(
              "Explicit distance in metres, or null when unstated/out of range; retain the mentioned category.",
            ),
          })
          .strict(),
      )
      .max(6)
      .nullable()
      .describe(
        "All mentioned supported activities, with null missing numeric fields. Null only if none were mentioned; [] only for an explicit request for no activities. Missing numbers are not unsupported filters.",
      ),
    weights: z
      .object({
        destination: integer(0, 100),
        lifestyle: integer(0, 100),
        affordability: integer(0, 100),
      })
      .strict()
      .nullable(),
    ambiguities: z.array(z.string().min(1).max(300)).max(12),
    unsupported: z
      .array(z.string().min(1).max(200))
      .max(12)
      .describe(
        "Only explicitly requested unsupported requirements. MRT travel, named destinations, supported sports and missing numeric details are not unsupported. Do not invent requests.",
      ),
    evidence: z
      .array(
        z
          .object({
            field: z.enum(draftFields),
            quote: z.string().min(1).max(300),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type Interpretation = z.infer<typeof interpretationSchema>;
export type InterpretationResult = {
  draft: Interpretation;
  model: string;
  locations: { query: string; candidates: Location[]; error: string | null }[];
};
export const interpretationRequest = z
  .object({
    text: z.string().trim().min(10).max(4000),
    consent: z.literal(true),
  })
  .strict();

export function validateInterpretation(
  input: unknown,
  text: string,
): Interpretation {
  const draft = interpretationSchema.parse(input);
  for (const field of draftFields) {
    if (
      draft[field] !== null &&
      !draft.evidence.some((e) => e.field === field && text.includes(e.quote))
    )
      throw Error("Extracted field lacks a verbatim source quote");
  }
  if (draft.evidence.some((e) => !text.includes(e.quote)))
    throw Error("Invented source quotation");
  if (
    draft.flatTypes &&
    new Set(draft.flatTypes).size !== draft.flatTypes.length
  )
    throw Error("Repeated flat type");
  if (
    draft.lifestyles &&
    new Set(draft.lifestyles.map((l) => l.category)).size !==
      draft.lifestyles.length
  )
    throw Error("Repeated lifestyle category");
  if (
    draft.destinations &&
    new Set(draft.destinations.map((d) => d.query.toLowerCase())).size !==
      draft.destinations.length
  )
    throw Error("Repeated destination");
  if (
    draft.budgetMin !== null &&
    draft.budgetMax !== null &&
    draft.budgetMin > draft.budgetMax
  )
    draft.ambiguities = [
      ...draft.ambiguities,
      "Minimum budget exceeds maximum budget; review both values.",
    ].slice(-12);
  if (
    draft.weights &&
    Object.values(draft.weights).every((value) => value !== null) &&
    Object.values(draft.weights).reduce<number>(
      (total, value) => total + (value ?? 0),
      0,
    ) !== 100
  )
    draft.ambiguities = [
      ...draft.ambiguities,
      "The stated numeric weights do not total 100%; review them.",
    ].slice(-12);
  return draft;
}

export function draftProposal(base: Preference, draft: Interpretation) {
  const preference = structuredClone(base);
  const proposed: string[] = [];
  for (const field of [
    "name",
    "category",
    "budgetMin",
    "budgetMax",
    "flatTypes",
    "lookbackMonths",
  ] as const) {
    if (draft[field] === null)
      proposed.push(
        `${fieldLabels[field]}: current form value retained (${Array.isArray(base[field]) ? base[field].join(", ") : base[field]})`,
      );
  }
  preference.name = draft.name ?? base.name;
  preference.category = draft.category ?? base.category;
  preference.budgetMin = draft.budgetMin ?? base.budgetMin;
  preference.budgetMax = draft.budgetMax ?? base.budgetMax;
  preference.flatTypes = draft.flatTypes ?? base.flatTypes;
  preference.lookbackMonths = draft.lookbackMonths ?? base.lookbackMonths;
  if (draft.destinations === null)
    proposed.push("Frequent destinations: current form values retained");
  else
    preference.destinations = draft.destinations.map((d) => {
      if (d.visits === null)
        proposed.push(`${d.query}: proposed 5 visits/week`);
      if (d.mode === null)
        proposed.push(`${d.query}: proposed public transport`);
      return {
        query: d.query,
        visits: d.visits ?? 5,
        mode: d.mode ?? "public",
        location: null,
      };
    });
  if (draft.lifestyles === null)
    proposed.push("Lifestyle preferences: current form values retained");
  else
    preference.lifestyles = draft.lifestyles.map((l) => {
      if (l.priority === null)
        proposed.push(`${l.category}: proposed priority 3/5`);
      if (l.radius === null)
        proposed.push(`${l.category}: proposed 1000 m radius`);
      return {
        category: l.category,
        priority: l.priority ?? 3,
        radius: l.radius ?? 1000,
      };
    });
  for (const key of ["destination", "lifestyle", "affordability"] as const) {
    if (draft.weights?.[key] == null)
      proposed.push(`${key} weight: current ${base.weights[key]}% retained`);
    preference.weights[key] = draft.weights?.[key] ?? base.weights[key];
  }
  return { preference, proposed };
}
