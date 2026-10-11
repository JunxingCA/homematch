import { handle, body, sameOrigin } from "@/server/http";
import { profileController } from "@/server/profileContext";
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    sameOrigin(request);
    return {
      profile: await (
        await profileController()
      ).confirm((await context.params).id, await body(request)),
    };
  });
}
