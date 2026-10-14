export const lifestyleCategories: readonly [
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
];
export const pointSchema: z.ZodObject<
  {
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
  },
  z.core.$strip
>;
export const areaSchema: z.ZodObject<
  {
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    id: z.ZodString;
    name: z.ZodString;
    originLabel: z.ZodString;
  },
  z.core.$strip
>;
export const facilitySchema: z.ZodObject<
  {
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
    name: z.ZodString;
    category: z.ZodEnum<{
      Badminton: "Badminton";
      Parks: "Parks";
      Groceries: "Groceries";
      "Hawker centres": "Hawker centres";
      Schools: "Schools";
      Healthcare: "Healthcare";
      Gym: "Gym";
      Basketball: "Basketball";
      Football: "Football";
      Swimming: "Swimming";
      Tennis: "Tennis";
      "Fitness corners": "Fitness corners";
      "Running tracks": "Running tracks";
    }>;
    sportType: z.ZodOptional<z.ZodString>;
  },
  z.core.$strip
>;
export const snapshotSchema: z.ZodObject<
  {
    id: z.ZodString;
    fetchedAt: z.ZodISODateTime;
    sourceUrl: z.ZodURL;
    sourceHash: z.ZodString;
    sourceUpdatedAt: z.ZodOptional<z.ZodISODateTime>;
    latestMonth: z.ZodString;
    importedRows: z.ZodNumber;
    supportedFacilities: z.ZodArray<z.ZodString>;
    facilitySources: z.ZodArray<
      z.ZodObject<
        {
          category: z.ZodString;
          theme: z.ZodString;
          updatedAt: z.ZodISODateTime;
          maxAgeDays: z.ZodOptional<z.ZodNumber>;
          sourceUrl: z.ZodOptional<z.ZodURL>;
          coverage: z.ZodOptional<z.ZodString>;
          partial: z.ZodOptional<z.ZodBoolean>;
          dateKind: z.ZodOptional<
            z.ZodEnum<{
              updated: "updated";
              retrieved: "retrieved";
            }>
          >;
        },
        z.core.$strip
      >
    >;
    areas: z.ZodArray<
      z.ZodObject<
        {
          latitude: z.ZodNumber;
          longitude: z.ZodNumber;
          id: z.ZodString;
          name: z.ZodString;
          originLabel: z.ZodString;
        },
        z.core.$strip
      >
    >;
    facilities: z.ZodArray<
      z.ZodObject<
        {
          latitude: z.ZodNumber;
          longitude: z.ZodNumber;
          name: z.ZodString;
          category: z.ZodEnum<{
            Badminton: "Badminton";
            Parks: "Parks";
            Groceries: "Groceries";
            "Hawker centres": "Hawker centres";
            Schools: "Schools";
            Healthcare: "Healthcare";
            Gym: "Gym";
            Basketball: "Basketball";
            Football: "Football";
            Swimming: "Swimming";
            Tennis: "Tennis";
            "Fitness corners": "Fitness corners";
            "Running tracks": "Running tracks";
          }>;
          sportType: z.ZodOptional<z.ZodString>;
        },
        z.core.$strip
      >
    >;
    prices: z.ZodArray<
      z.ZodObject<
        {
          town: z.ZodString;
          month: z.ZodString;
          flatType: z.ZodString;
          values: z.ZodArray<z.ZodNumber>;
        },
        z.core.$strip
      >
    >;
  },
  z.core.$strip
>;
import { z } from "zod";
