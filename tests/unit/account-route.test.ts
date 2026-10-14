import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ remove: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "https://homematch.test" }),
}));
vi.mock("@/server/controllers/AuthenticationController", () => ({
  AuthenticationController: class {
    deleteAccount = mocks.remove;
  },
}));
import { DELETE } from "@/app/api/account/route";
import { AppError } from "@/server/http";
const request = (
  origin = "https://homematch.test",
  data = '{"confirmation":"DELETE"}',
  type = "application/json",
) =>
  new Request("https://homematch.test/api/account", {
    method: "DELETE",
    headers: { origin, "Content-Type": type },
    body: data,
  });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.remove.mockResolvedValue({ deleted: true });
});
it("rejects missing or foreign origins before controller access", async () => {
  for (const origin of ["", "https://evil.test"])
    expect((await DELETE(request(origin))).status).toBe(403);
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("rejects non-JSON, malformed and oversized payloads before controller access", async () => {
  expect((await DELETE(request(undefined, "bad", "text/plain"))).status).toBe(
    415,
  );
  expect((await DELETE(request(undefined, "bad"))).status).toBe(400);
  expect((await DELETE(request(undefined, "x".repeat(24001)))).status).toBe(
    413,
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not cache the deletion response or expose provider details", async () => {
  const success = await DELETE(request());
  expect(await success.json()).toEqual({ deleted: true });
  expect(success.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.remove).toHaveBeenCalledWith({ confirmation: "DELETE" });
  mocks.remove.mockRejectedValue(
    new AppError("ACCOUNT_DELETE_UNCONFIRMED", "Deletion unconfirmed", 503),
  );
  const failed = await DELETE(request());
  expect(failed.status).toBe(503);
  expect(failed.headers.get("Cache-Control")).toContain("no-store");
  expect((await failed.json()).error.code).toBe("ACCOUNT_DELETE_UNCONFIRMED");
});
