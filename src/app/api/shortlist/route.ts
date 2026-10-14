import { body, handle, sameOrigin } from "@/server/http";
import { ShortlistController } from "@/server/controllers/ShortlistController";
export async function GET() {
  return handle(async () => ({
    savedAreas: await new ShortlistController().list(),
  }));
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      savedArea: await new ShortlistController().add(await body(request)),
    };
  });
}
