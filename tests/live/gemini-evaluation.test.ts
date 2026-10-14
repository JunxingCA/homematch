import { mkdir, writeFile } from "node:fs/promises";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import type { Interpretation } from "@/domain/interpretation";
import { evaluationCases } from "../fixtures/interpretation-evaluation";

vi.mock("server-only", () => ({}));
import { AIServiceAdapter } from "@/server/adapters/AIServiceAdapter";

const enabled = process.env.RUN_GEMINI_EVAL === "true";
const selected = process.env.GEMINI_EVAL_CASES?.split(",");
if (selected?.some((id) => !evaluationCases.some((c) => c.id === id)))
  throw Error("Unknown synthetic evaluation case");
const cases = evaluationCases.filter(
  (c) => !selected || selected.includes(c.id),
);
const startedAt = new Date().toISOString();
const results: {
  caseId: string;
  status: string;
  elapsedMs?: number;
  code?: string;
  draft?: Interpretation;
  usage?: Record<string, unknown>;
}[] = [];
let blocked = false;
let attempts = 0;
let lastFinished = 0;
let usage: Record<string, unknown> | undefined;
let log: ReturnType<typeof vi.spyOn> | undefined;

beforeAll(() => {
  if (!enabled) return;
  if (!process.env.GEMINI_API_KEY)
    throw Error("Configure the private Gemini key before opting in.");
  log = vi.spyOn(console, "info").mockImplementation((line) => {
    if (typeof line !== "string") return;
    try {
      const parsed = JSON.parse(line);
      if (parsed.event === "ai_extraction_usage") usage = parsed;
    } catch {
      /* Ignore unrelated logs, never record raw provider output. */
    }
  });
});
afterAll(async () => {
  log?.mockRestore();
  if (!enabled) return;
  const report = {
    startedAt,
    model: process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
    syntheticOnly: true,
    accountWrites: false,
    maxAttempts: 8,
    attempts,
    results,
  };
  await mkdir("test-results", { recursive: true });
  const json = JSON.stringify(report, null, 2) + "\n";
  await writeFile(
    `test-results/gemini-evaluation-${startedAt.replace(/[:.]/g, "-")}.json`,
    json,
  );
  await writeFile("test-results/gemini-evaluation.json", json);
});

for (const scenario of cases) {
  it.skipIf(!enabled)(
    `live Gemini: ${scenario.id}`,
    async (context) => {
      if (blocked) {
        results.push({
          caseId: scenario.id,
          status: "blocked-by-provider-quota",
        });
        context.skip(
          "Stopped after provider quota response; no automatic retries.",
        );
      }
      if (lastFinished)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.max(0, lastFinished + 5000 - Date.now())),
        );
      expect(attempts).toBeLessThan(8);
      attempts++;
      usage = undefined;
      const start = performance.now();
      let draft: Interpretation | undefined;
      try {
        const response = await new AIServiceAdapter().extract(scenario.text);
        draft = response.draft;
        scenario.verify(draft);
        results.push({
          caseId: scenario.id,
          status: "passed",
          elapsedMs: Math.round(performance.now() - start),
          draft,
          usage,
        });
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "SEMANTIC_ASSERTION_FAILED";
        blocked = code === "AI_QUOTA";
        results.push({
          caseId: scenario.id,
          status: "failed",
          elapsedMs: Math.round(performance.now() - start),
          code,
          draft,
          usage,
        });
        throw error;
      } finally {
        lastFinished = Date.now();
      }
    },
    40000,
  );
}
