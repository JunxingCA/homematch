import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { acquireOperation } from "@/server/operationLimits";
import { config } from "@/server/config";

// Explicit opt-in: writes only synthetic limiter telemetry, never account/profile data.
it.skipIf(process.env.RUN_OPERATION_LIMITS_SMOKE !== "true")(
  "checks hosted admission, duplicate blocking and release through the real backend client",
  async () => {
    expect(config().OPERATION_LIMITS_ENABLED).toBe(true);
    expect(new URL(config().SUPABASE_URL!).hostname).toBe(
      "bxxcbcntnaojvepcqrcg.supabase.co",
    );
    const syntheticOwner = randomUUID();
    const release = await acquireOperation("journeys", syntheticOwner);
    try {
      await expect(
        acquireOperation("journeys", syntheticOwner),
      ).rejects.toMatchObject({ code: "EXPLORATION_BUSY", status: 429 });
    } finally {
      await release();
    }
    const releaseNext = await acquireOperation("journeys", syntheticOwner);
    await releaseNext();
  },
);
