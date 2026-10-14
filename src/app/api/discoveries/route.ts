import { body, handle, sameOrigin } from "@/server/http";
import { RecommendationController } from "@/server/controllers/RecommendationController";
export const maxDuration = 180;
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      discovery: await new RecommendationController().create(
        await body(request),
      ),
    };
  });
}
export async function GET() {
  return handle(async () => ({
    discoveries: await new RecommendationController().list(),
  }));
}
export async function DELETE(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return new RecommendationController().clearHistory(await body(request));
  });
}
