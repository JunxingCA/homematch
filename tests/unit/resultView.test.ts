import { describe, expect, it } from "vitest";
import {
  leader,
  litWindows,
  ordinal,
  project,
  verdict,
  walkMinutes,
  weekdayMoments,
  weeklyTravelHours,
} from "@/components/results/resultView";
import type { AreaResult, Discovery } from "@/domain/recommendations";

const result = (
  name: string,
  overall: number,
  weightedMinutes: number,
  extra: Partial<AreaResult> = {},
): AreaResult =>
  ({
    area: {
      id: name,
      name: name.toUpperCase(),
      originLabel: `${name} MRT`,
      latitude: 1.35,
      longitude: 103.85,
    },
    overall,
    destinationScore: 70,
    lifestyleScore: null,
    affordabilityScore: 60,
    transactions: 10,
    withinBudget: 5,
    median: 500000,
    p25: 450000,
    p75: 550000,
    weightedMinutes,
    routes: [],
    amenities: [],
    ...extra,
  }) as AreaResult;

describe("result presentation", () => {
  it("turns the overall score into lit windows", () => {
    expect(litWindows(0)).toBe(0);
    expect(litWindows(74.6)).toBe(7);
    expect(litWindows(100)).toBe(10);
    expect(litWindows(130)).toBe(10);
  });

  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });

  it("estimates walks and weekly travel from evidence", () => {
    expect(walkMinutes(10)).toBe(1);
    expect(walkMinutes(400)).toBe(5);
    const r = result("Bedok", 80, 20, {
      routes: [
        {
          destination: "NTU",
          visits: 5,
          mode: "public",
          minutes: 30,
          metres: 20000,
          geometry: [],
        },
      ],
    });
    expect(weeklyTravelHours(r)).toBe(5);
  });

  it("builds a weekday from the routed trip and nearest facilities", () => {
    const r = result("Bedok", 80, 20, {
      routes: [
        {
          destination: "NTU",
          visits: 5,
          mode: "public",
          minutes: 47.6,
          metres: 21000,
          geometry: [],
        },
      ],
      amenities: [
        {
          category: "Hawker centres",
          radius: 800,
          priority: 5,
          count: 2,
          nearest: {
            name: "Bedok Food Centre",
            category: "Hawker centres",
            latitude: 1.32,
            longitude: 103.93,
            metres: 410,
          },
          facilities: [],
          score: 90,
        },
      ],
    });
    const moments = weekdayMoments({} as Discovery, r);
    expect(moments.map((m) => m.time)).toEqual([
      "07:40",
      "08:00",
      "08:48",
      "18:48",
      "19:15",
      "22:30",
    ]);
    expect(moments[1].title).toBe("48 min to NTU");
    expect(moments[4].detail).toContain("about 5 min on foot");
  });

  it("names a leader only when one result is ahead", () => {
    const a = result("A", 80, 30),
      b = result("B", 70, 20);
    expect(leader([a, b], (r) => r.overall)).toBe("A");
    expect(leader([a, b], () => 50)).toBeNull();
    expect(leader([a, b], (r) => r.lifestyleScore)).toBeNull();
  });

  it("summarises a comparison honestly", () => {
    expect(verdict([result("A", 80, 30), result("B", 70, 20)])).toBe(
      "A fits your week best, though B gets you there faster.",
    );
    expect(verdict([result("A", 80, 10), result("B", 70, 20)])).toBe(
      "A fits your week best.",
    );
    expect(verdict([result("A", 70, 10), result("B", 70, 20)])).toContain(
      "tie",
    );
  });

  it("places coordinates inside the island outline box", () => {
    const [x, y] = project(1.35, 103.82);
    expect(x).toBeGreaterThan(150);
    expect(x).toBeLessThan(250);
    expect(y).toBeGreaterThan(90);
    expect(y).toBeLessThan(160);
  });
});
