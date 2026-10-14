import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { AppError, body, handle } from "@/server/http";
const request = (content: BodyInit, headers = {}, signal?: AbortSignal) =>
  new Request("https://homematch.test/api/test", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: content,
    signal,
    duplex: "half",
  } as RequestInit);
afterEach(() => vi.useRealTimers());
it("accepts UTF-8 JSON across chunk boundaries and media-type parameters", async () => {
  const data = new TextEncoder().encode('{"name":"\u00e9"}');
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(data.slice(0, 10));
      c.enqueue(data.slice(10));
      c.close();
    },
  });
  expect(
    await body(
      request(stream, { "content-type": "Application/JSON; charset=utf-8" }),
    ),
  ).toEqual({ name: "\u00e9" });
});
it("rejects misleading types, compressed data and excessive declared lengths", async () => {
  await expect(
    body(request("{}", { "content-type": "application/json-evil" })),
  ).rejects.toMatchObject({ status: 415 });
  await expect(
    body(request("{}", { "content-encoding": "gzip" })),
  ).rejects.toMatchObject({ status: 415 });
  await expect(
    body(request("{}", { "content-length": "24001" })),
  ).rejects.toMatchObject({ status: 413 });
});
it("enforces streamed limits even if content length is absent or false", async () => {
  await expect(
    body(request("x".repeat(24001), { "content-length": "2" })),
  ).rejects.toMatchObject({ status: 413 });
});
it("rejects oversized bodies without waiting for stalled stream cancellation", async () => {
  vi.useFakeTimers();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(24001));
    },
    cancel() {
      return new Promise(() => {});
    },
  });
  await expect(body(request(stream))).rejects.toMatchObject({ status: 413 });
  expect(vi.getTimerCount()).toBe(0);
});
it("rejects invalid UTF-8 and malformed JSON", async () => {
  await expect(body(request(new Uint8Array([0xff])))).rejects.toMatchObject({
    code: "INVALID_JSON",
  });
  await expect(body(request("{"))).rejects.toMatchObject({
    code: "INVALID_JSON",
  });
});
it("cancels a stalled body at a total ten-second deadline", async () => {
  vi.useFakeTimers();
  const cancel = vi.fn();
  const pending = body(request(new ReadableStream({ cancel })));
  const check = expect(pending).rejects.toMatchObject({
    status: 408,
    retryable: true,
  });
  await vi.advanceTimersByTimeAsync(10000);
  await check;
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("cancels an interrupted request without leaving the deadline running", async () => {
  vi.useFakeTimers();
  const controller = new AbortController();
  const cancel = vi.fn();
  const pending = body(
    request(new ReadableStream({ cancel }), {}, controller.signal),
  );
  const check = expect(pending).rejects.toMatchObject({
    code: "REQUEST_ABORTED",
  });
  controller.abort();
  await check;
  expect(cancel).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
it("returns bounded Retry-After in a private no-store error response", async () => {
  const response = await handle(async () => {
    throw new AppError("LIMIT", "Wait", 429, true, 9000);
  });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("3600");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await response.json()).error.retryAfter).toBe(3600);
});
