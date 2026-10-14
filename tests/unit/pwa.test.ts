import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import manifest from "@/app/manifest";
import config from "../../next.config";

const source = await readFile(
  new URL("../../public/sw.js", import.meta.url),
  "utf8",
);
const origin = "https://homematch.example";
const assets = [
  "/pwa/offline.html",
  "/pwa/offline.css",
  "/pwa/offline.js",
  "/homematch-logo.svg",
];
function worker() {
  const listeners: Record<string, (event: Record<string, unknown>) => void> =
    {};
  const storage = new Map<string, Map<string, Response>>();
  const cache = (name: string) => {
    if (!storage.has(name)) storage.set(name, new Map());
    const entries = storage.get(name)!;
    return {
      put: vi.fn(async (path: string, value: Response) => {
        entries.set(path, value.clone());
      }),
      match: vi.fn(async (path: string) => entries.get(path)?.clone()),
    };
  };
  const fetch = vi.fn(async (path: unknown, options?: unknown) => {
    void options;
    const response = new Response(`Public ${String(path)}`);
    Object.defineProperty(response, "type", { value: "basic" });
    return response;
  });
  const claim = vi.fn(async () => {});
  const skipWaiting = vi.fn(async () => {});
  vm.runInNewContext(source, {
    self: {
      location: { origin },
      clients: { claim },
      skipWaiting,
      addEventListener: (
        type: string,
        listener: (typeof listeners)[string],
      ) => {
        listeners[type] = listener;
      },
    },
    caches: {
      open: async (name: string) => cache(name),
      keys: async () => [...storage.keys()],
      delete: async (name: string) => storage.delete(name),
    },
    fetch,
    URL,
    Response,
  });
  return {
    storage,
    fetch,
    claim,
    skipWaiting,
    lifecycle: (type: string, data?: unknown) => {
      let pending: Promise<unknown> | undefined;
      listeners[type]({
        data,
        waitUntil: (value: Promise<unknown>) => {
          pending = value;
        },
      });
      return pending;
    },
    request: (path: string, mode = "cors", method = "GET") => {
      let pending: Promise<Response> | undefined;
      listeners.fetch({
        request: { url: new URL(path, origin).href, mode, method },
        respondWith: (value: Promise<Response>) => {
          pending = value;
        },
      });
      return pending;
    },
  };
}

