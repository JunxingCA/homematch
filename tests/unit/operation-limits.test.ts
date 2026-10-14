import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  key: "test-only-key",
  enabled: true,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/config", () => ({
  config: () => ({
    APP_MODE: "supabase",
    SUPABASE_SERVICE_ROLE_KEY: mocks.key,
    OPERATION_LIMITS_ENABLED: mocks.enabled,
  }),
}));
vi.mock("@/server/supabase", () => ({
  adminClient: () => ({ rpc: mocks.rpc }),
}));
import { acquireOperation } from "@/server/operationLimits";
const owner = "11111111-1111-4111-8111-111111111111";
const lease = "22222222-2222-4222-8222-222222222222";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.key = "test-only-key";
  mocks.enabled = true;
  mocks.rpc.mockResolvedValue({
    data: { allowed: true, leaseId: lease },
    error: null,
  });
});
it("preserves development during staged activation but forbids production bypass", async () => {
  mocks.enabled = false;
  try {
    vi.stubEnv("NODE_ENV", "development");
    const release = await acquireOperation("ai", owner);
    await release();
    expect(mocks.rpc).not.toHaveBeenCalled();
    vi.stubEnv("NODE_ENV", "production");
    await expect(acquireOperation("ai", owner)).rejects.toMatchObject({
      code: "LIMITS_UNAVAILABLE",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllEnvs();
  }
});
it("uses a stable server-keyed pseudonym and fences release to the admission", async () => {
  const done = await acquireOperation("ai", owner);
  const args = mocks.rpc.mock.calls[0][1];
  expect(args.p_subject).toMatch(/^[a-f0-9]{64}$/);
  expect(JSON.stringify(args)).not.toContain(owner);
  await done();
  expect(mocks.rpc).toHaveBeenLastCalledWith("release_operation", {
    ...args,
    p_lease: lease,
  });
  await acquireOperation("ai", owner);
  expect(mocks.rpc.mock.calls[2][1].p_subject).toBe(args.p_subject);
  mocks.key = "rotated-private-key";
  await acquireOperation("ai", owner);
  expect(mocks.rpc.mock.calls[3][1].p_subject).not.toBe(args.p_subject);
});
it.each(["ai", "discovery", "journeys", "locations"] as const)(
  "denies %s with retry information",
  async (operation) => {
    mocks.rpc.mockResolvedValue({
      data: { allowed: false, retryAfter: 23 },
      error: null,
    });
    await expect(acquireOperation(operation, owner)).rejects.toMatchObject({
      status: 429,
      retryable: true,
      retryAfter: 23,
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
  },
);
it.each([
  { data: null, error: { message: "Private database information" } },
  { data: { allowed: true }, error: null },
  { data: { allowed: false, retryAfter: -1 }, error: null },
])(
  "fails closed on errors and invalid replies without exposing provider details",
  async (reply) => {
    mocks.rpc.mockResolvedValue(reply);
    await expect(acquireOperation("ai", owner)).rejects.toMatchObject({
      code: "LIMITS_UNAVAILABLE",
      status: 503,
      retryAfter: 30,
    });
  },
);
it("fails closed on a timeout rather than retrying an uncertain reservation", async () => {
  mocks.rpc.mockRejectedValue(new Error("Timeout"));
  await expect(acquireOperation("ai", owner)).rejects.toMatchObject({
    code: "LIMITS_UNAVAILABLE",
  });
  expect(mocks.rpc).toHaveBeenCalledOnce();
});
it("does not conceal the operation outcome if releasing its slot fails", async () => {
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    const done = await acquireOperation("ai", owner);
    mocks.rpc.mockRejectedValue(new Error("Private detail"));
    await expect(done()).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      '{"event":"operation_release_failed","operation":"ai"}',
    );
  } finally {
    log.mockRestore();
  }
});
