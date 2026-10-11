import { z } from "zod";
import { handle, AppError } from "@/server/http";
import { config } from "@/server/config";
import { requireSession } from "@/server/supabase";
import { fixtureLocations } from "@/domain/fixtures";
import { OneMapAdapter } from "@/server/adapters/OneMapAdapter";
export async function GET(request: Request) {
  return handle(async () => {
    const query = z
      .string()
      .trim()
      .min(2)
      .max(200)
      .parse(new URL(request.url).searchParams.get("q"));
    const env = config();
    if (env.APP_MODE === "supabase") await requireSession();
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
    return {
      locations: await new OneMapAdapter().search(query),
      source: "onemap",
    };
  });
}
