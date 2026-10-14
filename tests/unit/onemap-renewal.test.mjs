import { describe, expect, it, vi } from "vitest";
import { createOneMapClient } from "../../src/server/providers/oneMapClient.mjs";

const time = Date.parse("2026-10-14T00:00:00Z");
const url = "https://www.onemap.gov.sg/api/common/elastic/search?searchVal=NTU";
const jwt = (expires) =>
  `header.${Buffer.from(JSON.stringify({ exp: expires / 1000 })).toString("base64url")}.signature`;
function fixture(
  env = {
    ONEMAP_EMAIL: "test@example.com",
    ONEMAP_PASSWORD: "PRIVATE PASSWORD",
  },
) {
  const fetcher = vi.fn();
  const now = vi.fn(() => time);
  const client = createOneMapClient({ getEnv: () => env, fetcher, now });
  return { client, env, fetcher, now };
}
const auth = (token = "RENEWED", expiry = time + 3 * 86400000) =>
  Response.json({
    access_token: token,
    expiry_timestamp: String(expiry / 1000),
  });

describe("server-only OneMap renewal", () => {
  it.each(["23", "9000", "not-a-date"])(
    "bounds quota retry information (%s) without retries or token renewal",
    async (value) => {
      const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
      f.fetcher.mockResolvedValue(
        new Response("private provider details", {
          status: 429,
          headers: { "retry-after": value },
        }),
      );
      await expect(f.client.json(url)).rejects.toMatchObject({
        retryAfter: value === "23" ? 23 : value === "9000" ? 300 : 60,
      });
      expect(f.fetcher).toHaveBeenCalledOnce();
    },
  );
  it("rejects an excessive declared response before parsing it", async () => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    f.fetcher.mockResolvedValue(
      new Response("{}", {
        headers: { "content-length": String(3 * 1024 * 1024) },
      }),
    );
    await expect(f.client.json(url)).rejects.toThrow("OneMap authentication");
  });
  it("bounds actual response bytes even without a declared size", async () => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    f.fetcher.mockResolvedValue(new Response("x".repeat(2 * 1024 * 1024 + 1)));
    await expect(f.client.json(url)).rejects.toThrow("OneMap authentication");
  });
  it("cancels a stalled provider body when the caller aborts", async () => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    const cancel = vi.fn();
    f.fetcher.mockResolvedValue(new Response(new ReadableStream({ cancel })));
    const controller = new AbortController();
    const pending = f.client.json(url, { signal: controller.signal });
    const check = expect(pending).rejects.toThrow("OneMap authentication");
    await vi.waitFor(() => expect(f.fetcher).toHaveBeenCalledOnce());
    controller.abort();
    await check;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it("exchanges credentials only over the fixed HTTPS auth endpoint and caches the result", async () => {
    const f = fixture();
    f.fetcher.mockResolvedValue(auth());
    expect(await f.client.getToken()).toBe("RENEWED");
    expect(await f.client.getToken()).toBe("RENEWED");
    expect(f.fetcher).toHaveBeenCalledOnce();
    const [address, options] = f.fetcher.mock.calls[0];
    expect(address).toBe("https://www.onemap.gov.sg/api/auth/post/getToken");
    expect(options).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
    });
    expect(JSON.parse(options.body)).toEqual({
      email: "test@example.com",
      password: "PRIVATE PASSWORD",
    });
  });
  it("uses a shared renewal flight for simultaneous requests", async () => {
    const f = fixture();
    let resolve;
    f.fetcher.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const values = Array.from({ length: 8 }, () => f.client.getToken());
    resolve(auth());
    expect(await Promise.all(values)).toEqual(Array(8).fill("RENEWED"));
    expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it("renews five minutes before known expiry", async () => {
    const f = fixture();
    f.fetcher
      .mockResolvedValueOnce(auth("FIRST", time + 3600000))
      .mockResolvedValueOnce(auth("SECOND"));
    expect(await f.client.getToken()).toBe("FIRST");
    f.now.mockReturnValue(time + 3600000 - 300000);
    expect(await f.client.getToken()).toBe("SECOND");
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it("keeps manual token-only setups working without sending credentials", async () => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    f.fetcher.mockResolvedValue(Response.json({ results: [] }));
    expect(await f.client.json(url)).toEqual({ results: [] });
    expect(f.fetcher.mock.calls[0][1].headers.Authorization).toBe("MANUAL");
    expect(f.fetcher).toHaveBeenCalledOnce();
  });
  it("does not reuse an expired manual JWT", async () => {
    const f = fixture({ ONEMAP_TOKEN: jwt(time - 1) });
    await expect(f.client.getToken()).rejects.toThrow("OneMap authentication");
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 403])(
    "renews and retries a rejected %s token once, even with a non-JSON error",
    async (status) => {
      const f = fixture({
        ONEMAP_TOKEN: "OLD",
        ONEMAP_EMAIL: "test@example.com",
        ONEMAP_PASSWORD: "PRIVATE PASSWORD",
      });
      f.fetcher
        .mockResolvedValueOnce(new Response("unauthorized", { status }))
        .mockResolvedValueOnce(auth())
        .mockResolvedValueOnce(Response.json({ results: [] }));
      expect(await f.client.json(url)).toEqual({ results: [] });
      expect(f.fetcher.mock.calls[0][1].headers.Authorization).toBe("OLD");
      expect(f.fetcher.mock.calls[2][1].headers.Authorization).toBe("RENEWED");
      expect(f.fetcher).toHaveBeenCalledTimes(3);
    },
  );
  it("recognises HTTP-200 token-expiry errors", async () => {
    const f = fixture({
      ONEMAP_TOKEN: "OLD",
      ONEMAP_EMAIL: "test@example.com",
      ONEMAP_PASSWORD: "PRIVATE PASSWORD",
    });
    f.fetcher
      .mockResolvedValueOnce(Response.json({ error: "Token expired" }))
      .mockResolvedValueOnce(auth())
      .mockResolvedValueOnce(Response.json({ results: [] }));
    expect(await f.client.json(url)).toEqual({ results: [] });
  });
  it("does not repeatedly exchange credentials when the replacement is also rejected", async () => {
    const f = fixture();
    f.fetcher
      .mockResolvedValueOnce(auth("FIRST"))
      .mockResolvedValueOnce(Response.json({ error: "expired" }))
      .mockResolvedValueOnce(auth("SECOND"))
      .mockResolvedValueOnce(Response.json({ error: "expired" }));
    await expect(f.client.json(url)).rejects.toThrow("OneMap authentication");
    expect(f.fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([
    { access_token: "TOKEN", expiry_timestamp: "bad" },
    { access_token: "", expiry_timestamp: (time + 3600000) / 1000 },
    { access_token: "TOKEN", expiry_timestamp: (time - 1) / 1000 },
    { access_token: "TOKEN", expiry_timestamp: (time + 8 * 86400000) / 1000 },
  ])(
    "rejects malformed authentication responses without leaking their body",
    async (body) => {
      const f = fixture();
      f.fetcher.mockResolvedValue(Response.json(body));
      await expect(f.client.getToken()).rejects.toThrow(
        "OneMap authentication",
      );
    },
  );
  it("backs off after renewal failure while preserving a still-valid token", async () => {
    const f = fixture({
      ONEMAP_TOKEN: jwt(time + 120000),
      ONEMAP_EMAIL: "test@example.com",
      ONEMAP_PASSWORD: "PRIVATE PASSWORD",
    });
    f.fetcher.mockRejectedValue(new Error("PRIVATE PASSWORD provider echo"));
    expect(await f.client.getToken()).toBe(f.env.ONEMAP_TOKEN);
    expect(await f.client.getToken()).toBe(f.env.ONEMAP_TOKEN);
    expect(f.fetcher).toHaveBeenCalledOnce();
    f.now.mockReturnValue(time + 120001);
    await expect(f.client.getToken()).rejects.toThrow("OneMap authentication");
  });
  it("does not fall back to a rejected token on renewal failure", async () => {
    const f = fixture({
      ONEMAP_TOKEN: "REJECTED",
      ONEMAP_EMAIL: "test@example.com",
      ONEMAP_PASSWORD: "PRIVATE PASSWORD",
    });
    f.fetcher
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockRejectedValue(new Error("PRIVATE PASSWORD"));
    await expect(f.client.json(url)).rejects.toThrow("OneMap authentication");
    expect(f.fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    "https://attacker.example/api/common/elastic/search",
    "http://www.onemap.gov.sg/api/common/elastic/search",
    "https://www.onemap.gov.sg/api/auth/post/getToken",
    "https://user:pass@www.onemap.gov.sg/api/common/elastic/search",
  ])("never sends a token to unsafe endpoint %s", async (address) => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    await expect(f.client.json(address)).rejects.toThrow(
      "OneMap authentication",
    );
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("never sends an aborted caller's data request", async () => {
    const f = fixture({ ONEMAP_TOKEN: "MANUAL" });
    const controller = new AbortController();
    controller.abort();
    await expect(
      f.client.json(url, { signal: controller.signal }),
    ).rejects.toThrow();
    expect(f.fetcher).not.toHaveBeenCalled();
  });
  it("does not authenticate on ordinary provider failures", async () => {
    const f = fixture({
      ONEMAP_TOKEN: "MANUAL",
      ONEMAP_EMAIL: "test@example.com",
      ONEMAP_PASSWORD: "PRIVATE PASSWORD",
    });
    f.fetcher.mockResolvedValue(new Response("unavailable", { status: 503 }));
    await expect(f.client.json(url)).rejects.toThrow("OneMap authentication");
    expect(f.fetcher).toHaveBeenCalledOnce();
  });
});
