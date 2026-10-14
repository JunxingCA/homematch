import { createClient } from "@supabase/supabase-js";
import { expect, it } from "vitest";
import {
  snapshotSchema,
  scoreArea,
  pricesFor,
  monthWindow,
} from "../../src/domain/recommendations";
import { lifestyleCategories, LIMITS } from "../../src/domain/preferences";
import { samplePreference } from "../../src/domain/fixtures";

it("reads and validates the published public research snapshot without account writes", async () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw Error(
      "Run this opt-in check with the local server environment loaded.",
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
  const snapshot = snapshotSchema.parse(data.payload);
  expect([...snapshot.supportedFacilities].sort()).toEqual(
    [...lifestyleCategories].sort(),
  );
  expect(
    snapshot.facilitySources.find((s) => s.category === "Groceries")?.partial,
  ).toBe(true);
  expect(
    snapshot.facilitySources.find((s) => s.category === "Groceries")?.dateKind,
  ).toBe("retrieved");
  expect(
    snapshot.facilitySources.find((s) => s.category === "Healthcare")?.coverage,
  ).toContain("hospital locations only");
  expect(
    snapshot.facilities.filter((f) => f.category === "Schools").length,
  ).toBeGreaterThan(300);
  const preference = {
    ...structuredClone(samplePreference),
    lifestyles: lifestyleCategories
      .slice(0, LIMITS.lifestyles)
      .map((category) => ({
        category,
        radius: 5000,
        priority: 3,
      })),
  };
  const area = snapshot.areas.find((a) => a.name === "BEDOK")!;
  const prices = pricesFor(
    snapshot,
    area,
    preference,
    monthWindow(new Date(), 12),
  );
  // Fixed route input isolates the live amenity/price integration, not live routing.
  const result = scoreArea(
    area,
    preference,
    prices,
    [
      {
        destination: preference.destinations[0].location!.label,
        visits: preference.destinations[0].visits,
        mode: preference.destinations[0].mode,
        minutes: 45,
        metres: 10000,
        geometry: [],
      },
    ],
    snapshot.facilities,
  );
  expect(result.amenities).toHaveLength(6);
  expect(Number.isFinite(result.overall)).toBe(true);
  for (const category of ["Schools", "Healthcare", "Groceries"]) {
    expect(snapshot.facilities.some((f) => f.category === category)).toBe(true);
    const amenity = result.amenities.find((a) => a.category === category)!;
    if (amenity.count === 0) {
      expect(amenity.nearest).toBeNull();
      expect(amenity.score).toBe(0);
    } else {
      expect(amenity.nearest?.category).toBe(category);
      expect(amenity.nearest!.metres).toBeLessThanOrEqual(5000);
    }
  }
  for (const category of lifestyleCategories.slice(LIMITS.lifestyles)) {
    const sportsResult = scoreArea(
      area,
      { ...preference, lifestyles: [{ category, radius: 5000, priority: 3 }] },
      prices,
      result.routes,
      snapshot.facilities,
    );
    expect(snapshot.facilities.some((f) => f.category === category)).toBe(true);
    expect(sportsResult.amenities[0].category).toBe(category);
    expect(Number.isFinite(sportsResult.overall)).toBe(true);
  }
});
