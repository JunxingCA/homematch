import { NextResponse } from "next/server";
import { config } from "@/server/config";
import { AuthenticationController } from "@/server/controllers/AuthenticationController";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  // Only the configured home page is allowed; never redirect to a supplied next URL.
  const target = new URL("/", config().APP_ORIGIN);
  const code = params.get("code");
  if (params.has("error")) {
    target.searchParams.set(
      "auth",
      params.get("error") === "access_denied" ? "cancelled" : "oauth-failed",
    );
  } else if (!code || code.length > 2048) {
    target.searchParams.set("auth", "oauth-failed");
  } else {
    try {
      await new AuthenticationController().completeOAuthSignIn(code);
    } catch {
      target.searchParams.set("auth", "oauth-failed");
    }
  }
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
