import { HomeMatch } from "@/components/HomeMatch";
import { config } from "@/server/config";
export const dynamic = "force-dynamic";
export default function Page() {
  const env = config();
  return (
    <HomeMatch
      mode={env.APP_MODE}
      locationMode={env.LOCATION_MODE}
      appleSignInEnabled={env.APPLE_SIGN_IN_ENABLED}
    />
  );
}
