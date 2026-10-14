import { beforeEach, expect, it, vi } from "vitest";
import { description, interpreted } from "../fixtures/interpretation";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  extract: vi.fn(),
  search: vi.fn(),
  key: "test-key",
  acquire: vi.fn(),
  release: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({
    GEMINI_API_KEY: mocks.key,
    GEMINI_MODEL: "gemini-3.8-flash",
  }),
}));
vi.mock("@/server/supabase", () => ({ requireSession: mocks.session }));
vi.mock("@/server/operationLimits", () => ({
  acquireOperation: mocks.acquire,
}));
vi.mock("@/server/adapters/AIServiceAdapter", () => ({
  AIServiceAdapter: class {
    extract = mocks.extract;
  },
}));
vi.mock("@/server/adapters/OneMapAdapter", () => ({
  OneMapAdapter: class {
    search = mocks.search;
  },
}));
import { PreferenceInterpretationController } from "@/server/controllers/PreferenceInterpretationController";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.key = "test-key";
  mocks.session.mockResolvedValue({ user: { id: crypto.randomUUID() } });
  mocks.extract.mockResolvedValue({ draft: interpreted(), model: "test" });
  mocks.search.mockResolvedValue([]);
});
it("stops before provider work when shared admission is unavailable or denied", async () => {
  mocks.acquire.mockRejectedValue(new Error("Limit unavailable"));
  await expect(
    new PreferenceInterpretationController().interpret({
      text: description,
      consent: true,
    }),
  ).rejects.toThrow("Limit unavailable");
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("releases shared admission even after provider failure", async () => {
  mocks.extract.mockRejectedValue(new Error("Provider unavailable"));
  await expect(
    new PreferenceInterpretationController().interpret({
      text: description,
      consent: true,
    }),
  ).rejects.toThrow("Provider unavailable");
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("authenticates before using providers, with no implicit account/profile writes", async () => {
  mocks.session.mockRejectedValue(Error("Session expired"));
  await expect(
    new PreferenceInterpretationController().interpret({
      text: description,
      consent: true,
    }),
  ).rejects.toThrow("Session expired");
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("requires consent and reports only configuration status, never the key", async () => {
  const controller = new PreferenceInterpretationController();
  expect(await controller.status()).toEqual({
    enabled: true,
    provider: "Gemini",
    model: "gemini-3.8-flash",
  });
  await expect(
    controller.interpret({ text: description, consent: false }),
  ).rejects.toThrow();
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("keeps extraction when OneMap is unavailable and selects no candidate automatically", async () => {
  mocks.search.mockRejectedValue(Error("Private error"));
  const result = await new PreferenceInterpretationController().interpret({
    text: description,
    consent: true,
  });
  expect(result.locations[0].candidates).toEqual([]);
  expect(result.locations[0].error).toContain("OneMap lookup unavailable");
  expect(mocks.session).toHaveBeenLastCalledWith(false);
});
it("rejects rapid duplicate requests before another provider call", async () => {
  const controller = new PreferenceInterpretationController();
  await controller.interpret({ text: description, consent: true });
  await expect(
    controller.interpret({ text: description, consent: true }),
  ).rejects.toMatchObject({ code: "AI_RATE_LIMIT" });
  expect(mocks.extract).toHaveBeenCalledTimes(1);
});
it("reserves the local guard before awaiting shared admission", async () => {
  let resolve!: (release: typeof mocks.release) => void;
  mocks.acquire.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const first = new PreferenceInterpretationController().interpret({
    text: description,
    consent: true,
  });
  await vi.waitFor(() => expect(mocks.acquire).toHaveBeenCalledOnce());
  await expect(
    new PreferenceInterpretationController().interpret({
      text: description,
      consent: true,
    }),
  ).rejects.toMatchObject({ code: "AI_RATE_LIMIT" });
  resolve(mocks.release);
  await first;
  expect(mocks.extract).toHaveBeenCalledOnce();
});
it("discards drafts after account/session changes during extraction", async () => {
  mocks.session
    .mockResolvedValueOnce({ user: { id: crypto.randomUUID() } })
    .mockResolvedValueOnce({ user: { id: crypto.randomUUID() } });
  await expect(
    new PreferenceInterpretationController().interpret({
      text: description,
      consent: true,
    }),
  ).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED" });
});
