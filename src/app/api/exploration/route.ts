import { body, handle, sameOrigin } from "@/server/http";
import { AreaExplorationController } from "@/server/controllers/AreaExplorationController";
export const maxDuration = 90;
export async function GET() {
  return handle(async () => ({
    catalogue: await new AreaExplorationController().catalogue(),
  }));
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      exploration: await new AreaExplorationController().details(
        await body(request),
      ),
    };
  });
}
