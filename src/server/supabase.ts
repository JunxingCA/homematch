import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { config } from "./config";
import { AppError } from "./http";
import { RECOVERY_COOKIE } from "@/domain/recovery";
import { boundedFetch } from "./boundedFetch";

export async function userClient() {
  const env = config();
  if (env.APP_MODE !== "supabase")
    throw new AppError(
      "PREVIEW_ONLY",
      "Sign-in and storage require a configured Supabase project.",
      503,
    );
  const jar = await cookies();
  return createServerClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { fetch: boundedFetch },
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(env.APP_ORIGIN).protocol === "https:",
      path: "/",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll: (values) =>
        values.forEach(({ name, value, options }) =>
          jar.set(name, value, options),
        ),
    },
  });
}

// Recovery uses an isolated client so a link never replaces the browser's session.
export function recoveryClient() {
  const env = config();
  if (env.APP_MODE !== "supabase" || !env.PASSWORD_RECOVERY_ENABLED)
    throw new AppError(
      "RECOVERY_NOT_CONFIGURED",
      "Password recovery is not available yet. Use Google sign-in or contact the team.",
      503,
    );
  return createClient(env.SUPABASE_URL!, env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Trusted operations only; account ownership must be verified before use.
export function adminClient() {
  const env = config();
  if (env.APP_MODE !== "supabase")
    throw new AppError("PREVIEW_ONLY", "Storage is not configured.", 503);
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: boundedFetch },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function clearAuthenticationCookies() {
  const env = config();
  const prefix = `sb-${new URL(env.SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (
      cookie.name === RECOVERY_COOKIE ||
      cookie.name === prefix ||
      cookie.name.startsWith(`${prefix}.`) ||
      cookie.name.startsWith(`${prefix}-`)
    )
      jar.set(cookie.name, "", {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(env.APP_ORIGIN).protocol === "https:",
        maxAge: 0,
      });
  }
}

export async function requireSession(touch = true) {
  const client = await userClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    throw new AppError(
      "SIGN_IN_REQUIRED",
      "Sign in to continue. Your entries have been kept.",
      401,
    );
  const { data: active, error: sessionError } = await client.rpc(
    touch ? "touch_session" : "has_active_session",
  );
  if (sessionError)
    throw new AppError(
      "SESSION_CHECK_FAILED",
      "Session verification is unavailable. Please retry.",
      503,
      true,
    );
  if (!active)
    throw new AppError(
      "SESSION_EXPIRED",
      "Your session has expired. Sign in again to continue.",
      401,
    );
  return { client, user };
}
