import { beforeEach, expect, it, vi } from "vitest";
import { RECOVERY_COOKIE } from "@/domain/recovery";
const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  origin: "https://homematch.test",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({
    SUPABASE_URL: "https://project.supabase.co",
    APP_ORIGIN: mocks.origin,
  }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    set: mocks.set,
    getAll: () =>
      [
        "sb-project-auth-token",
        "sb-project-auth-token.0",
        "sb-project-auth-token.1",
        "sb-project-auth-token-code-verifier",
        RECOVERY_COOKIE,
        "homematch-theme",
        "sb-other-auth-token",
      ].map((name) => ({ name, value: "secret" })),
  }),
}));
import { clearAuthenticationCookies } from "@/server/supabase";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.origin = "https://homematch.test";
});
it("clears only this project's auth chunks, PKCE proof and recovery cookie", async () => {
  await clearAuthenticationCookies();
  expect(mocks.set.mock.calls.map(([name]) => name)).toEqual([
    "sb-project-auth-token",
    "sb-project-auth-token.0",
    "sb-project-auth-token.1",
    "sb-project-auth-token-code-verifier",
    RECOVERY_COOKIE,
  ]);
  for (const call of mocks.set.mock.calls)
    expect(call[2]).toEqual({
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 0,
    });
});
it("allows cookie expiry on the HTTP-only local development origin", async () => {
  mocks.origin = "http://127.0.0.1:4175";
  await clearAuthenticationCookies();
  expect(mocks.set.mock.calls[0][2].secure).toBe(false);
});
