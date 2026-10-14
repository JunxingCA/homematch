import { createClient } from "@supabase/supabase-js";
import { expect, it, vi } from "vitest";
import { snapshotSchema } from "../../src/domain/recommendations";
import {
  facilitiesNear,
  mapFacilitiesSchema,
} from "../../src/domain/mapFacilities";
import {
  explorationCatalogueSchema,
  routeDeparture,
} from "../../src/domain/exploration";
vi.mock("server-only", () => ({}));
import { OneMapRoutingAdapter } from "../../src/server/adapters/OneMapRoutingAdapter";
async function publicSnapshot() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error(
      "Load the local environment for this opt-in public-data check.",
    );
  const client = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  );
  const { data, error } = await client
    .from("research_snapshots")
    .select("payload")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  if (error) throw Error(`Public snapshot read failed (${error.code})`);
  return snapshotSchema.parse(data.payload);
}
it("validates live town exploration and amenities without reading or writing any user account", async () => {
  const snapshot = await publicSnapshot();
  const catalogue = explorationCatalogueSchema.parse({
    snapshotId: snapshot.id,
    fetchedAt: snapshot.fetchedAt,
    areas: snapshot.areas,
  });
  expect(catalogue.areas.length).toBeGreaterThan(20);
  const area = catalogue.areas.find((a) => a.id === "bedok")!;
  expect(area).toBeTruthy();
  const facilities = mapFacilitiesSchema.parse(
    facilitiesNear(snapshot, area, 5000),
  );
  for (const category of [
    "Gym",
    "Basketball",
    "Football",
    "Schools",
    "Healthcare",
    "Parks",
  ])
    expect(
      facilities.layers.find((layer) => layer.category === category)?.available,
    ).toBe(true);
  expect(facilities.layers.some((layer) => layer.count > 0)).toBe(true);
  expect(catalogue).not.toHaveProperty("prices");
});
it("requests a real OneMap journey between public fixture landmarks without saving private research", async () => {
  if (!process.env.ONEMAP_TOKEN)
    throw Error("OneMap token is required for this opt-in routing check.");
  const snapshot = await publicSnapshot();
  const area = snapshot.areas.find((a) => a.id === "bedok")!;
  const route = await new OneMapRoutingAdapter().route(
    area,
    {
      query: "NANYANG TECHNOLOGICAL UNIVERSITY",
      visits: 5,
      mode: "public",
      location: {
        id: "public-landmark-test",
        label: "NANYANG TECHNOLOGICAL UNIVERSITY",
        latitude: 1.3483,
        longitude: 103.6831,
        source: "onemap",
      },
    },
    routeDeparture(new Date()),
    AbortSignal.timeout(20000),
  );
  expect(route.minutes).toBeGreaterThan(0);
  expect(route.metres).toBeGreaterThan(0);
  expect(route.geometry.length).toBeGreaterThan(0);
});
