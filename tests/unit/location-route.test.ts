import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  search: vi.fn(),
  mode: "supabase",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_MODE: mocks.mode, LOCATION_MODE: "onemap" }),
}));
vi.mock("@/server/supabase", () => ({ requireSession: mocks.session }));
vi.mock("@/server/operationLimits", () => ({
  acquireOperation: mocks.acquire,
}));
vi.mock("@/server/adapters/OneMapAdapter", () => ({
  OneMapAdapter: class {
    search = mocks.search;
  },
}));
import { GET } from "@/app/api/locations/search/route";
import { AppError } from "@/server/http";
const owner = "11111111-1111-4111-8111-111111111111";
const run = (q = "NTU") =>
  GET(
    new Request(
      `https://homematch.test/api/locations/search?q=${encodeURIComponent(q)}`,
    ),
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.mode = "supabase";
  mocks.session.mockResolvedValue({ user: { id: owner } });
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.search.mockResolvedValue([]);
});
it("admits only the server-verified owner and releases its slot after an empty successful lookup", async () => {
  const response = await run();
  expect(response.status).toBe(200);
  expect(mocks.acquire).toHaveBeenCalledWith("locations", owner);
  expect(mocks.release).toHaveBeenCalledOnce();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects unauthenticated requests and malformed queries before admission", async () => {
  mocks.session.mockRejectedValue(
    new AppError("SIGN_IN_REQUIRED", "Sign in", 401),
  );
  expect((await run()).status).toBe(401);
  expect((await run("x")).status).toBe(422);
  expect(mocks.acquire).not.toHaveBeenCalled();
  expect(mocks.search).not.toHaveBeenCalled();
});
it("returns retry information without touching OneMap when the shared quota is reached", async () => {
  mocks.acquire.mockRejectedValue(
    new AppError("LOCATION_RATE_LIMIT", "Wait", 429, true, 20),
  );
  const response = await run();
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("20");
  expect(mocks.search).not.toHaveBeenCalled();
  expect(mocks.release).not.toHaveBeenCalled();
});
it("releases admission when the provider fails without retrying the lookup", async () => {
  mocks.search.mockRejectedValue(
    new AppError("ONEMAP_UNAVAILABLE", "Unavailable", 503, true),
  );
  expect((await run()).status).toBe(503);
  expect(mocks.search).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("keeps read-only preview independent of real providers and limiter tables", async () => {
  mocks.mode = "preview";
  const response = await run();
  expect(response.status).toBe(200);
  expect((await response.json()).source).toBe("fixture");
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.acquire).not.toHaveBeenCalled();
  expect(mocks.search).not.toHaveBeenCalled();
});
