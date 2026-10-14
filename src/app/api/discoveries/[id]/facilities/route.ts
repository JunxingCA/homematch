import { handle } from "@/server/http";
import { MapFacilityController } from "@/server/controllers/MapFacilityController";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => ({
    facilities: await new MapFacilityController().get(
      (await context.params).id,
      Object.fromEntries(new URL(request.url).searchParams),
    ),
  }));
}
