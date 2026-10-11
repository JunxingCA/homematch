import { handle, body, sameOrigin } from "@/server/http";
import { profileController } from "@/server/profileContext";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    return {
      profile: await (
        await profileController()
      ).save(await body(request), (await context.params).id),
    };
  });
}
export async function DELETE(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    return (await profileController()).remove(
      (await context.params).id,
      await body(request),
    );
  });
}
