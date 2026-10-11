import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  upsert: vi.fn(),
  token: "test-only-token",
  fetch: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ ONEMAP_TOKEN: mocks.token }),
}));
vi.mock("@/server/supabase", () => ({
  adminClient: () => ({ from: () => ({ upsert: mocks.upsert }) }),
}));
import { OneMapAdapter } from "@/server/adapters/OneMapAdapter";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.token = "test-only-token";
  mocks.upsert.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => vi.unstubAllGlobals());
describe("OneMap search adapter", () => {
  it("normalizes verified results and persists the canonical catalog", async () => {
    mocks.fetch.mockResolvedValue(
      Response.json({
        results: [{ ADDRESS: "TEST MRT", LATITUDE: "1.3", LONGITUDE: "103.8" }],
      }),
    );
    const result = await new OneMapAdapter().search("test");
    expect(result[0]).toMatchObject({
      label: "TEST MRT",
      latitude: 1.3,
      longitude: 103.8,
      source: "onemap",
    });
    expect(mocks.upsert).toHaveBeenCalled();
    expect(mocks.fetch.mock.calls[0][1].headers.Authorization).toBe(
      "test-only-token",
    );
  });
  it("distinguishes no results from a provider error", async () => {
    mocks.fetch.mockResolvedValue(Response.json({ results: [] }));
    expect(await new OneMapAdapter().search("empty")).toEqual([]);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
  it.each([
    { error: "Expired token", results: [] },
    { results: [{ ADDRESS: "bad", LATITUDE: "NaN", LONGITUDE: "103.8" }] },
    { wrong: "schema" },
  ])(
    "rejects invalid responses, including HTTP 200 auth errors",
    async (payload) => {
      mocks.fetch.mockResolvedValue(Response.json(payload));
      await expect(new OneMapAdapter().search("test")).rejects.toMatchObject({
        code: "ONEMAP_UNAVAILABLE",
        retryable: true,
      });
    },
  );
  it("requires a token", async () => {
    mocks.token = "";
    await expect(new OneMapAdapter().search("test")).rejects.toMatchObject({
      code: "ONEMAP_UNAVAILABLE",
    });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it("handles network and catalog errors", async () => {
    mocks.fetch.mockRejectedValue(new Error("offline"));
    await expect(new OneMapAdapter().search("test")).rejects.toMatchObject({
      code: "ONEMAP_UNAVAILABLE",
    });
    mocks.fetch.mockResolvedValue(
      Response.json({
        results: [{ ADDRESS: "TEST MRT", LATITUDE: "1.3", LONGITUDE: "103.8" }],
      }),
    );
    mocks.upsert.mockResolvedValue({ error: { message: "database error" } });
    await expect(new OneMapAdapter().search("test")).rejects.toMatchObject({
      code: "ONEMAP_UNAVAILABLE",
    });
  });
});
