import { AuthenticationController } from "@/server/controllers/AuthenticationController";
import { body, handle, sameOrigin } from "@/server/http";

export async function DELETE(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return new AuthenticationController().deleteAccount(await body(request));
  });
}
