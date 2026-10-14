import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ catalogue: vi.fn(), details: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "https://homematch.test" }),
}));
vi.mock("@/server/controllers/AreaExplorationController", () => ({
  AreaExplorationController: class {
    catalogue = mocks.catalogue;
    details = mocks.details;
  },
}));
import { GET, POST } from "@/app/api/exploration/route";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.catalogue.mockResolvedValue({ areas: [] });
  mocks.details.mockResolvedValue({ journeys: null });
});
it("protects POST with same-origin and bounded JSON checks before controller access", async () => {
  const request = (
    origin: string,
    body = "{}",
    contentType = "application/json",
  ) =>
    new Request("https://homematch.test/api/exploration", {
      method: "POST",
      headers: { origin, "Content-Type": contentType },
      body,
    });
  expect((await POST(request("https://evil.test"))).status).toBe(403);
  expect((await POST(request(""))).status).toBe(403);
  expect(
    (await POST(request("https://homematch.test", "x", "text/plain"))).status,
  ).toBe(415);
  expect(
    (await POST(request("https://homematch.test", "x".repeat(24001)))).status,
  ).toBe(413);
  expect(mocks.details).not.toHaveBeenCalled();
});
it("marks catalogue and private exploration responses no-store", async () => {
  const response = await GET();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const post = await POST(
    new Request("https://homematch.test/api/exploration", {
      method: "POST",
      headers: {
        Origin: "https://homematch.test",
        "Content-Type": "application/json",
      },
      body: "{}",
    }),
  );
  expect(post.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.details).toHaveBeenCalledWith({});
});
