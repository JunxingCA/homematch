import { expect, it } from "vitest";
import { saveAreaSchema, savedArea } from "@/domain/shortlist";
import type { Discovery } from "@/domain/recommendations";
const row = {
  id: "11111111-1111-4111-8111-111111111111",
  discovery_id: "22222222-2222-4222-8222-222222222222",
  area_id: "bedok",
  created_at: "2026-10-13T00:00:00Z",
};
it("accepts only bookmark identifiers, never user-supplied evidence or ownership", () => {
  expect(
    saveAreaSchema.parse({ discoveryId: row.discovery_id, areaId: row.area_id })
      .areaId,
  ).toBe("bedok");
  for (const extra of [
    { userId: "another-user" },
    { score: 100 },
    { result: {} },
  ])
    expect(
      saveAreaSchema.safeParse({
        discoveryId: row.discovery_id,
        areaId: row.area_id,
        ...extra,
      }).success,
    ).toBe(false);
  expect(
    saveAreaSchema.safeParse({ discoveryId: "not-a-uuid", areaId: "" }).success,
  ).toBe(false);
});
it("projects only the chosen area from its immutable original search", () => {
  const source = {
    createdAt: "2026-10-12T00:00:00Z",
    preference: { name: "Original profile" },
    results: [
      { area: { id: "bedok" }, overall: 42 },
      { area: { id: "bishan" }, overall: 88 },
    ],
    formulaVersion: "original",
  } as unknown as Discovery;
  const item = savedArea(row, source);
  expect(item.result.overall).toBe(42);
  expect(item.context.preference.name).toBe("Original profile");
  expect(item.savedAt).toBe(row.created_at);
  expect(item.discoveryId).toBe(row.discovery_id);
  expect(() => savedArea({ ...row, area_id: "invented" }, source)).toThrow(
    "absent",
  );
});
