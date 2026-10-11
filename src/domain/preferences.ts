import { z } from "zod";

export const LIMITS = {
  profiles: 4,
  destinations: 4,
  lifestyles: 6,
  idleMinutes: 30,
} as const;
export const categories = [
  "BTO",
  "Resale HDB",
  "Condominium",
  "Private / landed",
] as const;
export const flatTypes = [
  "2-room",
  "3-room",
  "4-room",
  "5-room",
  "Executive",
] as const;
export const lifestyleCategories = [
  "Badminton",
  "Parks",
  "Groceries",
  "Hawker centres",
  "Schools",
  "Healthcare",
] as const;

export const locationSchema = z
  .object({
    id: z.string().min(1).max(120),
    label: z.string().min(1).max(250),
    latitude: z.number().min(1.1).max(1.5),
    longitude: z.number().min(103.5).max(104.2),
    source: z.enum(["fixture", "onemap"]),
  })
  .strict();
export type Location = z.infer<typeof locationSchema>;
export const destinationSchema = z
  .object({
    query: z.string().trim().min(1).max(250),
    location: locationSchema.nullable(),
    visits: z.number().int().min(1).max(21),
    mode: z.enum(["public", "private"]),
  })
  .strict();
export const lifestyleSchema = z
  .object({
    category: z.enum(lifestyleCategories),
    priority: z.number().int().min(1).max(5),
    radius: z.number().int().min(100).max(5000),
  })
  .strict();
export const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Give your profile a name.").max(60),
    category: z.enum(categories),
    budgetMin: z.number().int().min(0).max(20000000),
    budgetMax: z.number().int().min(1).max(20000000),
    flatTypes: z.array(z.enum(flatTypes)).min(1).max(5),
    lookbackMonths: z.number().int().min(1).max(60),
    weights: z
      .object({
        destination: z.number().int().min(0).max(100),
        lifestyle: z.number().int().min(0).max(100),
        affordability: z.number().int().min(0).max(100),
      })
      .strict(),
    destinations: z.array(destinationSchema).min(1).max(LIMITS.destinations),
    lifestyles: z.array(lifestyleSchema).max(LIMITS.lifestyles),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.budgetMin > value.budgetMax)
      ctx.addIssue({
        code: "custom",
        path: ["budgetMax"],
        message: "Maximum budget must be at least the minimum.",
      });
    if (Object.values(value.weights).reduce((a, b) => a + b, 0) !== 100)
      ctx.addIssue({
        code: "custom",
        path: ["weights"],
        message: "Priority weights must add up to 100%.",
      });
    if (!value.lifestyles.length && value.weights.lifestyle !== 0)
      ctx.addIssue({
        code: "custom",
        path: ["weights", "lifestyle"],
        message:
          "Set lifestyle weight to 0% when no lifestyle preferences are selected.",
      });
    if (new Set(value.flatTypes).size !== value.flatTypes.length)
      ctx.addIssue({
        code: "custom",
        path: ["flatTypes"],
        message: "Choose each flat type once.",
      });
    if (
      new Set(value.lifestyles.map((x) => x.category)).size !==
      value.lifestyles.length
    )
      ctx.addIssue({
        code: "custom",
        path: ["lifestyles"],
        message: "Choose each lifestyle category once.",
      });
  });
export type Preference = z.infer<typeof profileSchema>;
export type Profile = {
  id: string;
  revision: number;
  confirmed: boolean;
  updatedAt: string;
  preference: Preference;
};

export const confirmedProfileSchema = profileSchema.superRefine(
  (value, ctx) => {
    value.destinations.forEach((d, i) => {
      if (!d.location || d.query !== d.location.label)
        ctx.addIssue({
          code: "custom",
          path: ["destinations", i, "location"],
          message: "Select a location match for every destination.",
        });
    });
  },
);

export function editDestinationQuery(
  destination: Preference["destinations"][number],
  query: string,
) {
  return {
    ...destination,
    query,
    location:
      query === destination.location?.label ? destination.location : null,
  };
}

export function isSessionActive(lastActivity: number, now: number): boolean {
  return (
    Number.isFinite(lastActivity) &&
    lastActivity <= now &&
    now - lastActivity < LIMITS.idleMinutes * 60_000
  );
}
