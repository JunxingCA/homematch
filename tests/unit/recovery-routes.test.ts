import { beforeEach, expect, it, vi } from "vitest";
import { RECOVERY_COOKIE } from "@/domain/recovery";
const mocks = vi.hoisted(() => ({
  reset: vi.fn(),
  request: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  enabled: true,
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, delete: mocks.delete }),
}));
vi.mock("@/server/config", () => ({
  config: () => ({
    APP_ORIGIN: "https://homematch.test",
    APP_MODE: "supabase",
    PASSWORD_RECOVERY_ENABLED: mocks.enabled,
  }),
}));
vi.mock("@/server/controllers/PasswordRecoveryController", () => ({
  PasswordRecoveryController: class {
    reset = mocks.reset;
    request = mocks.request;
  },
}));
vi.mock("@/server/supabase", () => ({ requireSession: vi.fn() }));
import { GET } from "@/app/auth/recovery/route";
import { POST } from "@/app/api/auth/[action]/route";
import { AppError } from "@/server/http";
const token = "b".repeat(64);
const input = {
  password: "A long secure password",
  confirmation: "A long secure password",
};
const request = (body: unknown = input, origin = "https://homematch.test") =>
  new Request("https://homematch.test/api/auth/reset-password", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const context = { params: Promise.resolve({ action: "reset-password" }) };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.enabled = true;
  mocks.get.mockReturnValue({ value: token });
  mocks.reset.mockResolvedValue({ message: "Password reset" });
});
it("strips secrets from the URL, sets a short-lived HTTP-only cookie and never consumes GET links", async () => {
  const response = await GET(
    new Request(
      `https://evil.test/auth/recovery?token_hash=${token}&next=https://evil.test`,
    ),
  );
  expect(response.headers.get("location")).toBe(
    "https://homematch.test/reset-password",
  );
  const cookie = response.headers.get("set-cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("Max-Age=600");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.reset).not.toHaveBeenCalled();
});
it("rejects malformed links and disabled recovery without leaving an older token usable", async () => {
  for (const query of [
    "",
    "?token_hash=bad",
    "?token_hash=" + "x".repeat(513),
  ]) {
    const response = await GET(
      new Request("https://homematch.test/auth/recovery" + query),
    );
    expect(response.headers.get("location")).toContain("invalid=1");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  }
  mocks.enabled = false;
  expect(
    (
      await GET(
        new Request(`https://homematch.test/auth/recovery?token_hash=${token}`),
      )
    ).headers.get("location"),
  ).toContain("invalid=1");
});
it("rejects cross-origin resets before token access", async () => {
  expect(
    (await POST(request(input, "https://evil.test"), context)).status,
  ).toBe(403);
  expect(mocks.get).not.toHaveBeenCalled();
  expect(mocks.reset).not.toHaveBeenCalled();
});
it("preserves recovery proof for correctable validation errors and ignores browser-supplied proof", async () => {
  expect(
    (await POST(request({ ...input, confirmation: "wrong" }), context)).status,
  ).toBe(422);
  expect(mocks.delete).not.toHaveBeenCalled();
  expect(mocks.reset).not.toHaveBeenCalled();
  expect(
    (await POST(request({ ...input, tokenHash: token }), context)).status,
  ).toBe(422);
});
it("uses only HTTP-only cookie proof and clears it after a successful or failed reset attempt", async () => {
  expect((await POST(request(), context)).status).toBe(200);
  expect(mocks.reset).toHaveBeenCalledWith(input, token);
  expect(mocks.delete).toHaveBeenCalledWith(RECOVERY_COOKIE);
  mocks.reset.mockRejectedValue(
    new AppError("RECOVERY_LINK_INVALID", "Invalid link", 410),
  );
  expect((await POST(request(), context)).status).toBe(410);
  expect(mocks.delete).toHaveBeenCalledTimes(2);
});
