import { z } from "zod";

export const accountDeletionSchema = z
  .object({ confirmation: z.literal("DELETE") })
  .strict();
export const DELETION_AUTH_SECONDS = 600;
const verifiedDeletionClaims = z.object({
  sub: z.uuid(),
  session_id: z.uuid(),
  role: z.literal("authenticated"),
  is_anonymous: z.literal(false),
  amr: z
    .array(
      z.object({
        method: z.string(),
        timestamp: z.number().int().nonnegative(),
      }),
    )
    .max(30),
});

// Call only with claims returned by the server's signature-verified getClaims().
export function hasRecentDeletionAuthentication(
  claims: unknown,
  userId: string,
  now = Date.now(),
): boolean {
  const result = verifiedDeletionClaims.safeParse(claims);
  if (!result.success || result.data.sub !== userId || !Number.isFinite(now))
    return false;
  const seconds = Math.floor(now / 1000);
  return result.data.amr.some(
    (a) =>
      [
        "password",
        "oauth",
        "otp",
        "magiclink",
        "totp",
        "email/signup",
        "sso/saml",
      ].includes(a.method) &&
      a.timestamp <= seconds + 30 &&
      seconds - a.timestamp < DELETION_AUTH_SECONDS,
  );
}
