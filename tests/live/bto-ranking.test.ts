import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import catalogueJson from "../../data/bto-2026-06.json";
import {
  btoCatalogueSchema,
  marketFiltersSchema,
} from "../../src/domain/marketEvidence.mjs";
import {
  btoCandidates,
  scoreMarketCandidate,
} from "../../src/domain/marketRecommendations";
import { snapshotSchema } from "../../src/domain/recommendations";
import { routeDeparture } from "../../src/domain/exploration";
import type { Preference } from "../../src/domain/preferences";
vi.mock("server-only", () => ({}));
import { OneMapRoutingAdapter } from "../../src/server/adapters/OneMapRoutingAdapter";
it("ranks real archived BTO ranges with a live public snapshot and OneMap journeys, without user writes", async () => {
  const client = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client
    .from("research_snapshots")
    .select("payload")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw Error("Public research snapshot unavailable");
  const snapshot = snapshotSchema.parse(data.payload);
  const label = "JURONG EAST MRT STATION";
  const preference: Preference = {
    name: "Read-only BTO smoke test",
    category: "BTO",
    budgetMin: 300000,
    budgetMax: 700000,
    flatTypes: ["4-room"],
    lookbackMonths: 12,
    weights: { destination: 40, lifestyle: 30, affordability: 30 },
    lifestyles: [{ category: "Parks", radius: 1000, priority: 3 }],
    destinations: [
      {
        query: label,
        location: {
          id: "public-test",
          label,
          latitude: 1.333,
          longitude: 103.742,
          source: "onemap",
        },
        mode: "public",
        visits: 5,
      },
    ],
  };
  const filters = marketFiltersSchema.parse({ includeClosedLaunches: true });
  const { candidates } = btoCandidates(
    btoCatalogueSchema.parse(catalogueJson),
    snapshot.areas,
    preference,
    filters,
    "2026-10-14",
  );
  expect(candidates).toHaveLength(7);
  const router = new OneMapRoutingAdapter(),
    results = [];
  for (const candidate of candidates) {
    const route = await router.route(
      candidate.area,
      preference.destinations[0],
      routeDeparture(new Date()),
      AbortSignal.timeout(20000),
    );
    expect(route.geometry.length).toBeGreaterThan(0);
    results.push(
      scoreMarketCandidate(
        candidate,
        preference,
        filters,
        [route],
        snapshot.facilities,
      ),
    );
  }
  expect(
    results.every(
      (r) =>
        Number.isFinite(r.overall) &&
        r.transactions === 0 &&
        r.priceEvidence?.kind === "bto-range",
    ),
  ).toBe(true);
  console.log(
    JSON.stringify({
      event: "live_bto_read_only_verified",
      projects: results.length,
      destinations: "public MRT landmark only",
      writes: 0,
    }),
  );
}, 120000);
