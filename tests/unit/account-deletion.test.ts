import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  accountDeletionSchema,
  hasRecentDeletionAuthentication,
} from "@/domain/accountDeletion";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  claims: vi.fn(),
  revoke: vi.fn(),
  remove: vi.fn(),
  signOut: vi.fn(),
  clear: vi.fn(),
  admin: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({
  requireSession: mocks.session,
  clearAuthenticationCookies: mocks.clear,
  adminClient: mocks.admin,
  userClient: vi.fn(),
}));
import { AuthenticationController } from "@/server/controllers/AuthenticationController";
const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const now = Date.now();
const seconds = Math.floor(now / 1000);
const claims = (timestamp = seconds) => ({
  sub: owner,
  session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  role: "authenticated",
  is_anonymous: false,
  amr: [{ method: "oauth", timestamp }],
});
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    user: { id: owner },
    client: { auth: { getClaims: mocks.claims, signOut: mocks.signOut } },
  });
  mocks.claims.mockResolvedValue({ data: { claims: claims() }, error: null });
  mocks.admin.mockReturnValue({
    rpc: mocks.revoke,
    auth: { admin: { deleteUser: mocks.remove } },
  });
  mocks.revoke.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({
    data: { user: { id: owner } },
    error: null,
  });
  mocks.clear.mockResolvedValue(undefined);
});
describe("recent signature-verified authentication policy", () => {
  it("accepts a matching authenticated owner only within the ten-minute window", () => {
    expect(
      hasRecentDeletionAuthentication(claims(seconds - 599), owner, now),
    ).toBe(true);
    expect(
      hasRecentDeletionAuthentication(claims(seconds - 600), owner, now),
    ).toBe(false);
    expect(
      hasRecentDeletionAuthentication(claims(seconds + 31), owner, now),
    ).toBe(false);
    expect(hasRecentDeletionAuthentication(claims(), other, now)).toBe(false);
  });
  it("does not treat token refresh, recovery, anonymous identity or metadata as fresh sign-in", () => {
    for (const method of ["token_refresh", "recovery", "anonymous", "invented"])
      expect(
        hasRecentDeletionAuthentication(
          { ...claims(), amr: [{ method, timestamp: seconds }] },
          owner,
          now,
        ),
      ).toBe(false);
    expect(
      hasRecentDeletionAuthentication(
        { ...claims(), is_anonymous: true },
        owner,
        now,
      ),
    ).toBe(false);
    expect(
      hasRecentDeletionAuthentication(
        { ...claims(), role: "service_role" },
        owner,
        now,
      ),
    ).toBe(false);
    expect(
      hasRecentDeletionAuthentication(
        { ...claims(), amr: undefined, user_metadata: { amr: claims().amr } },
        owner,
        now,
      ),
    ).toBe(false);
    expect(
      hasRecentDeletionAuthentication(
        {
          ...claims(seconds - 601),
          iat: seconds,
          amr: [
            ...claims(seconds - 601).amr,
            { method: "token_refresh", timestamp: seconds },
          ],
        },
        owner,
        now,
      ),
    ).toBe(false);
  });
  it("rejects extra account identifiers and imprecise confirmation", () => {
    for (const input of [
      { confirmation: "delete" },
      { confirmation: "DELETE " },
      { confirmation: "DELETE", userId: other },
      {},
    ])
      expect(accountDeletionSchema.safeParse(input).success).toBe(false);
  });
});
describe("self-service account deletion", () => {
  const remove = () =>
    new AuthenticationController().deleteAccount({ confirmation: "DELETE" });
  it("revokes every owner session before hard deletion and clears browser authentication", async () => {
    expect(await remove()).toEqual({ deleted: true });
    expect(mocks.session).toHaveBeenCalledWith(false);
    expect(mocks.revoke).toHaveBeenCalledWith("revoke_user_sessions", {
      p_user_id: owner,
    });
    expect(mocks.remove).toHaveBeenCalledWith(owner, false);
    expect(mocks.revoke.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remove.mock.invocationCallOrder[0],
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clear).toHaveBeenCalledOnce();
  });
  it("rejects invalid input before any session or privileged lookup", async () => {
    await expect(
      new AuthenticationController().deleteAccount({
        confirmation: "DELETE",
        userId: other,
      }),
    ).rejects.toThrow();
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects unsigned, stale or mismatched proof without revoking or deleting", async () => {
    for (const result of [
      { data: { claims: claims(seconds - 601) }, error: null },
      { data: { claims: { ...claims(), sub: other } }, error: null },
      { data: { claims: claims() }, error: new Error("signature rejected") },
    ]) {
      mocks.claims.mockResolvedValue(result);
      await expect(remove()).rejects.toMatchObject({
        code: "ACCOUNT_REAUTH_REQUIRED",
        status: 409,
      });
    }
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
  it("requires an active session before proof and admin access", async () => {
    mocks.session.mockRejectedValue(new Error("Expired"));
    await expect(remove()).rejects.toThrow("Expired");
    expect(mocks.claims).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("reports a verification outage without privileged access or session changes", async () => {
    mocks.claims.mockRejectedValue(new Error("private provider detail"));
    await expect(remove()).rejects.toMatchObject({
      code: "ACCOUNT_AUTH_UNAVAILABLE",
      status: 503,
    });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.clear).not.toHaveBeenCalled();
  });
  it.each(["response", "transport"])(
    "does not delete when revocation is unconfirmed (%s)",
    async (kind) => {
      if (kind === "response")
        mocks.revoke.mockResolvedValue({
          error: new Error("private provider detail"),
        });
      else mocks.revoke.mockRejectedValue(new Error("private provider detail"));
      await expect(remove()).rejects.toMatchObject({
        code: "ACCOUNT_REVOKE_UNCONFIRMED",
        status: 503,
      });
      expect(mocks.remove).not.toHaveBeenCalled();
      expect(mocks.clear).toHaveBeenCalledOnce();
    },
  );
  it.each(["response", "transport", "wrong-user"])(
    "reports uncertainty after failed Auth deletion (%s)",
    async (kind) => {
      if (kind === "transport")
        mocks.remove.mockRejectedValue(new Error("private detail"));
      else
        mocks.remove.mockResolvedValue({
          data: { user: { id: other } },
          error: kind === "response" ? new Error("private detail") : null,
        });
      await expect(remove()).rejects.toMatchObject({
        code: "ACCOUNT_DELETE_UNCONFIRMED",
        status: 503,
      });
      expect(mocks.revoke).toHaveBeenCalledOnce();
      expect(mocks.clear).toHaveBeenCalledOnce();
    },
  );
  it("retains confirmed deletion when best-effort sign-out or cookie cleanup fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.signOut.mockRejectedValue(new Error("Auth account is gone"));
    mocks.clear.mockRejectedValue(new Error("cookie context failure"));
    expect(await remove()).toEqual({ deleted: true });
    expect(log).toHaveBeenCalledWith(
      '{"event":"account_cookie_cleanup_failed"}',
    );
    log.mockRestore();
  });
});
