import "server-only";
import { z } from "zod";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { adminClient, userClient } from "../supabase";
import { AppError } from "../http";
import { config } from "../config";

const credentials = z
  .object({ email: z.email().max(254), password: z.string().min(1).max(128) })
  .strict();

export class AuthenticationController {
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
