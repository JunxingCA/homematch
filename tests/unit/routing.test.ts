import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ ONEMAP_TOKEN: "test" }),
}));
import { OneMapRoutingAdapter } from "@/server/adapters/OneMapRoutingAdapter";
import { samplePreference } from "@/domain/fixtures";
beforeEach(() => {
  vi.stubGlobal("fetch", mock.fetch);
  mock.fetch.mockReset();
});
afterEach(() => vi.unstubAllGlobals());
const start = { latitude: 1.3, longitude: 103.8 };
it("preserves route quota retry information without publishing fabricated evidence", async () => {
  mock.fetch.mockResolvedValue(
    new Response("unavailable", {
      status: 429,
      headers: { "retry-after": "25" },
    }),
  );
  await expect(
    new OneMapRoutingAdapter().route(
      start,
      samplePreference.destinations[0],
      "2026-10-20T08:00:00+08:00",
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "ONEMAP_RATE_LIMIT", retryAfter: 25 });
  expect(mock.fetch).toHaveBeenCalledOnce();
});
it("converts driving seconds and metres and decodes route geometry", async () => {
  mock.fetch.mockResolvedValue(
    Response.json({
      status: 0,
      route_geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      route_summary: { total_time: 600, total_distance: 9000 },
    }),
  );
  const result = await new OneMapRoutingAdapter().route(
    start,
    { ...samplePreference.destinations[0], mode: "private" },
    "2026-10-14T08:00:00+08:00",
    new AbortController().signal,
  );
  expect(result.minutes).toBe(10);
  expect(result.metres).toBe(9000);
  expect(result.geometry[0]).toHaveLength(3);
});
it("uses transit itinerary duration and sums leg distances", async () => {
  mock.fetch.mockResolvedValue(
    Response.json({
      plan: {
        itineraries: [
          {
            duration: 1200,
            legs: [
              { distance: 10, legGeometry: { points: "_p~iF~ps|U" } },
              { distance: 100, legGeometry: { points: "_p~iF~ps|U" } },
            ],
          },
        ],
      },
    }),
  );
  const result = await new OneMapRoutingAdapter().route(
    start,
    samplePreference.destinations[0],
    "2026-10-15T08:00:00+08:00",
    new AbortController().signal,
  );
  expect(result.minutes).toBe(20);
  expect(result.metres).toBe(110);
  expect(result.geometry).toHaveLength(2);
  const url = new URL(mock.fetch.mock.calls[0][0]);
  expect(url.searchParams.get("date")).toBe("10-15-2026");
});
it("fails on HTTP-200 provider errors rather than substituting a score", async () => {
  mock.fetch.mockResolvedValue(Response.json({ error: "expired" }));
  await expect(
    new OneMapRoutingAdapter().route(
      start,
      samplePreference.destinations[0],
      "2026-10-16T08:00:00+08:00",
      new AbortController().signal,
    ),
  ).rejects.toMatchObject({ code: "ROUTING_UNAVAILABLE" });
});
