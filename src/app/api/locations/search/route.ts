import { z } from "zod";
import { handle, AppError } from "@/server/http";
import { config } from "@/server/config";
import { requireSession } from "@/server/supabase";
import { fixtureLocations } from "@/domain/fixtures";
import { OneMapAdapter } from "@/server/adapters/OneMapAdapter";
import { acquireOperation } from "@/server/operationLimits";
export async function GET(request: Request) {
  return handle(async () => {
    const query = z
      .string()
      .trim()
      .min(2)
      .max(200)
      .parse(new URL(request.url).searchParams.get("q"));
    const env = config();
    const session = env.APP_MODE === "supabase" ? await requireSession() : null;
    if (env.APP_MODE === "preview" || env.LOCATION_MODE === "fixtures") {
      if (env.APP_MODE === "supabase" && process.env.NODE_ENV === "production")
        throw new AppError(
          "FIXTURES_DISABLED",
          "Configure OneMap search for this environment.",
          503,
        );
      return {
        locations: fixtureLocations.filter((x) =>
          x.label.toLowerCase().includes(query.toLowerCase()),
        ),
        source: "fixture",
      };
    }
    if (!session)
      throw new AppError(
        "SIGN_IN_REQUIRED",
        "Sign in to search locations.",
        401,
      );
    const release = await acquireOperation("locations", session.user.id);
    try {
      return {
        locations: await new OneMapAdapter().search(query),
        source: "onemap",
      };
    } finally {
      await release();
    }
  });
}
