import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { config } from "./config";

export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400,
    public retryable = false,
    public retryAfter?: number,
  ) {
    super(message);
  }
}

export async function body(request: Request): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new AppError("INVALID_CONTENT_TYPE", "Send JSON data.", 415);
  if (
    request.headers.has("content-encoding") &&
    request.headers.get("content-encoding") !== "identity"
  )
    throw new AppError("INVALID_ENCODING", "Send uncompressed JSON data.", 415);
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 24000))
    throw new AppError("PAYLOAD_TOO_LARGE", "The request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("INVALID_JSON", "The request could not be read.");
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort!: () => void;
  // One deadline covers the entire stream, not a separate allowance per chunk.
  const cancelled = new Promise<never>((_, reject) => {
    const stop = (timeout: boolean) => {
      reject(
        new AppError(
          timeout ? "REQUEST_TIMEOUT" : "REQUEST_ABORTED",
          "The request could not be read. Please retry.",
          timeout ? 408 : 400,
          true,
        ),
      );
      void reader.cancel().catch(() => {});
    };
    timer = setTimeout(() => stop(true), 10000);
    abort = () => stop(false);
    request.signal.addEventListener("abort", abort, { once: true });
    if (request.signal.aborted) abort();
  });
  try {
    for (;;) {
      const { done, value } = await Promise.race([reader.read(), cancelled]);
      if (done) break;
      size += value.byteLength;
      if (size > 24000) {
        void reader.cancel().catch(() => {});
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "The request is too large.",
          413,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof AppError) throw error;
    throw new AppError("INVALID_JSON", "The request could not be read.");
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener("abort", abort);
    reader.releaseLock();
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("INVALID_JSON", "The request could not be read.");
  }
}

export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(config().APP_ORIGIN).origin)
    throw new AppError("INVALID_ORIGIN", "This request is not allowed.", 403);
}

export function json(data: unknown, status = 200, retryAfter?: number) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      ...(retryAfter
        ? {
            "Retry-After": String(
              Math.max(1, Math.min(3600, Math.ceil(retryAfter))),
            ),
          }
        : {}),
    },
  });
}

export async function handle(action: () => Promise<unknown>) {
  try {
    return json(await action());
  } catch (error) {
    const requestId = crypto.randomUUID();
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "VALIDATION",
            message: "Check the highlighted preferences.",
            fields: error.issues.map((x) => ({
              path: x.path.join("."),
              message: x.message,
            })),
            retryable: false,
            requestId,
          },
        },
        422,
      );
    if (error instanceof AppError)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            retryable: error.retryable,
            ...(error.retryAfter
              ? {
                  retryAfter: Math.max(
                    1,
                    Math.min(3600, Math.ceil(error.retryAfter)),
                  ),
                }
              : {}),
            requestId,
          },
        },
        error.status,
        error.retryAfter,
      );
    // No raw provider errors or personal input in server logs.
    console.error(JSON.stringify({ event: "request_failed", requestId }));
    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message:
            "Something went wrong. Your entries are unchanged. Please retry.",
          retryable: true,
          requestId,
        },
      },
      500,
    );
  }
}
