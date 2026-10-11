import "server-only";
import { z } from "zod";

const schema = z
  .object({
    APP_MODE: z.enum(["preview", "supabase"]),
    APP_ORIGIN: z.url(),
    SUPABASE_URL: z.string().optional(),
    SUPABASE_PUBLISHABLE_KEY: z.string().optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
    LOCATION_MODE: z.enum(["fixtures", "onemap"]),
    ONEMAP_TOKEN: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.APP_MODE === "supabase") {
      if (
        process.env.NODE_ENV === "production" &&
        env.LOCATION_MODE === "fixtures"
      )
        ctx.addIssue({
          code: "custom",
          path: ["LOCATION_MODE"],
          message: "Production Supabase mode requires OneMap locations",
        });
      for (const key of [
        "SUPABASE_URL",
        "SUPABASE_PUBLISHABLE_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
      ] as const) {
        if (!env[key])
          ctx.addIssue({
            code: "custom",
            path: [key],
            message: "Required in Supabase mode",
          });
      }
      if (env.SUPABASE_URL && !z.url().safeParse(env.SUPABASE_URL).success)
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_URL"],
          message: "Invalid URL",
        });
    }
  });

export function config() {
  const production = process.env.NODE_ENV === "production";
  return schema.parse({
    APP_MODE: process.env.APP_MODE ?? (production ? undefined : "preview"),
    APP_ORIGIN:
      process.env.APP_ORIGIN ??
      (production ? undefined : "http://localhost:3000"),
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    LOCATION_MODE: process.env.LOCATION_MODE ?? "fixtures",
    ONEMAP_TOKEN: process.env.ONEMAP_TOKEN,
  });
}
