import { describe, expect, it } from "vitest";
import { applyPreset } from "@/components/lights/presets";
import { profileSchema } from "@/domain/preferences";
import { samplePreference } from "@/domain/fixtures";

describe("lifestyle presets", () => {
  it("produce valid profiles with weights totalling 100", () => {
    for (const id of ["hawker", "family", "runner", "commuter"] as const) {
      const result = applyPreset(structuredClone(samplePreference), id);
      expect(profileSchema.safeParse(result).success).toBe(true);
      const w = result.weights;
      expect(w.destination + w.lifestyle + w.affordability).toBe(100);
    }
  });

  it("keep the commuter's own lifestyles and zero the lifestyle weight when there are none", () => {
    const none = { ...structuredClone(samplePreference), lifestyles: [] };
    const result = applyPreset(none, "commuter");
    expect(result.lifestyles).toEqual([]);
    expect(result.weights).toEqual({
      destination: 75,
      lifestyle: 0,
      affordability: 25,
    });
  });

  it("does not touch destinations, budget or name", () => {
    const base = structuredClone(samplePreference);
    const result = applyPreset(base, "family");
    expect(result.destinations).toEqual(base.destinations);
    expect(result.budgetMin).toBe(base.budgetMin);
    expect(result.name).toBe(base.name);
    expect(result.flatTypes).toEqual(["4-room", "5-room"]);
  });
});
