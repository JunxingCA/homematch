import { handle, sameOrigin } from "@/server/http";
import { ShortlistController } from "@/server/controllers/ShortlistController";
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    sameOrigin(request);
    await new ShortlistController().remove((await context.params).id);
    return { removed: true };
  });
}
