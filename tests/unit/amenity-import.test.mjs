import { describe, expect, it } from "vitest";
import {
  point,
  schoolPoint,
  supermarketPoint,
  uniquePoints,
  searchPages,
  sportsFacilities,
} from "../../scripts/lib/amenities.mjs";
const result = {
  BUILDING: "FAIRPRICE CANBERRA PLAZA",
  ADDRESS: "1 ROAD",
  POSTAL: "123456",
  LATITUDE: "1.3",
  LONGITUDE: "103.8",
};
describe("official amenity import validation", () => {
  it("imports explicit sports categories and does not infer facilities from a venue name", () => {
    const row = {
      VenueName: "Example school",
      Latitude: "1.3",
      Longitude: "103.8",
      PostalCode: "123456",
    };
    const types = [
      "Gymnasium",
      "Basketball Court",
      "Football Field",
      "Futsal / Street Soccer Court",
      "Swimming Pool",
      "Tennis Court",
      "Fitness Corner",
      "Jogging track",
      "Athletics Track",
    ];
    const facilities = sportsFacilities(
      types.map((SportsFacility) => ({ ...row, SportsFacility })),
    );
    expect(facilities.map((f) => f.category)).toEqual([
      "Gym",
      "Basketball",
      "Football",
      "Swimming",
      "Tennis",
      "Fitness corners",
      "Running tracks",
    ]);
    expect(
      sportsFacilities([
        { ...row, VenueName: "Badminton Gym", SportsFacility: "Studio" },
      ]),
    ).toEqual([]);
    expect(() =>
      sportsFacilities([{ ...row, Latitude: "", SportsFacility: "Gymnasium" }]),
    ).toThrow();
    expect(
      sportsFacilities([
        { ...row, VenueName: "", SportsFacility: "Football Field" },
      ])[0].name,
    ).toBe("Football venue (123456)");
  });
  it("validates all coordinates without silently converting empty values", () => {
    expect(point("1.3", "103.8")).toEqual({ latitude: 1.3, longitude: 103.8 });
    for (const lat of ["", "x", "0", "1.6"])
      expect(() => point(lat, "103.8")).toThrow();
  });
  it("accepts branded retail points but excludes non-retail lookalikes", () => {
    expect(supermarketPoint(result)?.category).toBe("Groceries");
    for (const BUILDING of [
      "GIANT PANDA FOREST",
      "FAIRPRICE GROUP SUNVIEW DISTRIBUTION CENTRE",
      "SUZUE-PSA COLD STORAGE",
      "F1-COLD STORAGE CONNEXIS",
      "SCHOOL",
    ])
      expect(supermarketPoint({ ...result, BUILDING })).toBeNull();
  });
  it("resolves exact school name and postal code, never an unrelated postal", () => {
    const school = {
      school_name: "Example Primary School",
      postal_code: "123456",
    };
    expect(
      schoolPoint(school, [{ ...result, BUILDING: "EXAMPLE PRIMARY SCHOOL" }])
        .name,
    ).toBe(school.school_name);
    expect(() =>
      schoolPoint(school, [{ ...result, POSTAL: "654321" }]),
    ).toThrow("could not be resolved");
  });
  it("rejects geographically ambiguous matches instead of picking the first", () => {
    const school = {
      school_name: "Example Primary School",
      postal_code: "123456",
    };
    expect(() =>
      schoolPoint(school, [result, { ...result, LATITUDE: "1.4" }]),
    ).toThrow("Ambiguous");
    expect(
      schoolPoint(school, [result, { ...result, LATITUDE: "1.3001" }]).latitude,
    ).toBe(1.3);
  });
  it("deduplicates identical points, preserving distinct categories", () => {
    const p = supermarketPoint(result);
    expect(uniquePoints([p, p, { ...p, category: "Schools" }])).toHaveLength(2);
  });
  it("uses a verified named administrative point for a large campus", () => {
    const school = {
      school_name: "RAFFLES INSTITUTION",
      postal_code: "123456",
    };
    const admin = {
      ...result,
      BUILDING: "RAFFLES INSTITUTION (ADMINISTRATIVE CENTRE)",
    };
    expect(
      schoolPoint(school, [admin, { ...result, LATITUDE: "1.4" }]).latitude,
    ).toBe(1.3);
  });
  it("reads every page and rejects missing or changing search pages", async () => {
    const page = { found: 2, totalNumPages: 2, results: [result] };
    expect(await searchPages(async () => page)).toHaveLength(2);
    await expect(
      searchPages(async (n) => ({ ...page, results: n === 1 ? [result] : [] })),
    ).rejects.toThrow("Incomplete");
    await expect(
      searchPages(async (n) => ({ ...page, found: n === 1 ? 2 : 3 })),
    ).rejects.toThrow("changed");
  });
});
