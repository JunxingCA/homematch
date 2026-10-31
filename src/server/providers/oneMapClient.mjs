import { z } from "zod";

const AUTH_URL = "https://www.onemap.gov.sg/api/auth/post/getToken";
const PATHS = new Set([
  "/api/common/elastic/search",
  "/api/public/themesvc/retrieveTheme",
  "/api/public/routingsvc/route",
]);
const renewalSchema = z.object({
  access_token: z.string().min(1).max(32768),
  expiry_timestamp: z.coerce.number().int().positive(),
});
export class OneMapError extends Error {
  constructor(retryAfter) {
    super(
      "OneMap authentication or request is unavailable. Check server configuration and retry.",
    );
    this.retryAfter = retryAfter;
  }
}

async function readJson(response, maxBytes, signal) {
  if (
    !response.body ||
    Number(response.headers.get("content-length")) > maxBytes
  ) {
    void response.body?.cancel().catch(() => {});
    throw new OneMapError();
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0,
    text = "",
    abort;
  const cancelled = new Promise((_, reject) => {
    abort = () => {
      reject(new OneMapError());
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new OneMapError();
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    signal.removeEventListener("abort", abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function quotaError(response, now) {
  const value = response.headers.get("retry-after");
  const seconds =
    value && /^\d+$/.test(value)
      ? Number(value)
      : (Date.parse(value ?? "") - now) / 1000;
  void response.body?.cancel().catch(() => {});
  return new OneMapError(
    Number.isFinite(seconds)
      ? Math.max(1, Math.min(300, Math.ceil(seconds)))
      : 60,
  );
}

// JWT decoding is an expiry hint only, never identity verification or authorization.
function expiryHint(token) {
  try {
    const expiry = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ).exp;
    return Number.isFinite(expiry) && expiry > 0 ? expiry * 1000 : Infinity;
  } catch {
    return Infinity;
  }
}
function rejected(response, body) {
  return (
    [401, 403].includes(response.status) ||
    /expir|invalid.*token|token.*invalid|unauthor|authenticat/i.test(
      String(body?.error ?? body?.errorMsg ?? ""),
    )
  );
}

export function createOneMapClient({
  getEnv = () => process.env,
  fetcher = (...args) => fetch(...args),
  now = () => Date.now(),
} = {}) {
  let token,
    expiry = 0,
    pending,
    cooldown = 0,
    rateLimitedUntil = 0,
    previous;
  function settings() {
    const env = getEnv();
    const current = {
      seed: env.ONEMAP_TOKEN?.trim(),
      email: env.ONEMAP_EMAIL?.trim(),
      password: env.ONEMAP_PASSWORD,
    };
    if (
      !previous ||
      Object.keys(current).some((key) => previous[key] !== current[key])
    ) {
      token = current.seed;
      expiry = token ? expiryHint(token) : 0;
      cooldown = 0;
      previous = current;
    }
    return current;
  }
  async function getToken(rejectedToken) {
    const env = settings();
    const invalid = rejectedToken && token === rejectedToken;
    if (!invalid && token && expiry > now() + 300000) return token;
    if (!env.email || !env.password) {
      if (!env.email && !env.password && !invalid && token && expiry > now())
        return token;
      throw new OneMapError();
    }
    if (pending) return pending;
    if (cooldown > now()) {
      if (!invalid && token && expiry > now() + 30000) return token;
      throw new OneMapError();
    }
    const renewingSettings = previous;
    pending = (async () => {
      try {
        const signal = AbortSignal.timeout(8000);
        const response = await fetcher(AUTH_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: env.email, password: env.password }),
          cache: "no-store",
          redirect: "error",
          signal,
        });
        if (!response.ok) throw new OneMapError();
        const result = renewalSchema.parse(
          await readJson(response, 65536, signal),
        );
        const expires = result.expiry_timestamp * 1000;
        if (expires <= now() + 60000 || expires > now() + 7 * 86400000)
          throw new OneMapError();
        settings();
        if (previous !== renewingSettings) throw new OneMapError();
        token = result.access_token;
        expiry = expires;
        cooldown = 0;
        return token;
      } catch {
        cooldown = now() + 30000;
        if (!invalid && token && expiry > now() + 30000) return token;
        throw new OneMapError();
      } finally {
        pending = undefined;
      }
    })();
    return pending;
  }
  async function json(input, { signal, timeoutMs = 8000 } = {}) {
    const url = new URL(input);
    if (
      url.origin !== "https://www.onemap.gov.sg" ||
      !PATHS.has(url.pathname) ||
      url.username ||
      url.password
    )
      throw new OneMapError();
    const deadline = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
      : AbortSignal.timeout(timeoutMs);
    let current = await getToken();
    for (let attempt = 0; attempt < 2; attempt++) {
      deadline.throwIfAborted();
      if (rateLimitedUntil > now())
        throw new OneMapError(Math.ceil((rateLimitedUntil - now()) / 1000));
      const response = await fetcher(url, {
        headers: { Authorization: current },
        cache: "no-store",
        redirect: "error",
        signal: deadline,
      });
      if (response.status === 429) {
        const error = quotaError(response, now());
        rateLimitedUntil = Math.max(
          rateLimitedUntil,
          now() + error.retryAfter * 1000,
        );
        throw error;
      }
      let body;
      try {
        body = await readJson(
          response,
          url.pathname.includes("themesvc")
            ? 16 * 1024 * 1024
            : 2 * 1024 * 1024,
          deadline,
        );
      } catch {
        if (![401, 403].includes(response.status)) throw new OneMapError();
      }
      if (rejected(response, body)) {
        if (attempt) throw new OneMapError();
        current = await getToken(current);
        continue;
      }
      if (!response.ok || body?.error || body?.errorMsg)
        throw new OneMapError();
      return body;
    }
    throw new OneMapError();
  }
  return { getToken, json };
}
