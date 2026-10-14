import { z } from "zod";
import { lifestyleCategories } from "./preferences";
import {
  areaSchema,
  facilitySchema,
  geographicMetres,
  type ResearchSnapshot,
  type Area,
} from "./recommendations";

export const mapFacilityQuery = z
  .object({
    areaId: z.string().min(1).max(100),
    radius: z.coerce.number().int().min(100).max(5000).default(1000),
  })
  .strict();
const sourceSchema = z.object({
  category: z.string(),
  updatedAt: z.iso.datetime({ offset: true }),
  sourceUrl: z.url().optional(),
  coverage: z.string().optional(),
  partial: z.boolean().optional(),
});
export const mapFacilitiesSchema = z.object({
  snapshotId: z.string(),
  fetchedAt: z.iso.datetime(),
  origin: areaSchema,
  radius: z.number().int().min(100).max(5000),
  layers: z.array(
    z.object({
      category: z.enum(lifestyleCategories),
      available: z.boolean(),
      count: z.number().int().nonnegative(),
      truncated: z.boolean(),
      source: sourceSchema.nullable(),
      facilities: z
        .array(facilitySchema.extend({ metres: z.number().nonnegative() }))
        .max(100),
    }),
  ),
});
export type MapFacilities = z.infer<typeof mapFacilitiesSchema>;

export function facilitiesNear(
  snapshot: ResearchSnapshot,
  origin: Area,
  radius: number,
): MapFacilities {
  const checkedRadius = mapFacilityQuery.shape.radius.parse(radius);
  return {
    snapshotId: snapshot.id,
    fetchedAt: snapshot.fetchedAt,
    origin,
    radius: checkedRadius,
    layers: lifestyleCategories.map((category) => {
      const source =
        snapshot.facilitySources.find((s) => s.category === category) ?? null;
      const available =
        snapshot.supportedFacilities.includes(category) && source !== null;
      const points = available
        ? snapshot.facilities
            .filter((f) => f.category === category)
            .map((f) => ({ ...f, metres: geographicMetres(origin, f) }))
            .filter((f) => f.metres <= checkedRadius)
            .sort((a, b) => a.metres - b.metres || a.name.localeCompare(b.name))
        : [];
      return {
        category,
        available,
        count: points.length,
        truncated: points.length > 100,
        source,
        facilities: points.slice(0, 100),
      };
    }),
  };
}
