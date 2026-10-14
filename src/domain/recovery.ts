import { z } from "zod";

export const recoveryEmailSchema = z
  .object({ email: z.email().max(254) })
  .strict();
export const resetPasswordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters.").max(128),
    confirmation: z.string().min(1).max(128),
  })
  .strict()
  .refine((value) => value.password === value.confirmation, {
    path: ["confirmation"],
    message: "The passwords must match.",
  });
export const recoveryTokenSchema = z
  .string()
  .min(20)
  .max(512)
  .regex(/^[A-Za-z0-9_-]+$/);
export const RECOVERY_COOKIE = "homematch-recovery";
export const RECOVERY_SECONDS = 600;
