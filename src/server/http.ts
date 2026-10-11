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
  ) {
    super(message);
  }
}

export async function body(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new AppError("INVALID_CONTENT_TYPE", "Send JSON data.", 415);
  const reader = request.body?.getReader();
  if (!reader)
    throw new AppError("INVALID_JSON", "The request could not be read.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 24000) {
        await reader.cancel();
        throw new AppError(
          "PAYLOAD_TOO_LARGE",
          "The request is too large.",
          413,
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
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

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
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
            requestId,
          },
        },
        error.status,
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
