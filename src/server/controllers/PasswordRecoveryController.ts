import "server-only";
import { createHash } from "node:crypto";
import {
  recoveryEmailSchema,
  recoveryTokenSchema,
  resetPasswordSchema,
} from "@/domain/recovery";
import { config } from "../config";
import { AppError } from "../http";
import { adminClient, recoveryClient } from "../supabase";

const emailAttempts = new Map<
  string,
  { since: number; last: number; count: number }
>();
const hour = 60 * 60 * 1000;
const acknowledgement =
  "If an account uses this email, recovery instructions will be sent. Check your inbox and spam folder.";

export class PasswordRecoveryController {
  async request(input: unknown) {
    const { email } = recoveryEmailSchema.parse(input);
    const client = recoveryClient();
    const now = Date.now();
    for (const [key, attempt] of emailAttempts)
      if (now - attempt.since >= hour) emailAttempts.delete(key);
    const key = createHash("sha256").update(email.toLowerCase()).digest("hex");
    const attempt = emailAttempts.get(key);
    if (attempt && (now - attempt.last < 60000 || attempt.count >= 5))
      throw new AppError(
        "RECOVERY_RATE_LIMIT",
        "Wait before requesting another recovery email.",
        429,
        true,
      );
    if (!attempt && emailAttempts.size >= 1000)
      throw new AppError(
        "RECOVERY_RATE_LIMIT",
        "Recovery is busy. Please retry later.",
        429,
        true,
      );
    emailAttempts.set(key, {
      since: attempt?.since ?? now,
      last: now,
      count: (attempt?.count ?? 0) + 1,
    });
    const { error } = await client.auth
      .resetPasswordForEmail(email, {
        redirectTo: `${config().APP_ORIGIN}/auth/recovery`,
      })
      .catch(() => ({ error: true }));
    if (error)
      throw new AppError(
        "RECOVERY_EMAIL_FAILED",
        "Recovery instructions could not be sent. Please retry later or use Google sign-in.",
        503,
        true,
      );
    return { message: acknowledgement };
  }

  async reset(input: unknown, tokenHash: unknown) {
    const { password } = resetPasswordSchema.parse(input);
    const token = recoveryTokenSchema.safeParse(tokenHash);
    if (!token.success)
      throw new AppError(
        "RECOVERY_LINK_INVALID",
        "This recovery link expired or is invalid. Request a new link.",
        410,
      );
    const client = recoveryClient();
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token.data,
      type: "recovery",
    });
    if (error || !data.session)
      throw new AppError(
        "RECOVERY_LINK_INVALID",
        "This recovery link expired or was already used. Request a new link.",
        410,
      );
    try {
      const { data: identity, error: identityError } =
        await client.auth.getUser(data.session.access_token);
      if (identityError || !identity.user)
        throw new AppError(
          "RECOVERY_LINK_INVALID",
          "This recovery link could not be verified. Request a new link.",
          410,
        );
      // Revoke application access before changing credentials, including old JWTs.
      const { error: revokeError } = await adminClient().rpc(
        "revoke_user_sessions",
        {
          p_user_id: identity.user.id,
        },
      );
      if (revokeError)
        throw new AppError(
          "RECOVERY_UNAVAILABLE",
          "Password reset is unavailable. Your password has not changed; request a new link later.",
          503,
          true,
        );
      const { error: updateError } = await client.auth.updateUser({ password });
      if (updateError)
        throw new AppError(
          "PASSWORD_RESET_FAILED",
          "The new password could not be accepted. Request a new link and try a different password.",
          422,
        );
      const { error: signOutError } = await client.auth
        .signOut({
          scope: "global",
        })
        .catch(() => ({ error: true }));
      return {
        message: signOutError
          ? "Your password was reset and HomeMatch sessions were revoked. Sign in again. Provider sign-out could not be confirmed."
          : "Your password was reset. Sign in again with your new password.",
      };
    } catch (failure) {
      if (failure instanceof AppError) throw failure;
      throw new AppError(
        "RECOVERY_UNAVAILABLE",
        "The password reset could not be confirmed. Try signing in; if needed, request a new link.",
        503,
        true,
      );
    } finally {
      // This temporary recovery session is never registered for application access.
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    }
  }
}
