import { NextResponse } from "next/server";
import { userClient } from "@/server/supabase";
import { config } from "@/server/config";
import { AuthenticationController } from "@/server/controllers/AuthenticationController";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token_hash");
  const target = new URL("/", config().APP_ORIGIN);
  if (!token || token.length > 512) {
    target.searchParams.set("auth", "invalid-link");
    return NextResponse.redirect(target);
  }
  try {
    const client = await userClient();
    const { data, error } = await client.auth.verifyOtp({
      token_hash: token,
      type: "email",
    });
    if (error || !data.session) throw new Error("Invalid confirmation");
    await new AuthenticationController().registerSession(client, data.session);
  } catch {
    target.searchParams.set("auth", "invalid-link");
  }
  const response = NextResponse.redirect(target);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
