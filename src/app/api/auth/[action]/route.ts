import { AuthenticationController } from "@/server/controllers/AuthenticationController";
import { handle, body, sameOrigin, AppError } from "@/server/http";
import { requireSession } from "@/server/supabase";
import { config } from "@/server/config";
import { cookies } from "next/headers";
import { RECOVERY_COOKIE, resetPasswordSchema } from "@/domain/recovery";
import { PasswordRecoveryController } from "@/server/controllers/PasswordRecoveryController";

type Context = { params: Promise<{ action: string }> };
export async function POST(request: Request, context: Context) {
  return handle(async () => {
    sameOrigin(request);
    const { action } = await context.params;
    const controller = new AuthenticationController();
    if (action === "recover")
      return new PasswordRecoveryController().request(await body(request));
    if (action === "reset-password") {
      const input = resetPasswordSchema.parse(await body(request));
      const jar = await cookies();
      try {
        return await new PasswordRecoveryController().reset(
          input,
          jar.get(RECOVERY_COOKIE)?.value,
        );
      } finally {
        jar.delete(RECOVERY_COOKIE);
      }
    }
    if (action === "google") return controller.googleSignIn();
    if (action === "apple") return controller.appleSignIn();
    if (action === "sign-in") return controller.signIn(await body(request));
    if (action === "sign-up") return controller.signUp(await body(request));
    if (action === "sign-out") return controller.signOut();
    if (action === "activity") {
      await requireSession(true);
      return { active: true };
    }
    throw new AppError("NOT_FOUND", "Action not found.", 404);
  });
}
export async function GET(_request: Request, context: Context) {
  return handle(async () => {
    if ((await context.params).action !== "session")
      throw new AppError("NOT_FOUND", "Action not found.", 404);
    if (config().APP_MODE === "preview") return { user: null, mode: "preview" };
    const { user } = await requireSession(false);
    return { user: { id: user.id, email: user.email }, mode: "supabase" };
  });
}
