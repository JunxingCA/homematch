import { expect, test, type Page } from "@playwright/test";
import { samplePreference } from "../../src/domain/fixtures";
import { facilitiesNear } from "../../src/domain/mapFacilities";
import type { ResearchSnapshot } from "../../src/domain/recommendations";
import type { Discovery } from "../../src/domain/recommendations";
import {
  btoCandidates,
  scoreMarketCandidate,
} from "../../src/domain/marketRecommendations";
import {
  btoCatalogueSchema,
  marketFiltersSchema,
} from "../../src/domain/marketEvidence.mjs";

test.beforeEach(async ({ page }) => {
  // HomeMatch follows the time of day until a theme is chosen; these checks start at night.
  await page.addInitScript(() => {
    if (!localStorage.getItem("homematch-theme"))
      localStorage.setItem("homematch-theme", "dark");
    // The launch intro and the match reveal play once per session; these checks start after them.
    sessionStorage.setItem("homematch-intro-seen", "1");
    sessionStorage.setItem("homematch-reveal-seen", "1");
  });
});
import catalogueJson from "../../data/bto-2026-06.json" with { type: "json" };
const areas = [
  {
    id: "bedok",
    name: "BEDOK",
    originLabel: "Bedok MRT",
    latitude: 1.324,
    longitude: 103.93,
  },
  {
    id: "jurong-east",
    name: "JURONG EAST",
    originLabel: "Jurong East MRT",
    latitude: 1.333,
    longitude: 103.742,
  },
];
const now = new Date().toISOString();
const snapshot: ResearchSnapshot = {
  id: "exploration-fixture",
  fetchedAt: now,
  sourceUrl: "https://data.gov.sg/",
  sourceHash: "fixture",
  latestMonth: "2026-09",
  importedRows: 1,
  supportedFacilities: ["Parks", "Gym", "Schools", "Healthcare"],
  facilitySources: ["Parks", "Gym", "Schools", "Healthcare"].map(
    (category) => ({
      category,
      theme: "fixture",
      updatedAt: now,
      coverage: "Test dataset; venue access not verified.",
    }),
  ),
  areas,
  prices: [],
  facilities: areas.flatMap((area) =>
    (["Parks", "Gym", "Schools", "Healthcare"] as const).map((category) => ({
      ...area,
      latitude: area.latitude + 0.001,
      name: `${area.name} ${category} fixture`,
      category,
    })),
  ),
};
async function fixture(
  page: Page,
  category: "BTO" | "Condominium" | "Private / landed",
) {
  const counters = {
    discoveries: 0,
    profileWrites: 0,
    routes: 0,
    amenities: 0,
    failRoutes: false,
    failAmenities: false,
  };
  const profile = {
    id: "11111111-1111-4111-8111-111111111111",
    revision: 2,
    confirmed: true,
    updatedAt: now,
    preference: {
      ...structuredClone(samplePreference),
      name: "Exploration test profile",
      category,
      lifestyles: [{ category: "Parks", radius: 800, priority: 3 }],
    },
  };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles") {
      if (route.request().method() !== "GET") counters.profileWrites++;
      return route.fulfill({ json: { profiles: [profile] } });
    }
    if (path === "/api/discoveries") {
      if (route.request().method() === "POST") counters.discoveries++;
      return route.fulfill({ json: { discoveries: [] } });
    }
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/preferences/interpret")
      return route.fulfill({ json: { enabled: false } });
    if (path === "/api/exploration") {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: {
            catalogue: { snapshotId: snapshot.id, fetchedAt: now, areas },
          },
        });
      const input = route.request().postDataJSON();
      expect(input.profileId).toBe(profile.id);
      expect(input.revision).toBe(profile.revision);
      expect(input).not.toHaveProperty("userId");
      const area = areas.find((a) => a.id === input.areaId)!;
      if (input.includeRoutes) {
        counters.routes++;
        if (counters.failRoutes)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "ROUTING_UNAVAILABLE",
                message: "OneMap journeys are unavailable. Please retry.",
              },
            },
          });
      } else {
        counters.amenities++;
        if (counters.failAmenities)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "DATASET_UNAVAILABLE",
                message: "Amenities could not be loaded. Please retry.",
              },
            },
          });
      }
      return route.fulfill({
        json: {
          exploration: {
            profileId: profile.id,
            profileRevision: profile.revision,
            category,
            facilities: facilitiesNear(snapshot, area, input.radius),
            journeys: input.includeRoutes
              ? {
                  departure: "2026-10-14T08:00:00+08:00",
                  fetchedAt: now,
                  routes: profile.preference.destinations.map(
                    (destination) => ({
                      destination: destination.location!.label,
                      mode: destination.mode,
                      visits: destination.visits,
                      minutes: 25,
                      metres: 5000,
                      geometry: [
                        [
                          [area.latitude, area.longitude],
                          [
                            destination.location!.latitude,
                            destination.location!.longitude,
                          ],
                        ],
                      ],
                    }),
                  ),
                }
              : null,
          },
        },
      });
    }
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page
    .getByRole("button", { name: "Explore areas", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Explore areas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Exploration area details" }),
  ).toContainText("Bedok MRT");
  return Object.assign(counters, { profile });
}
test("BTO ranking preserves quoted-price labels, sources, comparison and independent map layers", async ({
  page,
}, info) => {
  const { profile } = await fixture(page, "BTO");
  const preference = {
    ...profile.preference,
    lifestyles: [{ category: "Parks" as const, radius: 800, priority: 3 }],
  };
  const catalogue = btoCatalogueSchema.parse(catalogueJson);
  const filters = marketFiltersSchema.parse({ includeClosedLaunches: true });
  const candidates = btoCandidates(
    catalogue,
    [
      {
        id: "sembawang",
        name: "SEMBAWANG",
        originLabel: "Sembawang MRT (fixture)",
        latitude: 1.449,
        longitude: 103.82,
      },
    ],
    preference,
    filters,
    "2026-10-14",
  ).candidates;
  const results = candidates.map((candidate) =>
    scoreMarketCandidate(
      candidate,
      preference,
      filters,
      preference.destinations.map((d) => ({
        destination: d.location!.label,
        visits: d.visits,
        mode: d.mode,
        minutes: 25,
        metres: 5000,
        geometry: [
          [
            [candidate.area.latitude, candidate.area.longitude],
            [d.location!.latitude, d.location!.longitude],
          ],
        ],
      })),
      snapshot.facilities,
    ),
  );
  const discovery: Discovery = {
    id: "22222222-2222-4222-8222-222222222222",
    profileId: profile.id,
    profileRevision: profile.revision,
    preference,
    results,
    excluded: [],
    createdAt: now,
    fetchedAt: "2026-06-16T00:00:00Z",
    latestMonth: "2026-06",
    fromMonth: "2025-10",
    toMonthExclusive: "2026-10",
    sourceUrl: catalogue.sourceUrl,
    formulaVersion: "bto-launch-area-v1",
    snapshotId: catalogue.id,
    departure: "2026-10-15T08:00:00+08:00",
    facilitySources: snapshot.facilitySources,
    market: {
      kind: "bto",
      filters,
      coverage:
        "Historical BTO launch comparison. Applications closed; town proxy origins, not project entrances. No current unit inventory.",
    },
  };
  await page.route("**/api/market-rankings", async (route) => {
    expect(route.request().postDataJSON().filters.includeClosedLaunches).toBe(
      true,
    );
    await route.fulfill({ json: { discovery } });
  });
  await page.route(
    `**/api/discoveries/${discovery.id}/facilities?**`,
    async (route) => {
      const url = new URL(route.request().url()),
        area = results.find(
          (r) => r.area.id === url.searchParams.get("areaId"),
        )!.area;
      await route.fulfill({
        json: {
          facilities: facilitiesNear(
            snapshot,
            area,
            Number(url.searchParams.get("radius")),
          ),
        },
      });
    },
  );
  await page
    .getByLabel("Include closed launches for historical research")
    .check();
  await page
    .getByRole("button", { name: "Rank BTO launch areas", exact: true })
    .click();
  const detail = page.getByRole("region", {
    name: "Area evidence",
    exact: true,
  });
  await expect(detail).toContainText("Published launch price fit");
  await expect(detail).toContainText("not the percentage of flats");
  await expect(detail).toContainText("24");
  await expect(
    detail.getByRole("heading", { name: "Historical budget fit", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("note")).toContainText("Applications closed");
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 15000,
  });
  await page.screenshot({
    path: `test-results/bto-ranking-${info.project.name}-dark.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: `test-results/bto-ranking-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Matches (2)", exact: true }).click();
  await page.getByLabel("Compare area").nth(0).check();
  await page.getByLabel("Compare area").nth(1).check();
  await page.getByRole("button", { name: "Compare (2/3)" }).click();
  const comparison = page.getByRole("region", { name: "Area comparison" });
  await expect(comparison).toContainText("Not transaction data");
  await expect(comparison).toContainText("Published price range");
  await expect(comparison).not.toContainText("Median resale price");
});
test("private ranking submits category-specific size filters and handles an unconnected URA source", async ({
  page,
}) => {
  const { profile } = await fixture(page, "Condominium");
  let requests = 0;
  await page.route("**/api/market-rankings", async (route) => {
    requests++;
    expect(route.request().postDataJSON()).toMatchObject({
      profileId: profile.id,
      revision: 2,
      filters: {
        minAreaSqm: 70,
        maxAreaSqm: 150,
        areaType: "Strata",
        saleType: "3",
      },
    });
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "PRIVATE_DATA_UNAVAILABLE",
          message:
            "Verified URA prices are not connected yet. Area exploration is still available.",
        },
      },
    });
  });
  await page.getByLabel("Minimum area (sqm)").fill("70");
  await page.getByLabel("Maximum area (sqm)").fill("150");
  await page.getByLabel("Area basis").selectOption("Strata");
  await page.getByLabel("Sale type", { exact: true }).selectOption("3");
  await page
    .getByRole("button", { name: "Rank private districts", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "URA prices are not connected" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry search", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry search", exact: true }).click();
  await expect.poll(() => requests).toBe(2);
  await expect(
    page.getByRole("button", { name: /My profiles 1/ }),
  ).toBeVisible();
});
for (const category of ["BTO", "Condominium", "Private / landed"] as const) {
  test(`${category}: unscored map, optional journeys, independent layers and external navigation`, async ({
    page,
    context,
  }, info) => {
    const counters = await fixture(page, category);
    const detail = page.getByRole("region", {
      name: "Exploration area details",
    });
    await expect(
      page.getByText("Neighbourhood context only", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Area exploration map" }),
    ).toBeVisible();
    await expect(
      page.locator('.leaflet-tile-loaded[src*="Night"]').first(),
    ).toBeVisible();
    await expect(
      detail.getByText(/Imported .*Source availability/),
    ).toBeVisible();
    await expect(detail).not.toContainText("Historical budget fit");
    await expect(page.getByLabel("Profile progress")).toHaveCount(0);
    const mapBox = await page.locator(".leaflet-container").boundingBox();
    for (const area of areas) {
      const pinBox = await page
        .getByRole("button", { name: `Explore ${area.name}`, exact: true })
        .boundingBox();
      expect(pinBox!.x).toBeGreaterThanOrEqual(mapBox!.x);
      expect(pinBox!.x + pinBox!.width).toBeLessThanOrEqual(
        mapBox!.x + mapBox!.width,
      );
    }
    await expect(
      page.getByRole("button", { name: /match score|historical median/ }),
    ).toHaveCount(0);
    expect(counters.routes).toBe(0);
    await page.getByRole("button", { name: "Layers", exact: true }).click();
    const layers = page.getByRole("complementary", {
      name: "Exploration layers",
    });
    await layers.getByLabel("Gyms", { exact: true }).check();
    await layers.getByLabel("Schools", { exact: true }).check();
    await layers.getByLabel("Hospitals", { exact: true }).check();
    await layers.getByLabel("Exploration radius").selectOption("2000");
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Exploration legend" }),
    ).toContainText("Gyms");
    await expect(
      detail.getByText(/Imported .*Source availability/),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/explore-${category.replaceAll(/[^a-z]/gi, "-")}-${info.project.name}-dark.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Load journeys", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Exploration journeys" }),
    ).toContainText("25.0 min");
    expect(counters.routes).toBe(1);
    await page
      .getByRole("button", { name: "Switch to light mode", exact: true })
      .click();
    await expect(
      page.locator('.leaflet-tile-loaded[src*="GreyLite"]').first(),
    ).toBeVisible();
    await detail.evaluate((element) => element.scrollTo({ top: 0 }));
    await page.screenshot({
      path: `test-results/explore-${category.replaceAll(/[^a-z]/gi, "-")}-${info.project.name}-light.png`,
      fullPage: true,
    });
    const links = detail.getByRole("region", {
      name: "External housing listings",
    });
    const link = links.getByRole("link").first();
    const href = await link.getAttribute("href");
    if (category === "BTO") {
      expect(href).toBe("https://homes.hdb.gov.sg/home/finding-a-flat");
      await expect(links).toContainText("Select Bedok and BTO");
    } else {
      const url = new URL(href!);
      expect(url.searchParams.get("keyword")).toBe("Bedok");
      expect(url.searchParams.get("propertyTypeGroup")).toBe(
        category === "Condominium" ? "N" : "L",
      );
    }
    expect(await link.getAttribute("rel")).toContain("noreferrer");
    await context.route("https://www.propertyguru.com.sg/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>External listing fixture</h1>",
      }),
    );
    await context.route("https://homes.hdb.gov.sg/**", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<h1>External listing fixture</h1>",
      }),
    );
    const popupPromise = page.waitForEvent("popup");
    await link.click();
    const popup = await popupPromise;
    await expect(detail).toContainText("Bedok MRT");
    await expect(
      page.getByRole("region", { name: "Exploration journeys" }),
    ).toContainText("25.0 min");
    await popup.close();
    await page.getByRole("button", { name: "Areas", exact: true }).click();
    await page
      .getByRole("searchbox", { name: "Filter exploration towns" })
      .fill("jurong");
    await page
      .getByRole("button", { name: /Jurong East Jurong East MRT/ })
      .click();
    await expect(detail).toContainText("Jurong East MRT");
    await expect(
      page.getByRole("region", { name: "Exploration journeys" }),
    ).not.toContainText("25.0 min");
    if (category !== "BTO")
      await expect(
        detail
          .getByRole("region", { name: "External housing listings" })
          .getByRole("link")
          .first(),
      ).toHaveAttribute("href", /keyword=Jurong\+East/);
    expect(counters.discoveries).toBe(0);
    expect(counters.profileWrites).toBe(0);
  });
}
test("journey and amenity failures are independently retryable without changing the profile", async ({
  page,
}) => {
  const counters = await fixture(page, "Condominium");
  const detail = page.getByRole("region", { name: "Exploration area details" });
  counters.failRoutes = true;
  await page
    .getByRole("button", { name: "Load journeys", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Exploration journeys" }),
  ).toContainText("OneMap journeys are unavailable");
  await expect(
    detail.getByText(/Imported .*Source availability/),
  ).toBeVisible();
  counters.failRoutes = false;
  await page
    .getByRole("button", { name: "Retry journeys", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Exploration journeys" }),
  ).toContainText("25.0 min");
  counters.failAmenities = true;
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  await page.getByLabel("Exploration radius").selectOption("3000");
  await page.getByRole("button", { name: "Details", exact: true }).click();
  await expect(detail).toContainText("Amenities could not be loaded");
  await expect(
    page.getByRole("region", { name: "Exploration journeys" }),
  ).toContainText("25.0 min");
  counters.failAmenities = false;
  await page
    .getByRole("button", { name: "Retry amenities", exact: true })
    .click();
  await expect(
    detail.getByText(/Imported .*Source availability/),
  ).toBeVisible();
  expect(counters.discoveries).toBe(0);
  expect(counters.profileWrites).toBe(0);
});
test("switching areas cancels pending journeys and permits a fresh request on return", async ({
  page,
}) => {
  await fixture(page, "Condominium");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = true;
  await page.route("**/api/exploration", async (route) => {
    if (route.request().method() === "POST") {
      const input = route.request().postDataJSON();
      if (held && input.includeRoutes && input.areaId === "bedok") {
        await waiting;
        try {
          await route.fulfill({ json: {} });
        } catch {
          /* Aborted by area selection. */
        }
        return;
      }
    }
    return route.fallback();
  });
  await page
    .getByRole("button", { name: "Load journeys", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Loading journeys...", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page
    .getByRole("button", { name: /Jurong East Jurong East MRT/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Exploration area details" }),
  ).toContainText("Jurong East MRT");
  held = false;
  release();
  await page.getByRole("button", { name: "Areas", exact: true }).click();
  await page.getByRole("button", { name: /Bedok Bedok MRT/ }).click();
  await expect(
    page.getByRole("button", { name: "Load journeys", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Load journeys", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Exploration journeys" }),
  ).toContainText("25.0 min");
});
