import { body, handle, sameOrigin } from "@/server/http";
import { PreferenceInterpretationController } from "@/server/controllers/PreferenceInterpretationController";
export const maxDuration = 90;
export async function GET() {
  return handle(() => new PreferenceInterpretationController().status());
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    return {
      interpretation: await new PreferenceInterpretationController().interpret(
        await body(request),
      ),
    };
  });
}
