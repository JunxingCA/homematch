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
    ONEMAP_EMAIL: z.string().optional(),
    ONEMAP_PASSWORD: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    GEMINI_MODEL: z.string().min(1),
    PASSWORD_RECOVERY_ENABLED: z.boolean(),
    OPERATION_LIMITS_ENABLED: z.boolean(),
    APPLE_SIGN_IN_ENABLED: z.boolean(),
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
    ONEMAP_EMAIL: process.env.ONEMAP_EMAIL,
    ONEMAP_PASSWORD: process.env.ONEMAP_PASSWORD,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY?.trim(),
    GEMINI_MODEL: process.env.GEMINI_MODEL?.trim() || "gemini-3.1-flash-lite",
    PASSWORD_RECOVERY_ENABLED: process.env.PASSWORD_RECOVERY_ENABLED === "true",
    OPERATION_LIMITS_ENABLED: process.env.OPERATION_LIMITS_ENABLED === "true",
    APPLE_SIGN_IN_ENABLED: process.env.APPLE_SIGN_IN_ENABLED === "true",
  });
}
