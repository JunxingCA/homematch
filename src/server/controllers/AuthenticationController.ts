import "server-only";
import { z } from "zod";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  userClient,
  requireSession,
  clearAuthenticationCookies,
} from "../supabase";
import { AppError } from "../http";
import { config } from "../config";
import {
  accountDeletionSchema,
  hasRecentDeletionAuthentication,
} from "@/domain/accountDeletion";

const credentials = z
  .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
  .strict();

export class AuthenticationController {
  async deleteAccount(input: unknown) {
    accountDeletionSchema.parse(input);
    const { client, user } = await requireSession(false);
    const proof = await client.auth.getClaims().catch(() => {
      throw new AppError(
        "ACCOUNT_AUTH_UNAVAILABLE",
        "Identity verification is unavailable. No deletion was attempted. Please retry.",
        503,
        true,
      );
    });
    const { data: verified, error: claimsError } = proof;
    if (
      claimsError ||
      !hasRecentDeletionAuthentication(verified?.claims, user.id)
    )
      throw new AppError(
        "ACCOUNT_REAUTH_REQUIRED",
        "Sign in again before deleting your account, then confirm deletion again.",
        409,
      );
    const admin = adminClient();
    try {
      try {
        const { error } = await admin.rpc("revoke_user_sessions", {
          p_user_id: user.id,
        });
        if (error) throw error;
      } catch {
        throw new AppError(
          "ACCOUNT_REVOKE_UNCONFIRMED",
          "Session revocation could not be confirmed. Sign in to check your account before retrying deletion.",
          503,
          false,
        );
      }
      try {
        const { data, error } = await admin.auth.admin.deleteUser(
          user.id,
          false,
        );
        if (error || data.user?.id !== user.id)
          throw error ?? new Error("Unexpected deletion response");
      } catch {
        throw new AppError(
          "ACCOUNT_DELETE_UNCONFIRMED",
          "Account deletion could not be confirmed. Your HomeMatch sessions have been ended. Sign in to check before retrying.",
          503,
          false,
        );
      }
      return { deleted: true };
    } finally {
      try {
        await client.auth.signOut({ scope: "local" });
      } catch {
        /* Cookie removal below does not depend on Auth availability. */
      }
      try {
        await clearAuthenticationCookies();
      } catch {
        // Revoked/deleted accounts cannot use residual cookies to access app data.
        console.error(
          JSON.stringify({ event: "account_cookie_cleanup_failed" }),
        );
      }
    }
  }

  async googleSignIn() {
    return this.startOAuth("google");
  }

  async appleSignIn() {
    if (!config().APPLE_SIGN_IN_ENABLED)
      throw new AppError(
        "OAUTH_NOT_CONFIGURED",
        "Apple sign-in is not configured yet. Use Google or email.",
        503,
      );
    return this.startOAuth("apple");
  }

  private async startOAuth(provider: "google" | "apple") {
    const client = await userClient();
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${config().APP_ORIGIN}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    if (error || !data.url)
      throw new AppError(
        "OAUTH_UNAVAILABLE",
        `${provider === "apple" ? "Apple" : "Google"} sign-in is unavailable. Please retry.`,
        503,
        true,
      );
    return { url: data.url };
  }

  async completeGoogleSignIn(code: string) {
    return this.completeOAuthSignIn(code);
  }

  async completeOAuthSignIn(code: string) {
    const client = await userClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (error || !data.session)
      throw new AppError(
        "OAUTH_FAILED",
        "Sign-in could not be completed.",
        401,
      );
    try {
      return await this.registerSession(client, data.session);
    } catch (error) {
      await client.auth.signOut({ scope: "local" });
      throw error;
    }
  }

  async registerSession(client: SupabaseClient, session: Session) {
    const {
      data: { user },
      error,
    } = await client.auth.getUser(session.access_token);
    if (error || !user)
      throw new AppError("AUTH_FAILED", "Sign-in could not be verified.", 401);
    // Decode only after Auth has verified the token, not as an authentication shortcut.
    const claims = z
      .object({ session_id: z.uuid(), sub: z.uuid() })
      .parse(
        JSON.parse(
          Buffer.from(
            session.access_token.split(".")[1],
            "base64url",
          ).toString(),
        ),
      );
    if (claims.sub !== user.id)
      throw new AppError("AUTH_FAILED", "Sign-in could not be verified.", 401);
    const { error: dbError } = await adminClient().rpc("register_session", {
      p_session_id: claims.session_id,
      p_user_id: user.id,
    });
    if (dbError) {
      await client.auth.signOut();
      throw new AppError(
        "SESSION_CREATE_FAILED",
        "Unable to start your session. Please retry.",
        503,
        true,
      );
    }
    return { id: user.id, email: user.email };
  }

  async signIn(input: unknown) {
    const data = credentials.parse(input);
    const client = await userClient();
    const { data: result, error } = await client.auth.signInWithPassword(data);
    if (error || !result.session)
      throw new AppError(
        "INVALID_CREDENTIALS",
        "Email or password is incorrect, or the email is not verified.",
        401,
      );
    return { user: await this.registerSession(client, result.session) };
  }

  async signUp(input: unknown) {
    const data = credentials
      .extend({
        password: z.string().min(12, "Use at least 12 characters.").max(128),
      })
      .parse(input);
    const client = await userClient();
    const { data: result, error } = await client.auth.signUp({
      ...data,
      options: { emailRedirectTo: `${config().APP_ORIGIN}/auth/confirm` },
    });
    if (error)
      throw new AppError(
        "REGISTRATION_FAILED",
        "Registration could not be completed. Try signing in if you already have an account.",
        400,
      );
    if (result.session)
      return { user: await this.registerSession(client, result.session) };
    return {
      message:
        "Check your email to confirm registration. If you already have an account, sign in instead.",
    };
  }

  async signOut() {
    const client = await userClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user) {
      const { error } = await client.rpc("revoke_session");
      if (error)
        throw new AppError(
          "SIGN_OUT_FAILED",
          "Could not end your session. Please retry.",
          503,
          true,
        );
    }
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error)
      throw new AppError(
        "SIGN_OUT_FAILED",
        "Could not end your session. Please retry.",
        503,
        true,
      );
    return { signedOut: true };
  }
}
