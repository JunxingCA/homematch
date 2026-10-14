import type { Metadata } from "next";
import { cookies } from "next/headers";
import { RECOVERY_COOKIE, recoveryTokenSchema } from "@/domain/recovery";
import { config } from "@/server/config";
import { PasswordReset } from "@/components/PasswordReset";

export const metadata: Metadata = {
  title: "HomeMatch | Reset password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ invalid?: string }>;
}) {
  const env = config();
  const jar = await cookies();
  const invalid = Boolean((await searchParams).invalid);
  return (
    <PasswordReset
      available={
        !invalid &&
        env.APP_MODE === "supabase" &&
        env.PASSWORD_RECOVERY_ENABLED &&
        recoveryTokenSchema.safeParse(jar.get(RECOVERY_COOKIE)?.value).success
      }
    />
  );
}
