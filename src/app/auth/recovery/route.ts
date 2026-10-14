import { NextResponse } from "next/server";
import { config } from "@/server/config";
import {
  RECOVERY_COOKIE,
  RECOVERY_SECONDS,
  recoveryTokenSchema,
} from "@/domain/recovery";

export async function GET(request: Request) {
  const env = config();
  const params = new URL(request.url).searchParams;
  const token = recoveryTokenSchema.safeParse(params.get("token_hash"));
  const target = new URL("/reset-password", env.APP_ORIGIN);
  if (
    !token.success ||
    env.APP_MODE !== "supabase" ||
    !env.PASSWORD_RECOVERY_ENABLED
  )
    target.searchParams.set("invalid", "1");
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.cookies.set(
    RECOVERY_COOKIE,
    token.success && !target.search ? token.data : "",
    {
      httpOnly: true,
      secure: target.protocol === "https:",
      sameSite: "lax",
      path: "/",
      maxAge: target.search ? 0 : RECOVERY_SECONDS,
    },
  );
  // Opening a link never consumes its single-use provider token.
  return response;
}
