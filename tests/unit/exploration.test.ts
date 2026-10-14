import { beforeEach, expect, it, vi } from "vitest";
import { samplePreference } from "@/domain/fixtures";
import { explorationInput, routeDeparture } from "@/domain/exploration";
import { listingLinks } from "@/domain/listingLinks";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  get: vi.fn(),
  snapshot: vi.fn(),
  route: vi.fn(),
  acquire: vi.fn(),
  release: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase", () => ({ requireSession: mocks.session }));
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
import { AreaExplorationController } from "@/server/controllers/AreaExplorationController";
const owner = "11111111-1111-4111-8111-111111111111";
const profileId = "22222222-2222-4222-8222-222222222222";
const area = {
  id: "bedok",
  name: "BEDOK",
  latitude: 1.324,
  longitude: 103.93,
  originLabel: "Bedok MRT",
};
const profile = (
  category: "BTO" | "Condominium" | "Private / landed" | "Resale HDB" = "BTO",
) => ({
  id: profileId,
  revision: 2,
  confirmed: true,
  preference: { ...structuredClone(samplePreference), category },
});
const snapshot = () => ({
  id: "public",
  fetchedAt: new Date().toISOString(),
  areas: [area],
  facilities: [{ ...area, name: "Gym fixture", category: "Gym" }],
  supportedFacilities: ["Gym"],
  facilitySources: [{ category: "Gym", updatedAt: new Date().toISOString() }],
  prices: [],
});
const query = {
  profileId,
  revision: 2,
  areaId: "bedok",
  radius: 1000,
  includeRoutes: false,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.acquire.mockResolvedValue(mocks.release);
  mocks.session.mockResolvedValue({ client: {}, user: { id: owner } });
  mocks.get.mockResolvedValue(profile());
  mocks.snapshot.mockResolvedValue(snapshot());
  mocks.route.mockImplementation(async (_area, destination) => ({
    destination: destination.location.label,
    mode: destination.mode,
    visits: destination.visits,
    minutes: 20,
    metres: 5000,
    geometry: [
      [
        [1.324, 103.93],
        [1.3483, 103.6831],
      ],
    ],
  }));
});
it("does not use a provider when shared journey admission fails", async () => {
  mocks.acquire.mockRejectedValue(new Error("Protection unavailable"));
  await expect(
    new AreaExplorationController().details({ ...query, includeRoutes: true }),
  ).rejects.toThrow("Protection unavailable");
  expect(mocks.route).not.toHaveBeenCalled();
});
it("reserves local routing before asynchronous shared admission and clears it on denial", async () => {
  let reject!: (error: Error) => void;
  mocks.acquire.mockImplementationOnce(
    () =>
      new Promise((_, fail) => {
        reject = fail;
      }),
  );
  const first = new AreaExplorationController().details({
    ...query,
    includeRoutes: true,
  });
  const check = expect(first).rejects.toThrow("Denied");
  await vi.waitFor(() => expect(mocks.acquire).toHaveBeenCalledOnce());
  await expect(
    new AreaExplorationController().details({ ...query, includeRoutes: true }),
  ).rejects.toMatchObject({ code: "EXPLORATION_BUSY" });
  reject(new Error("Denied"));
  await check;
  expect(mocks.route).not.toHaveBeenCalled();
  expect(
    (
      await new AreaExplorationController().details({
        ...query,
        includeRoutes: true,
      })
    ).journeys,
  ).not.toBeNull();
});
it("requires authentication before returning the public catalogue", async () => {
  mocks.session.mockRejectedValue(new Error("Expired"));
  await expect(new AreaExplorationController().catalogue()).rejects.toThrow(
    "Expired",
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it("rejects user IDs, arbitrary origins, unknown keys and invalid radius bounds", () => {
  for (const input of [
    { ...query, userId: owner },
    { ...query, latitude: 1.3 },
    { ...query, radius: 5001 },
    { ...query, radius: 99 },
    { ...query, revision: 0 },
  ])
    expect(explorationInput.safeParse(input).success).toBe(false);
});
it.each(["BTO", "Condominium", "Private / landed"] as const)(
  "explores %s without any price requirement or invented score",
  async (category) => {
    mocks.get.mockResolvedValue(profile(category));
    const result = await new AreaExplorationController().details(query);
    expect(result.category).toBe(category);
    expect(result.facilities.origin).toEqual(area);
    expect(
      result.facilities.layers.find((l) => l.category === "Gym")?.count,
    ).toBe(1);
    expect(result.journeys).toBeNull();
    for (const field of [
      "overall",
      "median",
      "affordabilityScore",
      "budgetFit",
      "transactions",
    ])
      expect(result).not.toHaveProperty(field);
    expect(mocks.route).not.toHaveBeenCalled();
    expect(mocks.get).toHaveBeenCalledWith(profileId);
  },
);
it("does not fetch public data or routes for another owner's/missing profile", async () => {
  mocks.get.mockRejectedValue(new Error("Profile not found"));
  await expect(new AreaExplorationController().details(query)).rejects.toThrow(
    "Profile not found",
  );
  expect(mocks.snapshot).not.toHaveBeenCalled();
  expect(mocks.route).not.toHaveBeenCalled();
});
it("rejects stale revisions, drafts and resale profiles", async () => {
  for (const invalid of [
    { ...profile(), confirmed: false },
    { ...profile(), revision: 3 },
  ]) {
    mocks.get.mockResolvedValue(invalid);
    await expect(
      new AreaExplorationController().details(query),
    ).rejects.toMatchObject({ code: "PROFILE_NOT_CONFIRMED" });
  }
  mocks.get.mockResolvedValue(profile("Resale HDB"));
  await expect(
    new AreaExplorationController().details(query),
  ).rejects.toMatchObject({ code: "CATEGORY_NOT_SUPPORTED" });
  expect(mocks.snapshot).not.toHaveBeenCalled();
});
it("rejects unknown areas and stale source data", async () => {
  await expect(
    new AreaExplorationController().details({ ...query, areaId: "forged" }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  mocks.snapshot.mockResolvedValue({
    ...snapshot(),
    fetchedAt: "2020-01-01T00:00:00Z",
  });
  await expect(
    new AreaExplorationController().catalogue(),
  ).rejects.toMatchObject({ code: "DATASET_STALE" });
  await expect(
    new AreaExplorationController().details(query),
  ).rejects.toMatchObject({ code: "DATASET_STALE" });
});
it("uses trusted destinations only when journeys are explicitly requested", async () => {
  const result = await new AreaExplorationController().details({
    ...query,
    includeRoutes: true,
  });
  expect(result.journeys?.routes).toHaveLength(1);
  expect(mocks.route).toHaveBeenCalledWith(
    area,
    profile().preference.destinations[0],
    expect.any(String),
    expect.any(AbortSignal),
  );
  expect(result.journeys?.departure).toMatch(/T08:00:00\+08:00$/);
  expect(mocks.session).toHaveBeenLastCalledWith(false);
});
it("fails without partial journeys and releases the routing guard for retry", async () => {
  mocks.route.mockRejectedValueOnce(new Error("OneMap unavailable"));
  await expect(
    new AreaExplorationController().details({ ...query, includeRoutes: true }),
  ).rejects.toThrow("OneMap unavailable");
  expect(
    (await new AreaExplorationController().details(query)).facilities.origin.id,
  ).toBe("bedok");
  expect(
    (
      await new AreaExplorationController().details({
        ...query,
        includeRoutes: true,
      })
    ).journeys,
  ).not.toBeNull();
});
it("withholds results after session expiry, identity changes or profile updates", async () => {
  mocks.session
    .mockResolvedValueOnce({ client: {}, user: { id: owner } })
    .mockRejectedValueOnce(new Error("Expired"));
  await expect(new AreaExplorationController().details(query)).rejects.toThrow(
    "Expired",
  );
  mocks.session
    .mockResolvedValueOnce({ client: {}, user: { id: owner } })
    .mockResolvedValueOnce({ client: {}, user: { id: profileId } });
  await expect(
    new AreaExplorationController().details(query),
  ).rejects.toMatchObject({ code: "SIGN_IN_REQUIRED" });
  mocks.get
    .mockResolvedValueOnce(profile())
    .mockResolvedValueOnce({ ...profile(), revision: 3 });
  await expect(
    new AreaExplorationController().details(query),
  ).rejects.toMatchObject({ code: "PROFILE_NOT_CONFIRMED" });
});
it("creates safe type-specific area keyword links without exporting private preferences", () => {
  for (const [category, group] of [
    ["Resale HDB", "H"],
    ["Condominium", "N"],
    ["Private / landed", "L"],
  ] as const) {
    const link = listingLinks(category, "KALLANG/WHAMPOA")[0];
    const url = new URL(link.href);
    expect(url.origin).toBe("https://www.propertyguru.com.sg");
    expect(url.searchParams.get("keyword")).toBe("KALLANG/WHAMPOA");
    expect(url.searchParams.get("propertyTypeGroup")).toBe(group);
    expect([...url.searchParams.keys()].sort()).toEqual([
      "isCommercial",
      "keyword",
      "listingType",
      "propertyTypeGroup",
    ]);
    expect(url.searchParams.has("hdbEstate")).toBe(false);
    expect(link.note).toContain("not a town-boundary filter");
  }
  const unusual = new URL(
    listingLinks("Condominium", "Bedok&redirect=https://evil.test")[0].href,
  );
  expect(unusual.origin).toBe("https://www.propertyguru.com.sg");
  expect(unusual.searchParams.has("redirect")).toBe(false);
});
it("uses official BTO navigation without pretending a project or availability is known", () => {
  const links = listingLinks("BTO", "BEDOK");
  expect(links).toHaveLength(1);
  expect(links[0].href).toBe("https://homes.hdb.gov.sg/home/finding-a-flat");
  expect(links[0].note).toContain("Select BEDOK");
  expect(links[0].note).toContain("not checked");
});
it("fixes departure to tomorrow at 08:00 in Singapore across the UTC date boundary", () => {
  expect(routeDeparture(new Date("2026-10-13T17:00:00Z"))).toBe(
    "2026-10-15T08:00:00+08:00",
  );
});
it("bounds concurrent journey requests per owner while leaving amenity reads available", async () => {
  let release!: (route: unknown) => void;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  mocks.route.mockImplementationOnce(() => waiting);
  const pending = new AreaExplorationController().details({
    ...query,
    includeRoutes: true,
  });
  try {
    await vi.waitFor(() => expect(mocks.route).toHaveBeenCalledOnce());
    await expect(
      new AreaExplorationController().details({
        ...query,
        includeRoutes: true,
      }),
    ).rejects.toMatchObject({ code: "EXPLORATION_BUSY" });
    expect(
      (await new AreaExplorationController().details(query)).journeys,
    ).toBeNull();
  } finally {
    release({
      destination: profile().preference.destinations[0].location!.label,
      visits: 5,
      mode: "public",
      minutes: 20,
      metres: 5000,
      geometry: [[[1.324, 103.93]]],
    });
    await pending;
  }
});
