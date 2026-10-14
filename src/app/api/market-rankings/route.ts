import { body, handle, sameOrigin } from "@/server/http";
import { MarketRecommendationController } from "@/server/controllers/MarketRecommendationController";
export const maxDuration = 180;
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      discovery: await new MarketRecommendationController().create(
        await body(request),
      ),
    };
  });
}
