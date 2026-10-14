import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { config } from "./config";
import { AppError } from "./http";
import { adminClient } from "./supabase";

export type LimitedOperation = "ai" | "discovery" | "journeys" | "locations";
const admissionSchema = z.discriminatedUnion("allowed", [
  z.object({ allowed: z.literal(true), leaseId: z.uuid() }),
  z.object({
    allowed: z.literal(false),
    retryAfter: z.number().int().min(1).max(3600),
  }),
]);
const codes: Record<LimitedOperation, string> = {
  ai: "AI_RATE_LIMIT",
  discovery: "DISCOVERY_BUSY",
  journeys: "EXPLORATION_BUSY",
  locations: "LOCATION_RATE_LIMIT",
};

// Call only after server-side identity verification. Never accept a request body owner.
export async function acquireOperation(
  operation: LimitedOperation,
  verifiedUserId: string,
) {
  const env = config();
  // Stage activation without disrupting local development. Production never bypasses admission.
  if (!env.OPERATION_LIMITS_ENABLED && process.env.NODE_ENV === "development")
    return async () => {};
  if (
    !env.OPERATION_LIMITS_ENABLED ||
    env.APP_MODE !== "supabase" ||
    !env.SUPABASE_SERVICE_ROLE_KEY
  )
    throw new AppError(
      "LIMITS_UNAVAILABLE",
      "Request protection is unavailable. Please retry.",
      503,
      true,
      30,
    );
  const subject = createHmac("sha256", env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`homematch:operation-limits:v1:${z.uuid().parse(verifiedUserId)}`)
    .digest("hex");
  const client = adminClient();
  let admission: z.infer<typeof admissionSchema>;
  try {
    const { data, error } = await client.rpc("acquire_operation", {
      p_operation: operation,
      p_subject: subject,
    });
    if (error) throw new Error("Admission unavailable");
    admission = admissionSchema.parse(data);
  } catch {
    // Missing migration, timeout or malformed reply must never bypass admission.
    throw new AppError(
      "LIMITS_UNAVAILABLE",
      "Request protection is unavailable. Please retry.",
      503,
      true,
      30,
    );
  }
  if (!admission.allowed)
    throw new AppError(
      codes[operation],
      "Please wait before trying again. The account or service request limit has been reached.",
      429,
      true,
      admission.retryAfter,
    );
  const leaseId = admission.leaseId;
  return async () => {
    try {
      const { error } = await client.rpc("release_operation", {
        p_operation: operation,
        p_subject: subject,
        p_lease: leaseId,
      });
      if (error) throw new Error("Release unavailable");
    } catch {
      // Do not overwrite a completed result. A crashed/uncertain release expires at its fixed deadline.
      console.warn(
        JSON.stringify({ event: "operation_release_failed", operation }),
      );
    }
  };
}
