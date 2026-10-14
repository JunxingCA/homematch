import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { boundedFetch } from "@/server/boundedFetch";
afterEach(() => vi.unstubAllGlobals());
it("preserves request options, adds cancellation and never retries failed writes", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Timeout"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    boundedFetch("https://db.test", { method: "POST", body: "{}" }),
  ).rejects.toThrow("Timeout");
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    body: "{}",
    signal: expect.any(AbortSignal),
  });
});
it("preserves a caller abort for both Request inputs and explicit options", async () => {
  const fetch = vi.fn().mockResolvedValue(Response.json({}));
  vi.stubGlobal("fetch", fetch);
  for (const explicit of [true, false]) {
    const controller = new AbortController();
    const input = new Request("https://db.test", { signal: controller.signal });
    await boundedFetch(
      input,
      explicit ? { signal: controller.signal } : undefined,
    );
    const signal = fetch.mock.calls.at(-1)![1].signal;
    expect(signal.aborted).toBe(false);
    controller.abort();
    expect(signal.aborted).toBe(true);
  }
});
