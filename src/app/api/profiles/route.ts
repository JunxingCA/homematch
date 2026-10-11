import { handle, body, sameOrigin } from "@/server/http";
import { profileController } from "@/server/profileContext";
export async function GET() {
  return handle(async () => ({
    profiles: await (await profileController()).list(),
  }));
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      profile: await (await profileController()).save(await body(request)),
    };
  });
}
