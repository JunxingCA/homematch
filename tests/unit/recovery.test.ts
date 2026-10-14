import { beforeEach, expect, it, vi } from "vitest";
import { recoveryEmailSchema, resetPasswordSchema } from "@/domain/recovery";

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  verifyOtp: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({ APP_ORIGIN: "http://localhost:3000" }),
}));
vi.mock("@/server/supabase", () => ({
  recoveryClient: () => ({ auth: mocks }),
  adminClient: () => ({ rpc: mocks.rpc }),
}));
import { PasswordRecoveryController } from "@/server/controllers/PasswordRecoveryController";
const token = "a".repeat(64);
const input = {
  password: "A new long password!",
  confirmation: "A new long password!",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  mocks.verifyOtp.mockResolvedValue({
    data: { session: { access_token: "verified-recovery-token" } },
    error: null,
  });
  mocks.getUser.mockResolvedValue({
    data: { user: { id: "verified-owner" } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.updateUser.mockResolvedValue({ error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
it("validates email, matching strong passwords and rejects injected reset fields", () => {
  expect(recoveryEmailSchema.safeParse({ email: "invalid" }).success).toBe(
    false,
  );
  expect(
    resetPasswordSchema.safeParse({ password: "short", confirmation: "short" })
      .success,
  ).toBe(false);
  expect(
    resetPasswordSchema.safeParse({ ...input, confirmation: "different" })
      .success,
  ).toBe(false);
  expect(
    resetPasswordSchema.safeParse({ ...input, userId: "attacker" }).success,
  ).toBe(false);
});
it("uses a fixed email callback and does not disclose whether an account exists", async () => {
  const result = await new PasswordRecoveryController().request({
    email: "known@example.com",
  });
  const unknown = await new PasswordRecoveryController().request({
    email: "unknown@example.com",
  });
  expect(result).toEqual(unknown);
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
    "known@example.com",
    { redirectTo: "http://localhost:3000/auth/recovery" },
  );
});
it("limits repeat email requests without logging or retaining plaintext email", async () => {
  const controller = new PasswordRecoveryController();
  await controller.request({ email: "limited@example.com" });
  await expect(
    controller.request({ email: "LIMITED@example.com" }),
  ).rejects.toMatchObject({ code: "RECOVERY_RATE_LIMIT" });
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledTimes(1);
});
it("reports delivery failure without provider details", async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({
    error: { message: "private SMTP credentials" },
  });
  await expect(
    new PasswordRecoveryController().request({ email: "failed@example.com" }),
  ).rejects.toMatchObject({ code: "RECOVERY_EMAIL_FAILED" });
});
it("requires the single-use recovery proof even if a browser is already signed in", async () => {
  await expect(
    new PasswordRecoveryController().reset(input, undefined),
  ).rejects.toMatchObject({ code: "RECOVERY_LINK_INVALID" });
  expect(mocks.verifyOtp).not.toHaveBeenCalled();
  mocks.verifyOtp.mockResolvedValue({ data: { session: null }, error: {} });
  await expect(
    new PasswordRecoveryController().reset(input, token),
  ).rejects.toMatchObject({ code: "RECOVERY_LINK_INVALID" });
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("validates passwords before consuming the email link", async () => {
  await expect(
    new PasswordRecoveryController().reset(
      { ...input, confirmation: "wrong" },
      token,
    ),
  ).rejects.toThrow();
  expect(mocks.verifyOtp).not.toHaveBeenCalled();
});
it("verifies identity, revokes only that owner's sessions before update and requires sign-in", async () => {
  const result = await new PasswordRecoveryController().reset(input, token);
  expect(mocks.verifyOtp).toHaveBeenCalledWith({
    token_hash: token,
    type: "recovery",
  });
  expect(mocks.getUser).toHaveBeenCalledWith("verified-recovery-token");
  expect(mocks.rpc).toHaveBeenCalledWith("revoke_user_sessions", {
    p_user_id: "verified-owner",
  });
  expect(mocks.rpc.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.updateUser.mock.invocationCallOrder[0],
  );
  expect(mocks.updateUser).toHaveBeenCalledWith({ password: input.password });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
  expect(result.message).toContain("Sign in again");
  expect(mocks.rpc).not.toHaveBeenCalledWith(
    "register_session",
    expect.anything(),
  );
});
it("fails closed when verified identity or session revocation is unavailable", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: {} });
  await expect(
    new PasswordRecoveryController().reset(input, token),
  ).rejects.toMatchObject({ code: "RECOVERY_LINK_INVALID" });
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "owner" } } });
  mocks.rpc.mockResolvedValue({ error: {} });
  await expect(
    new PasswordRecoveryController().reset(input, token),
  ).rejects.toMatchObject({ code: "RECOVERY_UNAVAILABLE" });
  expect(mocks.updateUser).not.toHaveBeenCalled();
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("does not claim a rejected password was changed", async () => {
  mocks.updateUser.mockResolvedValue({
    error: { message: "private provider info" },
  });
  await expect(
    new PasswordRecoveryController().reset(input, token),
  ).rejects.toMatchObject({ code: "PASSWORD_RESET_FAILED" });
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
});
it("reports password-change success accurately if provider global sign-out fails", async () => {
  mocks.signOut.mockResolvedValue({ error: {} });
  expect(
    (await new PasswordRecoveryController().reset(input, token)).message,
  ).toContain("Provider sign-out could not be confirmed");
});
