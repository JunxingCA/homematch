import { HomeMatch } from "@/components/HomeMatch";
import { config } from "@/server/config";

export const dynamic = "force-dynamic";
export const metadata = { title: "HomeMatch | A place to belong" };

export default function WelcomePage() {
  const env = config();
  return (
    <HomeMatch
      mode={env.APP_MODE}
      locationMode={env.LOCATION_MODE}
      appleSignInEnabled={env.APPLE_SIGN_IN_ENABLED}
      welcome
    />
  );
}
