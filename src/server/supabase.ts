import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { config } from "./config";
import { AppError } from "./http";

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

// Only fresh-session registration and canonical location ingestion use this client.
export function adminClient() {
  const env = config();
  if (env.APP_MODE !== "supabase")
    throw new AppError("PREVIEW_ONLY", "Storage is not configured.", 503);
  return createClient(env.SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
