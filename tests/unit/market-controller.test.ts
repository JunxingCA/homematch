import { beforeEach, expect, it, vi } from "vitest";
import { samplePreference } from "@/domain/fixtures";
import catalogue from "../../data/bto-2026-06.json";
import { btoCatalogueSchema } from "@/domain/marketEvidence.mjs";
import { monthWindow } from "@/domain/recommendations";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  get: vi.fn(),
  snapshot: vi.fn(),
  private: vi.fn(),
  route: vi.fn(),
  insert: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({
  requireSession: mocks.session,
  adminClient: () => ({ from: () => ({ insert: mocks.insert }) }),
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
vi.mock("@/server/adapters/MarketPriceAdapter", () => ({
  MarketPriceAdapter: class {
    bto() {
      return btoCatalogueSchema.parse(catalogue);
    }
    private = mocks.private;
  },
}));
vi.mock("@/server/adapters/OneMapRoutingAdapter", () => ({
  OneMapRoutingAdapter: class {
    route = mocks.route;
  },
}));
vi.mock("@/server/operationLimits", () => ({
  acquireOperation: mocks.acquire,
}));
import { MarketRecommendationController } from "@/server/controllers/MarketRecommendationController";
const profileId = "22222222-2222-4222-8222-222222222222";
let owner: string;
const profile = (category: "BTO" | "Condominium" = "BTO") => ({
  id: profileId,
  confirmed: true,
  revision: 2,
  preference: {
    ...structuredClone(samplePreference),
    category,
    flatTypes: ["4-room"],
    lifestyles: [],
    weights: { destination: 70, lifestyle: 0, affordability: 30 },
  },
});
const run = (filters = { includeClosedLaunches: true }) =>
  new MarketRecommendationController().create({
    profileId,
    revision: 2,
    filters,
  });
beforeEach(() => {
  vi.resetAllMocks();
  owner = crypto.randomUUID();
  mocks.session.mockResolvedValue({ client: {}, user: { id: owner } });
  mocks.get.mockResolvedValue(profile());
  mocks.snapshot.mockResolvedValue({
    id: "amenities",
    fetchedAt: new Date().toISOString(),
    supportedFacilities: [],
    facilitySources: [],
    facilities: [],
    areas: [
      {
        id: "sembawang",
        name: "SEMBAWANG",
        originLabel: "Verified MRT",
        latitude: 1.4,
        longitude: 103.8,
      },
    ],
  });
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.route.mockImplementation(async (_area, d) => ({
    destination: d.location.label,
    visits: d.visits,
    mode: d.mode,
    minutes: 25,
    metres: 5000,
    geometry: [],
  }));
  mocks.insert.mockResolvedValue({ error: null });
});
it("publishes a separate versioned BTO discovery without invented sales", async () => {
  const result = await run();
  expect(result.formulaVersion).toBe("bto-launch-area-v1");
  expect(result.results).toHaveLength(2);
  expect(
    result.results.every(
      (r) => r.transactions === 0 && r.priceEvidence?.kind === "bto-range",
    ),
  ).toBe(true);
  expect(result.market?.coverage).toContain("not a probability");
  expect(mocks.insert.mock.calls[0][0].user_id).toBe(owner);
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("explains closed launches without routing them by default", async () => {
  const result = await run({ includeClosedLaunches: false });
  expect(result.results).toHaveLength(0);
  expect(result.excluded).toHaveLength(7);
  expect(mocks.route).not.toHaveBeenCalled();
});
it("checks authentication, ownership and confirmed revision before providers", async () => {
  mocks.session.mockRejectedValueOnce(new Error("Sign in"));
  await expect(run()).rejects.toThrow("Sign in");
  mocks.get.mockRejectedValueOnce(new Error("Not owned"));
  await expect(run()).rejects.toThrow("Not owned");
  mocks.get.mockResolvedValueOnce({ ...profile(), revision: 3 });
  await expect(run()).rejects.toMatchObject({ code: "PROFILE_NOT_CONFIRMED" });
  expect(mocks.acquire).not.toHaveBeenCalled();
});
it("fails closed on quota and stale research", async () => {
  mocks.acquire.mockRejectedValueOnce(new Error("Quota"));
  await expect(run()).rejects.toThrow("Quota");
  const snapshot = await mocks.snapshot();
  snapshot.fetchedAt = "2020-01-01T00:00:00Z";
  await expect(run()).rejects.toMatchObject({ code: "DATASET_STALE" });
  expect(mocks.route).not.toHaveBeenCalled();
});
it("prevents overlapping searches and publishes nothing after routing failure", async () => {
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
  mocks.route.mockRejectedValue(new Error("Provider error"));
  resolve(mocks.release);
  await expect(first).rejects.toThrow("Provider error");
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.release).toHaveBeenCalledOnce();
});
it("withholds results after identity or revision changes", async () => {
  mocks.session
    .mockResolvedValueOnce({ client: {}, user: { id: owner } })
    .mockResolvedValueOnce({ client: {}, user: { id: crypto.randomUUID() } });
  await expect(run()).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED" });
  mocks.get
    .mockResolvedValueOnce(profile())
    .mockResolvedValueOnce({ ...profile(), revision: 3 });
  await expect(run()).rejects.toMatchObject({ code: "PROFILE_NOT_CONFIRMED" });
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("does not retry uncertain publication", async () => {
  mocks.insert.mockResolvedValue({ error: { message: "Private error" } });
  await expect(run()).rejects.toMatchObject({ code: "DISCOVERY_SAVE_FAILED" });
  expect(mocks.insert).toHaveBeenCalledOnce();
});
it("refuses missing private prices rather than substituting HDB data", async () => {
  mocks.get.mockResolvedValue(profile("Condominium"));
  mocks.private.mockRejectedValue(new Error("URA not imported"));
  await expect(run()).rejects.toThrow("URA not imported");
  expect(mocks.route).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
});
it("publishes validated private district prices using a separate formula and source", async () => {
  const latestMonth = monthWindow(new Date(), 1).fromMonth;
  mocks.get.mockResolvedValue(profile("Condominium"));
  mocks.private.mockResolvedValue({
    id: "ura-fixture",
    kind: "private",
    fetchedAt: new Date().toISOString(),
    sourceUrl: "https://eservice.ura.gov.sg/maps/api/",
    latestMonth,
    skippedCoordinates: 0,
    skippedMultiUnit: 0,
    projects: [
      {
        name: "Public fixture",
        street: "Fixture street",
        latitude: 1.33,
        longitude: 103.8,
        transactions: Array.from({ length: 5 }, (_, i) => ({
          month: latestMonth,
          district: "04",
          propertyType: "Condominium",
          price: 1000000 + i * 100000,
          areaSqm: 90,
          areaType: "Strata",
          saleType: "3",
        })),
      },
    ],
  });
  const result = await run();
  expect(result.formulaVersion).toBe("private-district-v1");
  expect(result.results).toHaveLength(1);
  expect(result.results[0].area.name).toBe("District 04");
  expect(result.results[0].median).toBe(1200000);
  expect(result.results[0].transactions).toBe(5);
  expect(result.market?.coverage).toContain(
    "HDB room types are not private bedroom counts",
  );
  const snapshot = await mocks.private();
  snapshot.fetchedAt = "2020-01-01T00:00:00Z";
  await expect(run()).rejects.toMatchObject({ code: "PRIVATE_DATA_STALE" });
  expect(mocks.insert).toHaveBeenCalledOnce();
});
