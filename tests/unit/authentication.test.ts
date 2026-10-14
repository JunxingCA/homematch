import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  signInWithOAuth: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  appleEnabled: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({
    APP_ORIGIN: "http://localhost:3000",
    APPLE_SIGN_IN_ENABLED: mocks.appleEnabled,
  }),
}));
vi.mock("@/server/supabase", () => ({
  userClient: async () => ({ auth: mocks, rpc: mocks.rpc }),
  adminClient: () => ({ rpc: mocks.adminRpc }),
}));
import { AuthenticationController } from "@/server/controllers/AuthenticationController";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "test@example.com",
};
const sessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const token = `header.${Buffer.from(JSON.stringify({ sub: user.id, session_id: sessionId })).toString("base64url")}.signature`;
const session = { access_token: token } as Session;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.appleEnabled = false;
  mocks.getUser.mockResolvedValue({ data: { user }, error: null });
  mocks.signInWithPassword.mockResolvedValue({
    data: { session },
    error: null,
  });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.adminRpc.mockResolvedValue({ error: null });
});
describe("managed auth orchestration (SDK mocked, not hosted verification)", () => {
  it("keeps Apple disabled until explicitly configured", async () => {
    await expect(
      new AuthenticationController().appleSignIn(),
    ).rejects.toMatchObject({ code: "OAUTH_NOT_CONFIGURED" });
    expect(mocks.signInWithOAuth).not.toHaveBeenCalled();
  });
  it("starts Apple through the same managed PKCE callback when enabled", async () => {
    mocks.appleEnabled = true;
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.com/apple" },
      error: null,
    });
    await expect(new AuthenticationController().appleSignIn()).resolves.toEqual(
      { url: "https://example.com/apple" },
    );
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "apple",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        skipBrowserRedirect: true,
      },
    });
  });
  it("starts Google OAuth with a fixed callback", async () => {
    mocks.signInWithOAuth.mockResolvedValue({
      data: { url: "https://example.com/oauth" },
      error: null,
    });
    await expect(
      new AuthenticationController().googleSignIn(),
    ).resolves.toEqual({ url: "https://example.com/oauth" });
    expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "http://localhost:3000/auth/callback",
        skipBrowserRedirect: true,
      },
    });
  });
  it("reports unavailable Google provider", async () => {
    mocks.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: {} });
    await expect(
      new AuthenticationController().googleSignIn(),
    ).rejects.toMatchObject({ code: "OAUTH_UNAVAILABLE" });
  });
  it("verifies and registers exchanged OAuth sessions", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    await new AuthenticationController().completeGoogleSignIn("code");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("code");
    expect(mocks.getUser).toHaveBeenCalledWith(token);
    expect(mocks.adminRpc).toHaveBeenCalled();
  });
  it("rejects invalid or replayed OAuth codes", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: {},
    });
    await expect(
      new AuthenticationController().completeGoogleSignIn("bad"),
    ).rejects.toMatchObject({ code: "OAUTH_FAILED" });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("clears OAuth cookies if identity verification fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({
      data: { session },
      error: null,
    });
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: {} });
    await expect(
      new AuthenticationController().completeGoogleSignIn("code"),
    ).rejects.toThrow();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("registers a session only after Auth verifies the user", async () => {
    const result = await new AuthenticationController().signIn({
      email: user.email,
      password: "correct password",
    });
    expect(result.user.email).toBe(user.email);
    expect(mocks.getUser).toHaveBeenCalledWith(token);
    expect(mocks.adminRpc).toHaveBeenCalledWith("register_session", {
      p_session_id: sessionId,
      p_user_id: user.id,
    });
  });
  it("does not register failed logins", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "bad" },
    });
    await expect(
      new AuthenticationController().signIn({
        email: user.email,
        password: "wrong",
      }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("does not trust a session before getUser verification", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid token" },
    });
    await expect(
      new AuthenticationController().signIn({
        email: user.email,
        password: "correct password",
      }),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("ends the Auth session when idle-guard registration fails", async () => {
    mocks.adminRpc.mockResolvedValue({
      error: { message: "database unavailable" },
    });
    await expect(
      new AuthenticationController().signIn({
        email: user.email,
        password: "correct password",
      }),
    ).rejects.toMatchObject({ code: "SESSION_CREATE_FAILED" });
    expect(mocks.signOut).toHaveBeenCalled();
  });
  it("keeps email confirmation pending instead of fabricating login", async () => {
    const result = await new AuthenticationController().signUp({
      email: user.email,
      password: "long enough password",
    });
    expect(result).toHaveProperty("message");
    expect(mocks.adminRpc).not.toHaveBeenCalled();
  });
  it("rejects weak registration passwords before provider calls", async () => {
    await expect(
      new AuthenticationController().signUp({
        email: user.email,
        password: "short",
      }),
    ).rejects.toThrow();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("revokes application data access before ending the provider session", async () => {
    await new AuthenticationController().signOut();
    expect(mocks.rpc).toHaveBeenCalledWith("revoke_session");
    expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0],
    );
  });
  it("does not claim logout succeeded if revocation fails", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "offline" } });
    await expect(
      new AuthenticationController().signOut(),
    ).rejects.toMatchObject({ code: "SIGN_OUT_FAILED" });
  });
});
