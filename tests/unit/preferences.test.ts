import { describe, expect, it } from "vitest";
import {
  confirmedProfileSchema,
  editDestinationQuery,
  isSessionActive,
  profileSchema,
} from "@/domain/preferences";
import { fixtureLocations, samplePreference } from "@/domain/fixtures";

const profile = () => structuredClone(samplePreference);
describe("preference invariants", () => {
  it("accepts the valid manual fixture", () =>
    expect(confirmedProfileSchema.safeParse(profile()).success).toBe(true));
  it.each([0, 5])("rejects %i destinations", (count) => {
    const p = profile();
    p.destinations = Array.from({ length: count }, () =>
      structuredClone(p.destinations[0]),
    );
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("accepts four destinations", () => {
    const p = profile();
    p.destinations = Array.from({ length: 4 }, () =>
      structuredClone(p.destinations[0]),
    );
    expect(profileSchema.safeParse(p).success).toBe(true);
  });
  it("accepts no lifestyles with zero weight", () => {
    const p = profile();
    p.lifestyles = [];
    p.weights = { destination: 50, lifestyle: 0, affordability: 50 };
    expect(profileSchema.safeParse(p).success).toBe(true);
  });
  it("rejects no lifestyles with positive weight", () => {
    const p = profile();
    p.lifestyles = [];
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("accepts six unique lifestyles and rejects seven", () => {
    const p = profile();
    p.lifestyles = (
      [
        "Badminton",
        "Parks",
        "Groceries",
        "Hawker centres",
        "Schools",
        "Healthcare",
      ] as const
    ).map((category) => ({ category, priority: 3, radius: 1000 }));
    expect(profileSchema.safeParse(p).success).toBe(true);
    p.lifestyles.push(p.lifestyles[0]);
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects duplicate categories and flat types", () => {
    const p = profile();
    p.lifestyles.push(p.lifestyles[0]);
    p.flatTypes.push(p.flatTypes[0]);
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects inverted budgets", () => {
    const p = profile();
    p.budgetMin = p.budgetMax + 1;
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects weights not equal to 100", () => {
    const p = profile();
    p.weights.destination = 0;
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects unresolved confirmation but permits a draft", () => {
    const p = profile();
    p.destinations[0].location = null;
    expect(profileSchema.safeParse(p).success).toBe(true);
    expect(confirmedProfileSchema.safeParse(p).success).toBe(false);
  });
  it("invalidates geocoding when query changes", () => {
    const d = profile().destinations[0];
    expect(editDestinationQuery(d, d.query).location).toEqual(d.location);
    expect(editDestinationQuery(d, "Different place").location).toBeNull();
  });
  it("rejects a query that no longer matches its selected location", () => {
    const p = profile();
    p.destinations[0].query = "Different place";
    expect(confirmedProfileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects mass-assigned ownership and confirmation", () =>
    expect(
      profileSchema.safeParse({
        ...profile(),
        userId: "other",
        confirmed: true,
      }).success,
    ).toBe(false));
  it("rejects out-of-Singapore coordinates", () => {
    const p = profile();
    p.destinations[0].location = { ...fixtureLocations[0], latitude: 50 };
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
  it("rejects bad visits, radius and fractional weights", () => {
    const p = profile();
    p.destinations[0].visits = 0;
    p.lifestyles[0].radius = -1;
    p.weights.destination = 40.5;
    expect(profileSchema.safeParse(p).success).toBe(false);
  });
});
describe("30-minute idle boundary", () => {
  it("accepts recent activity", () =>
    expect(isSessionActive(1000, 1001)).toBe(true));
  it("rejects exactly 30 minutes", () =>
    expect(isSessionActive(1000, 1000 + 30 * 60_000)).toBe(false));
  it("rejects invalid and future values", () => {
    expect(isSessionActive(NaN, 1000)).toBe(false);
    expect(isSessionActive(2000, 1000)).toBe(false);
  });
});
