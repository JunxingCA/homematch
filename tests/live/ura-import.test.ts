import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
import { samplePreference } from "@/domain/fixtures";
import {
  privateSnapshotSchema,
  marketFiltersSchema,
} from "@/domain/marketEvidence.mjs";
import { privateCandidates } from "@/domain/marketRecommendations";
import { monthWindow } from "@/domain/recommendations";

// Optional integration check against the ignored, real URA import; no network or user writes.
it.skipIf(!existsSync(".cache/market/private.json"))(
  "real URA prices produce independently verified condo and landed candidate samples",
  async () => {
    const snapshot = privateSnapshotSchema.parse(
      JSON.parse(await readFile(".cache/market/private.json", "utf8")),
    );
    const window = monthWindow(new Date(), 12);
    const filters = marketFiltersSchema.parse({});
    for (const category of ["Condominium", "Private / landed"] as const) {
      const preference = { ...samplePreference, category };
      const { candidates } = privateCandidates(
        snapshot,
        preference,
        filters,
        window,
      );
      expect(candidates.length).toBeGreaterThan(0);
      for (const candidate of candidates) {
        const sample = snapshot.projects
          .flatMap((p) => p.transactions)
          .filter(
            (t) =>
              t.district === candidate.district &&
              t.month >= window.fromMonth &&
              t.month < window.toMonthExclusive &&
              (category === "Condominium"
                ? ["Apartment", "Condominium"].includes(t.propertyType)
                : [
                    "Detached",
                    "Semi-detached",
                    "Terrace",
                    "Strata Detached",
                    "Strata Semidetached",
                    "Strata Terrace",
                  ].includes(t.propertyType)),
          );
        expect(sample.length).toBeGreaterThanOrEqual(5);
        expect(candidate.prices.toSorted((a, b) => a - b)).toEqual(
          sample.map((t) => t.price).toSorted((a, b) => a - b),
        );
      }
      console.log(
        JSON.stringify({
          category,
          eligibleDistricts: candidates.length,
          matchingTransactions: candidates.reduce(
            (n, c) => n + c.prices.length,
            0,
          ),
          fromMonth: window.fromMonth,
          toMonthExclusive: window.toMonthExclusive,
        }),
      );
    }
  },
);
