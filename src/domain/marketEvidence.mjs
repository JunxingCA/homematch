import { z } from "zod";
import proj4 from "proj4";

const month = z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/);
const point = z.object({
  latitude: z.number().min(1.1).max(1.5),
  longitude: z.number().min(103.5).max(104.2),
});
const officialUrl = (host) =>
  z.url().refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === host &&
      !url.username &&
      !url.password
    );
  });
export const uraTypes = [
  "Condominium",
  "Apartment",
  "Executive Condominium",
  "Detached",
  "Semi-detached",
  "Terrace",
  "Strata Detached",
  "Strata Semidetached",
  "Strata Terrace",
];
export const marketFiltersSchema = z
  .object({
    includeClosedLaunches: z.boolean().default(false),
    minAreaSqm: z.number().min(0).max(20000).default(0),
    maxAreaSqm: z.number().positive().max(20000).default(20000),
    areaType: z.enum(["Any", "Strata", "Land"]).default("Any"),
    saleType: z.enum(["Any", "1", "2", "3"]).default("Any"),
  })
  .strict()
  .refine(
    (v) => v.minAreaSqm <= v.maxAreaSqm,
    "Maximum area must be at least the minimum.",
  );
const range = z
  .object({
    flatType: z.enum(["2-room", "3-room", "4-room", "5-room"]),
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  })
  .strict()
  .refine((v) => v.min <= v.max);
export const btoCatalogueSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("bto"),
    id: z.string().min(1),
    sourceUrl: officialUrl("www.hdb.gov.sg"),
    publishedOn: z.iso.date(),
    applicationOpens: z.iso.date(),
    applicationCloses: z.iso.date(),
    launch: month,
    projects: z
      .array(
        z
          .object({
            id: z.string().min(1).max(100),
            name: z.string().min(1),
            town: z.string().min(1),
            classification: z.enum(["Standard", "Plus", "Prime"]),
            waitingMonths: z.string().min(1),
            ranges: z.array(range).min(1),
          })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict()
  .refine(
    (v) =>
      v.applicationOpens <= v.applicationCloses &&
      new Set(v.projects.map((p) => p.id)).size === v.projects.length,
  );
const transaction = z
  .object({
    month,
    district: z.string().regex(/^(0[1-9]|1\d|2[0-8])$/),
    propertyType: z.enum(uraTypes),
    price: z.number().positive().max(1000000000),
    areaSqm: z.number().positive().max(1000000),
    areaType: z.enum(["Strata", "Land", "Unknown"]),
    saleType: z.enum(["1", "2", "3"]),
  })
  .strict();
export const privateSnapshotSchema = z
  .object({
    version: z.literal(1),
    kind: z.literal("private"),
    id: z.string().min(1),
    fetchedAt: z.iso.datetime(),
    sourceUrl: officialUrl("eservice.ura.gov.sg"),
    latestMonth: month,
    batches: z.tuple([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    skippedMultiUnit: z.number().int().nonnegative(),
    skippedCoordinates: z.number().int().nonnegative(),
    projects: z
      .array(
        point
          .extend({
            name: z.string().min(1),
            street: z.string(),
            transactions: z.array(transaction).min(1),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const svy21 =
  "+proj=tmerc +lat_0=1.36666666666667 +lon_0=103.833333333333 +k=1 +x_0=28001.642 +y_0=38744.572 +datum=WGS84 +units=m +no_defs";
export function svy21Point(x, y) {
  if (
    !Number.isFinite(Number(x)) ||
    !Number.isFinite(Number(y)) ||
    !String(x).trim() ||
    !String(y).trim()
  )
    throw Error("Invalid SVY21 point");
  const [longitude, latitude] = proj4(svy21, "EPSG:4326", [
    Number(x),
    Number(y),
  ]);
  return point.parse({ latitude, longitude });
}
export function normaliseUra(batches, fetchedAt, id) {
  if (batches.length !== 4) throw Error("All four URA batches are required");
  const projects = [];
  let skippedMultiUnit = 0,
    skippedCoordinates = 0;
  const latest = [];
  for (const [batchIndex, batch] of batches.entries()) {
    const envelope = z
      .object({
        Status: z.literal("Success"),
        Result: z.array(
          z.object({
            project: z.string().min(1),
            street: z.string(),
            x: z.union([z.string(), z.number()]).nullish(),
            y: z.union([z.string(), z.number()]).nullish(),
            transaction: z.array(
              z.object({
                contractDate: z.string().regex(/^(0[1-9]|1[0-2])\d{2}$/),
                district: z.string(),
                propertyType: z.string(),
                price: z.string(),
                area: z.string(),
                typeOfArea: z.string(),
                typeOfSale: z.string(),
                noOfUnits: z.string(),
              }),
            ),
          }),
        ),
      })
      .parse(batch);
    for (const project of envelope.Result) {
      let coordinates;
      try {
        coordinates = svy21Point(project.x, project.y);
      } catch {
        skippedCoordinates += project.transaction.length;
        continue;
      }
      const transactions = [];
      for (const row of project.transaction) {
        const units = Number(row.noOfUnits);
        if (!Number.isInteger(units) || units < 1)
          throw Error("Invalid URA unit count");
        if (units !== 1) {
          skippedMultiUnit++;
          continue;
        }
        const record = transaction.parse({
          month: `20${row.contractDate.slice(2)}-${row.contractDate.slice(0, 2)}`,
          district: row.district,
          // Live URA uses a hyphenated label; retain the documented internal category.
          propertyType:
            row.propertyType === "Strata Semi-detached"
              ? "Strata Semidetached"
              : row.propertyType,
          price: Number(row.price),
          areaSqm: Number(row.area),
          areaType: row.typeOfArea,
          saleType: row.typeOfSale,
        });
        if (Math.floor((Number(record.district) - 1) / 7) !== batchIndex)
          throw Error("Unexpected district in URA batch");
        if (record.month > fetchedAt.slice(0, 7))
          throw Error("Future URA transaction");
        latest.push(record.month);
        // Keep repeated indistinguishable transactions: separate units can share these public attributes.
        transactions.push(record);
      }
      if (transactions.length)
        projects.push({
          name: project.project,
          street: project.street,
          ...coordinates,
          transactions,
        });
    }
  }
  return privateSnapshotSchema.parse({
    version: 1,
    kind: "private",
    id,
    fetchedAt,
    sourceUrl:
      "https://eservice.ura.gov.sg/maps/api/#private-residential-property",
    latestMonth: latest.sort().at(-1),
    batches: [1, 2, 3, 4],
    skippedMultiUnit,
    skippedCoordinates,
    projects,
  });
}
