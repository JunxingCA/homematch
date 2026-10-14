import { handle } from "@/server/http";
import { RecommendationController } from "@/server/controllers/RecommendationController";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(async () => ({
    discovery: await new RecommendationController().get(
      (await context.params).id,
    ),
  }));
}
