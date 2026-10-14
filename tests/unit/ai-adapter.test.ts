import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { description, interpreted } from "../fixtures/interpretation";
const mocks = vi.hoisted(() => ({ generate: vi.fn(), key: "test-key" }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({
    GEMINI_API_KEY: mocks.key,
    GEMINI_MODEL: "gemini-3.8-flash",
  }),
}));
vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generate };
  },
  ThinkingLevel: { LOW: "LOW" },
}));
import { AIServiceAdapter } from "@/server/adapters/AIServiceAdapter";
import { extractionInstructions } from "@/server/adapters/AIServiceAdapter";
beforeEach(() => {
  mocks.key = "test-key";
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  mocks.generate.mockResolvedValue({
    text: JSON.stringify(interpreted()),
    candidates: [{ finishReason: "STOP" }],
    usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 200 },
  });
});
afterEach(() => vi.restoreAllMocks());
it("sends only the description with schema, no tools, bounded timeout/output and no retry", async () => {
  const result = await new AIServiceAdapter().extract(description);
  expect(result.draft.budgetMax).toBe(600000);
  const request = mocks.generate.mock.calls[0][0];
  expect(request.contents).toEqual([
    { role: "user", parts: [{ text: description }] },
  ]);
  expect(request.config.tools).toBeUndefined();
  expect(request.config.maxOutputTokens).toBe(4096);
  expect(request.config.httpOptions.retryOptions.attempts).toBe(1);
  expect(request.config.responseJsonSchema.additionalProperties).toBe(false);
  expect(console.info).toHaveBeenCalledWith(
    expect.not.stringContaining(description),
  );
});
it("fails closed without a key, keeping manual entry available", async () => {
  mocks.key = "";
  await expect(
    new AIServiceAdapter().extract(description),
  ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED" });
  expect(mocks.generate).not.toHaveBeenCalled();
});
it("describes partial activities and destinations without requiring invented numeric defaults", async () => {
  await new AIServiceAdapter().extract(description);
  expect(extractionInstructions).toContain(
    "Missing numbers do NOT make an activity unsupported",
  );
  const schema = JSON.stringify(
    mocks.generate.mock.calls[0][0].config.responseJsonSchema,
  );
  expect(schema).toContain("retain the mentioned category");
  expect(schema).toContain("Keep the named destination");
});
it.each(["SAFETY", "MAX_TOKENS", "RECITATION"])(
  "rejects %s output rather than applying a partial draft",
  async (finishReason) => {
    mocks.generate.mockResolvedValue({
      text: JSON.stringify(interpreted()),
      candidates: [{ finishReason }],
    });
    await expect(
      new AIServiceAdapter().extract(description),
    ).rejects.toMatchObject({ code: "AI_INCOMPLETE" });
  },
);
it("sanitises invalid JSON and provider errors", async () => {
  mocks.generate.mockResolvedValue({
    text: "not JSON",
    candidates: [{ finishReason: "STOP" }],
  });
  await expect(
    new AIServiceAdapter().extract(description),
  ).rejects.toMatchObject({ code: "AI_UNAVAILABLE" });
  mocks.generate.mockRejectedValue({
    status: 429,
    message: "secret provider information",
  });
  await expect(
    new AIServiceAdapter().extract(description),
  ).rejects.toMatchObject({ code: "AI_QUOTA" });
});
