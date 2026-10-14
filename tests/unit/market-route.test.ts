import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "https://homematch.test" }),
}));
vi.mock("@/server/controllers/MarketRecommendationController", () => ({
  MarketRecommendationController: class {
    create = mocks.create;
  },
}));
import { POST } from "@/app/api/market-rankings/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.create.mockResolvedValue({ id: "fixture" });
});
const request = (
  origin = "https://homematch.test",
  contentType = "application/json",
) =>
  new Request("https://homematch.test/api/market-rankings", {
    method: "POST",
    headers: { origin, "Content-Type": contentType },
    body: "{}",
  });
it("blocks foreign origins and unsupported payloads before provider access", async () => {
  expect((await POST(request("https://evil.test"))).status).toBe(403);
  expect((await POST(request(""))).status).toBe(403);
  expect((await POST(request(undefined, "text/plain"))).status).toBe(415);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("keeps saved private rankings out of shared caches", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.create).toHaveBeenCalledWith({});
});
