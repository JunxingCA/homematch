import "server-only";
import {
  interpretationRequest,
  type InterpretationResult,
} from "@/domain/interpretation";
import { requireSession } from "../supabase";
import { config } from "../config";
import { AppError } from "../http";
import { AIServiceAdapter } from "../adapters/AIServiceAdapter";
import { OneMapAdapter } from "../adapters/OneMapAdapter";
import { acquireOperation } from "../operationLimits";

// Keep the original local guard during staged activation of the shared limiter.
const usage = new Map<
  string,
  { since: number; last: number; count: number; running: boolean }
>();

export class PreferenceInterpretationController {
  async status() {
    await requireSession();
    const env = config();
    return {
      enabled: Boolean(env.GEMINI_API_KEY),
      provider: "Gemini",
      model: env.GEMINI_MODEL,
    };
  }
  async interpret(input: unknown): Promise<InterpretationResult> {
    const { user } = await requireSession();
    const { text } = interpretationRequest.parse(input);
    if (!config().GEMINI_API_KEY)
      throw new AppError(
        "AI_NOT_CONFIGURED",
        "Gemini is not configured. Manual entry is available.",
        503,
      );
    const now = Date.now();
    for (const [id, entry] of usage)
      if (!entry.running && now - entry.since >= 3600000) usage.delete(id);
    const entry = usage.get(user.id) ?? {
      since: now,
      last: 0,
      count: 0,
      running: false,
    };
    if (
      entry.running ||
      now - entry.last < 10000 ||
      entry.count >= 10 ||
      (!usage.has(user.id) && usage.size >= 1000)
    )
      throw new AppError(
        "AI_RATE_LIMIT",
        "Please wait before trying again. AI extraction allows up to 10 attempts per hour per account.",
        429,
        true,
        entry.count >= 10
          ? Math.max(1, Math.ceil((entry.since + 3600000 - now) / 1000))
          : 10,
      );
    let release: (() => Promise<void>) | undefined;
    entry.running = true;
    entry.last = now;
    entry.count++;
    usage.set(user.id, entry);
    try {
      release = await acquireOperation("ai", user.id);
      const result = await new AIServiceAdapter().extract(text);
      const locations: InterpretationResult["locations"] = [];
      for (const destination of result.draft.destinations ?? []) {
        try {
          locations.push({
            query: destination.query,
            candidates: await new OneMapAdapter().search(destination.query),
            error: null,
          });
        } catch {
          locations.push({
            query: destination.query,
            candidates: [],
            error:
              "OneMap lookup unavailable. Search and select this destination in the form.",
          });
        }
      }
      const verified = await requireSession(false);
      if (verified.user.id !== user.id)
        throw new AppError(
          "SIGN_IN_REQUIRED",
          "Sign in again before reviewing your draft.",
          401,
        );
      return { ...result, locations };
    } finally {
      entry.running = false;
      await release?.();
    }
  }
}
