import { z } from "zod";
import { areaSchema } from "./recommendations";
import { mapFacilitiesSchema } from "./mapFacilities";

export const explorationInput = z
  .object({
    profileId: z.uuid(),
    revision: z.number().int().positive(),
    areaId: z.string().min(1).max(100),
    radius: z.number().int().min(100).max(5000).default(1000),
    includeRoutes: z.boolean().default(false),
  })
  .strict();
export const explorationCatalogueSchema = z.object({
  snapshotId: z.string(),
  fetchedAt: z.iso.datetime(),
  areas: z.array(areaSchema).min(1),
});
const coordinate = z.tuple([
  z.number().finite().min(-90).max(90),
  z.number().finite().min(-180).max(180),
]);
export const explorationDetailsSchema = z.object({
  profileId: z.uuid(),
  profileRevision: z.number().int().positive(),
  category: z.enum(["BTO", "Condominium", "Private / landed"]),
  facilities: mapFacilitiesSchema,
  journeys: z
    .object({
      departure: z.string().datetime({ offset: true }),
      fetchedAt: z.iso.datetime(),
      routes: z
        .array(
          z.object({
            destination: z.string(),
            visits: z.number().int().positive(),
            mode: z.enum(["public", "private"]),
            minutes: z.number().finite().nonnegative(),
            metres: z.number().finite().nonnegative(),
            geometry: z.array(z.array(coordinate).min(1)).min(1),
          }),
        )
        .min(1)
        .max(4),
    })
    .nullable(),
});
export type ExplorationCatalogue = z.infer<typeof explorationCatalogueSchema>;
export type ExplorationDetails = z.infer<typeof explorationDetailsSchema>;

export function routeDeparture(now: Date) {
  return (
    new Date(now.getTime() + 86400000 + 8 * 3600000)
      .toISOString()
      .slice(0, 10) + "T08:00:00+08:00"
  );
}