describe("public-only PWA", () => {
  it("uses a stable, token-free home entry and standalone scope", () => {
    expect(manifest()).toMatchObject({
      id: "/",
      start_url: "/",
      scope: "/",
      display: "standalone",
      name: "HomeMatch",
    });
    expect(manifest().icons?.map((icon) => icon.sizes)).toEqual([
      "192x192",
      "512x512",
      "512x512",
    ]);
    expect(manifest().icons?.at(-1)?.purpose).toBe("maskable");
  });
  it("ships correctly sized PNG icons", async () => {
    for (const [name, size] of [
      ["icon-192.png", 192],
      ["icon-512.png", 512],
      ["icon-maskable-512.png", 512],
      ["apple-touch-icon.png", 180],
      ["favicon-32.png", 32],
    ] as const) {
      const png = await readFile(
        new URL(`../../public/pwa/${name}`, import.meta.url),
      );
      expect(png.readUInt32BE(16)).toBe(size);
      expect(png.readUInt32BE(20)).toBe(size);
    }
  });
  it("precaches only the four public assets without credentials or redirects", async () => {
    const w = worker();
    await w.lifecycle("install");
    expect(w.fetch.mock.calls.map(([path]) => path)).toEqual(assets);
    for (const call of w.fetch.mock.calls)
      expect(call[1]).toEqual({
        credentials: "omit",
        cache: "reload",
        redirect: "error",
      });
    expect([...w.storage.get("homematch-offline-v1")!.keys()]).toEqual(assets);
    expect(w.skipWaiting).not.toHaveBeenCalled();
  });
  it("fails installation if an offline asset is unavailable", async () => {
    const w = worker();
    w.fetch.mockResolvedValueOnce(new Response("Unavailable", { status: 503 }));
    await expect(w.lifecycle("install")).rejects.toThrow(
      "Offline assets unavailable",
    );
  });
  it.each([
    ["/api/auth/session", "cors", "GET"],
    ["/api/auth/session", "navigate", "GET"],
    ["/_next/static/private.js", "navigate", "GET"],
    ["/api/profiles", "cors", "GET"],
    ["/api/profiles", "cors", "POST"],
    ["/api/account", "cors", "DELETE"],
    ["/api/discoveries", "cors", "GET"],
    ["/api/shortlist", "cors", "GET"],
    ["/api/preferences/interpret", "cors", "POST"],
    ["/?_rsc=private", "cors", "GET"],
    ["/_next/static/private.js", "cors", "GET"],
    ["https://www.onemap.gov.sg/maps/tiles/1", "cors", "GET"],
  ])(
    "never handles or caches private/provider request %s %s %s",
    (path, mode, method) => {
      const w = worker();
      expect(w.request(path, mode, method)).toBeUndefined();
      expect(w.fetch).not.toHaveBeenCalled();
      expect(w.storage.size).toBe(0);
    },
  );
  it("returns online navigations without storing responses", async () => {
    const w = worker();
    w.fetch.mockResolvedValueOnce(
      new Response("Private authenticated document"),
    );
    expect(await (await w.request("/", "navigate"))?.text()).toContain(
      "Private authenticated document",
    );
    expect(w.storage.size).toBe(0);
  });
  it.each([
    "/",
    "/auth/callback?code=secret",
    "/auth/recovery?token_hash=secret",
    "/reset-password",
  ])(
    "uses generic offline content for %s without storing tokens",
    async (path) => {
      const w = worker();
      await w.lifecycle("install");
      w.fetch.mockRejectedValueOnce(new TypeError("Offline"));
      expect(await (await w.request(path, "navigate"))?.text()).toBe(
        "Public /pwa/offline.html",
      );
      expect([...w.storage.get("homematch-offline-v1")!.keys()]).toEqual(
        assets,
      );
    },
  );
  it("fails safely when its offline cache has been evicted", async () => {
    const w = worker();
    w.fetch.mockRejectedValueOnce(new TypeError("Offline"));
    const response = await w.request("/", "navigate");
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });
  it("cleans up only older HomeMatch offline caches on activation", async () => {
    const w = worker();
    await w.lifecycle("install");
    w.storage.set("homematch-offline-old", new Map());
    w.storage.set("another-application", new Map());
    await w.lifecycle("activate");
    expect([...w.storage.keys()]).toEqual([
      "homematch-offline-v1",
      "another-application",
    ]);
    expect(w.claim).toHaveBeenCalledOnce();
  });
  it("activates updates only on the explicit update message", async () => {
    const w = worker();
    w.lifecycle("message", { type: "OTHER" });
    expect(w.skipWaiting).not.toHaveBeenCalled();
    await w.lifecycle("message", { type: "ACTIVATE_UPDATE" });
    expect(w.skipWaiting).toHaveBeenCalledOnce();
  });
  it("uses uncached worker updates and a locked-down offline document", async () => {
    const headers = await config.headers!();
    expect(
      headers.find((item) => item.source === "/sw.js")?.headers,
    ).toContainEqual({ key: "Cache-Control", value: "no-store, max-age=0" });
    expect(
      headers.find((item) => item.source === "/pwa/offline.html")?.headers,
    ).toContainEqual({
      key: "Content-Security-Policy",
      value:
        "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    });
    const html = await readFile(
      new URL("../../public/pwa/offline.html", import.meta.url),
      "utf8",
    );
    expect(html).toContain('href="/"');
    expect(html).not.toMatch(/https?:\/\//);
    const offline = await readFile(
      new URL("../../public/pwa/offline.js", import.meta.url),
      "utf8",
    );
    expect(offline).not.toMatch(/location\.(reload|search)|fetch\(/);
  });
});
