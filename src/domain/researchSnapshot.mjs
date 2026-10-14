import { z } from "zod";

export const lifestyleCategories = /** @type {const} */ ([
  "Badminton",
  "Parks",
  "Groceries",
  "Hawker centres",
  "Schools",
  "Healthcare",
  "Gym",
  "Basketball",
  "Football",
  "Swimming",
  "Tennis",
  "Fitness corners",
  "Running tracks",
]);
export const pointSchema = z.object({
  latitude: z.number().min(1.1).max(1.5),
  longitude: z.number().min(103.5).max(104.2),
});
export const areaSchema = pointSchema.extend({
  id: z.string(),
  name: z.string(),
  originLabel: z.string(),
});
export const facilitySchema = pointSchema.extend({
  name: z.string(),
  category: z.enum(lifestyleCategories),
  sportType: z.string().max(100).optional(),
});
export const snapshotSchema = z.object({
  id: z.string(),
  fetchedAt: z.iso.datetime(),
  sourceUrl: z.url(),
  sourceHash: z.string(),
  sourceUpdatedAt: z.iso.datetime({ offset: true }).optional(),
  latestMonth: z.string().regex(/^\d{4}-\d{2}$/),
  importedRows: z.number().int().positive(),
  supportedFacilities: z.array(z.string()),
  facilitySources: z.array(
    z.object({
      category: z.string(),
      theme: z.string(),
      updatedAt: z.iso.datetime({ offset: true }),
      maxAgeDays: z.number().int().positive().optional(),
      sourceUrl: z.url().optional(),
      coverage: z.string().optional(),
      partial: z.boolean().optional(),
      dateKind: z.enum(["updated", "retrieved"]).optional(),
    }),
  ),
  areas: z.array(areaSchema).min(1),
  facilities: z.array(facilitySchema),
  prices: z.array(
    z.object({
      town: z.string(),
      month: z.string().regex(/^\d{4}-\d{2}$/),
      flatType: z.string(),
      values: z.array(z.number().positive()),
    }),
  ),
});
