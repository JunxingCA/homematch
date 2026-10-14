import type { z } from "zod";
export type MarketFilters = {
  includeClosedLaunches: boolean;
  minAreaSqm: number;
  maxAreaSqm: number;
  areaType: "Any" | "Strata" | "Land";
  saleType: "Any" | "1" | "2" | "3";
};
export type BtoRange = {
  flatType: "2-room" | "3-room" | "4-room" | "5-room";
  min: number;
  max: number;
};
export type BtoCatalogue = {
  version: 1;
  kind: "bto";
  id: string;
  sourceUrl: string;
  publishedOn: string;
  applicationOpens: string;
  applicationCloses: string;
  launch: string;
  projects: {
    id: string;
    name: string;
    town: string;
    classification: "Standard" | "Plus" | "Prime";
    waitingMonths: string;
    ranges: BtoRange[];
  }[];
};
export type PrivateTransaction = {
  month: string;
  district: string;
  propertyType: string;
  price: number;
  areaSqm: number;
  areaType: "Strata" | "Land" | "Unknown";
  saleType: "1" | "2" | "3";
};
export type PrivateSnapshot = {
  version: 1;
  kind: "private";
  id: string;
  fetchedAt: string;
  sourceUrl: string;
  latestMonth: string;
  batches: [1, 2, 3, 4];
  skippedMultiUnit: number;
  skippedCoordinates: number;
  projects: {
    name: string;
    street: string;
    latitude: number;
    longitude: number;
    transactions: PrivateTransaction[];
  }[];
};
export const marketFiltersSchema: z.ZodType<MarketFilters, unknown>;
export const btoCatalogueSchema: z.ZodType<BtoCatalogue>;
export const privateSnapshotSchema: z.ZodType<PrivateSnapshot>;
export const uraTypes: string[];
export function svy21Point(
  x: string | number,
  y: string | number,
): { latitude: number; longitude: number };
export function normaliseUra(
  batches: unknown[],
  fetchedAt: string,
  id: string,
): PrivateSnapshot;
