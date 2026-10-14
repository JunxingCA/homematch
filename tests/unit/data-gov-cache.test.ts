import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({
  adminClient: () => ({
    from: () => ({
      select: () => ({
        order: () => ({ limit: () => ({ maybeSingle: mocks.load }) }),
      }),
    }),
  }),
}));
const snapshot = () => ({
  id: "public-snapshot",
  fetchedAt: "2026-10-14T00:00:00Z",
  sourceUrl: "https://data.gov.sg",
  sourceHash: "hash",
  latestMonth: "2026-09",
  importedRows: 5,
  supportedFacilities: [],
  facilitySources: [],
  facilities: [],
  prices: [],
  areas: [
    {
      id: "bedok",
      name: "BEDOK",
      originLabel: "Bedok MRT",
      latitude: 1.32,
      longitude: 103.93,
    },
  ],
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.resetModules();
});
afterEach(() => vi.useRealTimers());
it("shares one validated public snapshot load across fifty callers, preserving source freshness", async () => {
  const { DataGovAdapter } = await import("@/server/adapters/DataGovAdapter");
  let resolve!: (value: unknown) => void;
  mocks.load.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const calls = Array.from({ length: 50 }, () =>
    new DataGovAdapter().snapshot(),
  );
  expect(mocks.load).toHaveBeenCalledOnce();
  resolve({ data: { payload: snapshot() }, error: null });
  const results = await Promise.all(calls);
  expect(results.every((r) => r === results[0])).toBe(true);
  expect(results[0].fetchedAt).toBe(snapshot().fetchedAt);
  expect(await new DataGovAdapter().snapshot()).toBe(results[0]);
  expect(mocks.load).toHaveBeenCalledOnce();
});
it("clears failed single-flight state so a later explicit retry can succeed", async () => {
  const { DataGovAdapter } = await import("@/server/adapters/DataGovAdapter");
  mocks.load
    .mockResolvedValueOnce({ data: null, error: {} })
    .mockResolvedValueOnce({ data: { payload: snapshot() }, error: null });
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () => new DataGovAdapter().snapshot()),
  );
  expect(results.every((r) => r.status === "rejected")).toBe(true);
  expect(mocks.load).toHaveBeenCalledOnce();
  expect((await new DataGovAdapter().snapshot()).id).toBe("public-snapshot");
  expect(mocks.load).toHaveBeenCalledTimes(2);
});
it("expires after sixty seconds and never serves expired cache as a fallback to invalid data", async () => {
  vi.useFakeTimers();
  const { DataGovAdapter } = await import("@/server/adapters/DataGovAdapter");
  mocks.load
    .mockResolvedValueOnce({ data: { payload: snapshot() }, error: null })
    .mockResolvedValueOnce({ data: { payload: {} }, error: null });
  await new DataGovAdapter().snapshot();
  await vi.advanceTimersByTimeAsync(60000);
  await expect(new DataGovAdapter().snapshot()).rejects.toMatchObject({
    code: "DATASET_INVALID",
  });
  expect(mocks.load).toHaveBeenCalledTimes(2);
});
