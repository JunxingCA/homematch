import { beforeEach, expect, it, vi } from "vitest";
import { samplePreference } from "@/domain/fixtures";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  get: vi.fn(),
  snapshot: vi.fn(),
  route: vi.fn(),
  insert: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({
  requireSession: mocks.session,
  adminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
}));
vi.mock("@/server/operationLimits", () => ({
  acquireOperation: mocks.acquire,
}));
vi.mock("@/server/repositories/ProfileRepository", () => ({
  ProfileRepository: class {
    get = mocks.get;
  },
}));
vi.mock("@/server/adapters/DataGovAdapter", () => ({
  DataGovAdapter: class {
    snapshot = mocks.snapshot;
  },
}));
vi.mock("@/server/adapters/OneMapRoutingAdapter", () => ({
  OneMapRoutingAdapter: class {
    route = mocks.route;
  },
}));
import { RecommendationController } from "@/server/controllers/RecommendationController";
let owner: string;
const profileId = "22222222-2222-4222-8222-222222222222";
const profile = () => ({
  id: profileId,
  revision: 2,
  confirmed: true,
  preference: {
    ...structuredClone(samplePreference),
    category: "Resale HDB",
    lifestyles: [],
    weights: { destination: 70, lifestyle: 0, affordability: 30 },
  },
});
beforeEach(() => {
  vi.resetAllMocks();
  owner = crypto.randomUUID();
  mocks.session.mockResolvedValue({
    client: { rpc: mocks.rpc },
    user: { id: owner },
  });
  mocks.rpc.mockResolvedValue({ data: [], error: null });
  mocks.get.mockResolvedValue(profile());
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.insert.mockResolvedValue({ error: null });
  const latestMonth = new Date(Date.now() - 32 * 86400000)
    .toISOString()
    .slice(0, 7);
  mocks.snapshot.mockResolvedValue({
    id: "public",
    fetchedAt: new Date().toISOString(),
    latestMonth,
    supportedFacilities: [],
    facilitySources: [],
    areas: [
      {
        id: "bedok",
        name: "BEDOK",
        latitude: 1.32,
        longitude: 103.93,
        originLabel: "Bedok MRT",
      },
    ],
    facilities: [],
    prices: [
      {
        town: "BEDOK",
        month: latestMonth,
        flatType: samplePreference.flatTypes[0],
        values: [400000, 500000, 600000, 700000, 800000],
      },
    ],
  });
  mocks.route.mockResolvedValue({
    destination: samplePreference.destinations[0].location!.label,
    visits: 5,
    mode: "public",
    minutes: 20,
    metres: 1000,
    geometry: [],
  });
});
const run = () =>
  new RecommendationController().create({ profileId, revision: 2 });
it("lists only the authenticated caller's visible history through RLS", async () => {
  mocks.rpc.mockResolvedValue({
    data: [{ id: profileId, created_at: "2026-10-14", profile_name: "Home" }],
    error: null,
  });
  expect(await new RecommendationController().list()).toEqual([
    { id: profileId, createdAt: "2026-10-14", profileName: "Home" },
  ]);
  expect(mocks.rpc).toHaveBeenCalledWith("recent_discoveries");
});
it("requires explicit confirmation and uses only the caller's history RPC", async () => {
  const controller = new RecommendationController();
  await expect(controller.clearHistory({ confirm: false })).rejects.toThrow();
  await expect(
    controller.clearHistory({ confirm: true, userId: profileId }),
  ).rejects.toThrow();
  expect(mocks.rpc).not.toHaveBeenCalled();
  expect(await controller.clearHistory({ confirm: true })).toEqual({
    cleared: true,
  });
  expect(mocks.rpc).toHaveBeenCalledWith("clear_discovery_history");
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("reports a retryable clear error rather than false success", async () => {
  mocks.rpc.mockResolvedValue({ error: { message: "unavailable" } });
  await expect(
    new RecommendationController().clearHistory({ confirm: true }),
  ).rejects.toMatchObject({ code: "HISTORY_CLEAR_FAILED", status: 503 });
  await expect(new RecommendationController().list()).rejects.toMatchObject({
    code: "DISCOVERY_LOAD_FAILED",
  });
});
it("reserves local concurrency before the asynchronous shared admission", async () => {
  let resolve!: (release: typeof mocks.release) => void;
  mocks.acquire.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const first = run();
  await vi.waitFor(() => expect(mocks.acquire).toHaveBeenCalledOnce());
  await expect(run()).rejects.toMatchObject({ code: "DISCOVERY_BUSY" });
  resolve(mocks.release);
  await first;
  expect(mocks.insert).toHaveBeenCalledOnce();
});
it("verifies ownership and confirmation before shared admission and providers", async () => {
  mocks.get.mockRejectedValue(new Error("Profile not found"));
  await expect(run()).rejects.toThrow("Profile not found");
  expect(mocks.acquire).not.toHaveBeenCalled();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it("fails closed before provider calls when shared protection is denied", async () => {
  mocks.acquire.mockRejectedValue(new Error("Quota"));
  await expect(run()).rejects.toThrow("Quota");
  expect(mocks.snapshot).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("releases admission and writes no partial results on routing failure", async () => {
  mocks.route.mockRejectedValue(new Error("Provider failed"));
  await expect(run()).rejects.toThrow("Provider failed");
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("revalidates the profile revision before publication", async () => {
  mocks.get
    .mockResolvedValueOnce(profile())
    .mockResolvedValueOnce({ ...profile(), revision: 3 });
  await expect(run()).rejects.toMatchObject({ code: "PROFILE_NOT_CONFIRMED" });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("withholds results after a session change during provider calls", async () => {
  mocks.session
    .mockResolvedValueOnce({ client: {}, user: { id: owner } })
    .mockResolvedValueOnce({ client: {}, user: { id: profileId } });
  await expect(run()).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED" });
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("publishes once for the verified owner without automatic retry of uncertain writes", async () => {
  mocks.insert.mockResolvedValue({ error: { message: "Timeout" } });
  await expect(run()).rejects.toMatchObject({ code: "DISCOVERY_SAVE_FAILED" });
  expect(mocks.insert).toHaveBeenCalledOnce();
  expect(mocks.insert.mock.calls[0][0].user_id).toBe(owner);
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("releases admission after a complete immutable result", async () => {
  const result = await run();
  expect(result.results).toHaveLength(1);
  expect(mocks.acquire).toHaveBeenCalledWith("discovery", owner);
  expect(mocks.insert).toHaveBeenCalledOnce();
  expect(mocks.release).toHaveBeenCalledOnce();
});
