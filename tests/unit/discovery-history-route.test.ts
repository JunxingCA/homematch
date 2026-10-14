import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ clear: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "https://homematch.test" }),
}));
vi.mock("@/server/controllers/RecommendationController", () => ({
  RecommendationController: class {
    clearHistory = mocks.clear;
  },
}));
import { DELETE } from "@/app/api/discoveries/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.clear.mockResolvedValue({ cleared: true });
});
const request = (
  origin = "https://homematch.test",
  contentType = "application/json",
  body = '{"confirm":true}',
) =>
  new Request("https://homematch.test/api/discoveries", {
    method: "DELETE",
    headers: { origin, "Content-Type": contentType },
    body,
  });
it("blocks foreign origins and non-JSON requests before clearing", async () => {
  expect((await DELETE(request("https://evil.test"))).status).toBe(403);
  expect((await DELETE(request(""))).status).toBe(403);
  expect((await DELETE(request(undefined, "text/plain"))).status).toBe(415);
  expect(mocks.clear).not.toHaveBeenCalled();
});
it("passes confirmation and never caches the response", async () => {
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.clear).toHaveBeenCalledWith({ confirm: true });
});
