import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { samplePreference } from "../../src/domain/fixtures";
import {
  scoreArea,
  type Discovery,
  type ResearchSnapshot,
} from "../../src/domain/recommendations";
import {
  lifestyleCategories,
  type Preference,
} from "../../src/domain/preferences";
import { facilitiesNear } from "../../src/domain/mapFacilities";
import { savedArea, type SavedArea } from "../../src/domain/shortlist";

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

const preference = {
  ...structuredClone(samplePreference),
  name: "UI test profile",
  lifestyles: ["Parks", "Schools", "Groceries", "Healthcare"].map(
    (category) => ({
      category: category as Preference["lifestyles"][number]["category"],
      priority: 3,
      radius: 800,
    }),
  ),
};
const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  revision: 2,
  confirmed: true,
  updatedAt: new Date().toISOString(),
  preference,
};
const results = [
  {
    id: "jurong-east",
    name: "JURONG EAST",
    originLabel: "Jurong East MRT",
    latitude: 1.333,
    longitude: 103.742,
  },
  {
    id: "bedok",
    name: "BEDOK",
    originLabel: "Bedok MRT",
    latitude: 1.324,
    longitude: 103.93,
  },
].map((area) =>
  scoreArea(
    area,
    preference,
    [400000, 450000, 500000, 550000, 600000],
    [
      {
        destination: preference.destinations[0].location!.label,
        mode: "public",
        visits: 5,
        minutes: 30,
        metres: 10000,
        geometry: [
          [
            [area.latitude, area.longitude],
            [1.3483, 103.6831],
          ],
        ],
      },
    ],
    preference.lifestyles.map((l) => ({
      ...area,
      name: `Test ${l.category}`,
      category: l.category,
    })),
  ),
);
const discovery: Discovery = {
  id: "22222222-2222-4222-8222-222222222222",
  profileId: profile.id,
  profileRevision: 2,
  preference,
  results,
  excluded: [],
  formulaVersion: "test-fixture",
  snapshotId: "test-data",
  createdAt: new Date().toISOString(),
  fetchedAt: new Date().toISOString(),
  latestMonth: "2026-09",
  fromMonth: "2025-10",
  toMonthExclusive: "2026-10",
  departure: "2026-10-13T08:00:00+08:00",
  sourceUrl: "https://data.gov.sg/",
  facilitySources: [
    {
      category: "Groceries",
      theme: "test-gazetteer",
      updatedAt: new Date().toISOString(),
      partial: true,
      dateKind: "retrieved",
      coverage:
        "Partial store directory. Missing points do not prove no groceries.",
    },
    {
      category: "Healthcare",
      theme: "test-hospitals",
      updatedAt: new Date().toISOString(),
      coverage: "Hospital locations only.",
    },
    {
      category: "Schools",
      theme: "test-schools",
      updatedAt: new Date().toISOString(),
      coverage: "MOE school directory; not admission eligibility.",
    },
  ],
};

function browsingFixture(areaId: string, radius = 1000) {
  const origin = results.find((r) => r.area.id === areaId)!.area;
  return facilitiesNear(
    {
      id: "independent-map-snapshot",
      fetchedAt: new Date().toISOString(),
      supportedFacilities: [...lifestyleCategories],
      facilitySources: lifestyleCategories.map((category) => ({
        category,
        theme: "test",
        updatedAt: new Date().toISOString(),
        coverage: "Fixture layer, not part of saved scoring.",
      })),
      facilities: results.flatMap((r) =>
        lifestyleCategories.map((category, i) => ({
          name: `Browse ${category}`,
          category,
          latitude: r.area.latitude + i * 0.0003,
          longitude: r.area.longitude + i * 0.0002,
        })),
      ),
    } as ResearchSnapshot,
    origin,
    radius,
  );
}

test("recent searches: cancel, retry, clear and persist without losing profiles or saved areas", async ({
  page,
}, info) => {
  let history = [
    {
      id: discovery.id,
      createdAt: discovery.createdAt,
      profileName: preference.name,
    },
  ];
  let clearCalls = 0;
  let rejectClear = true;
  const bookmark = savedArea(
    {
      id: crypto.randomUUID(),
      created_at: discovery.createdAt,
      discovery_id: discovery.id,
      area_id: discovery.results[0].area.id,
    },
    discovery,
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { id: profile.id, email: "test@example.com" },
          mode: "supabase",
        },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [bookmark] } });
    if (path === "/api/discoveries") {
      if (route.request().method() === "DELETE") {
        clearCalls++;
        expect(route.request().postDataJSON()).toEqual({ confirm: true });
        if (rejectClear)
          return route.fulfill({
            status: 503,
            json: {
              error: {
                code: "HISTORY_CLEAR_FAILED",
                message: "Recent searches could not be cleared. Please retry.",
              },
            },
          });
        history = [];
        return route.fulfill({ json: { cleared: true } });
      }
      return route.fulfill({ json: { discoveries: history } });
    }
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  const clear = page.getByRole("button", {
    name: "Clear recent searches",
    exact: true,
  });
  await expect(clear).toBeEnabled();
  await page.screenshot({
    path: `test-results/history-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  page.once("dialog", (dialog) => dialog.dismiss());
  await clear.click();
  expect(clearCalls).toBe(0);
  page.once("dialog", (dialog) => dialog.accept());
  await clear.click();
  await expect(
    page
      .getByRole("region", { name: "Recent area searches", exact: true })
      .getByRole("alert"),
  ).toContainText("could not be cleared");
  await expect(
    page.getByRole("button", { name: new RegExp(`${preference.name} ·`) }),
  ).toBeVisible();
  rejectClear = false;
  page.once("dialog", (dialog) => dialog.accept());
  await clear.click();
  await expect(page.getByRole("status")).toContainText("No recent searches.");
  await expect(clear).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /My profiles 1/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Saved areas 1/ }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await expect(page.getByRole("status")).toContainText("No recent searches.");
  history = [
    {
      id: discovery.id,
      createdAt: new Date().toISOString(),
      profileName: "New search",
    },
  ];
  await page.reload();
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await expect(
    page.getByRole("button", { name: /New search ·/ }),
  ).toBeVisible();
  expect(clearCalls).toBe(2);
});

test("saved profile to map, evidence, comparison, theme and persisted search history", async ({
  page,
}, info) => {
  let bookmarks: SavedArea[] = [];
  let signedIn = true;
  let rejectSave = false;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/facilities")) {
      const url = new URL(route.request().url());
      return route.fulfill({
        json: {
          facilities: browsingFixture(
            url.searchParams.get("areaId")!,
            Number(url.searchParams.get("radius")),
          ),
        },
      });
    }
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          user: signedIn ? { id: profile.id, email: "test@example.com" } : null,
          mode: "supabase",
        },
      });
    if (path === "/api/auth/sign-out") {
      signedIn = false;
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/shortlist") {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { savedAreas: bookmarks } });
      if (rejectSave)
        return route.fulfill({
          status: 503,
          json: {
            error: {
              code: "SHORTLIST_UNAVAILABLE",
              message: "Save failed. Retry.",
            },
          },
        });
      const { areaId } = route.request().postDataJSON();
      const item = savedArea(
        {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          discovery_id: discovery.id,
          area_id: areaId,
        },
        discovery,
      );
      bookmarks = [item, ...bookmarks];
      return route.fulfill({ json: { savedArea: item } });
    }
    if (
      path.startsWith("/api/shortlist/") &&
      route.request().method() === "DELETE"
    ) {
      bookmarks = bookmarks.filter((item) => !path.endsWith(item.id));
      return route.fulfill({ json: { removed: true } });
    }
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/discoveries")
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { discovery }
            : { discoveries: [] },
      });
    if (path === `/api/discoveries/${discovery.id}`)
      return route.fulfill({ json: { discovery } });
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  await expect(
    page.getByRole("heading", { name: "Your area matches", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Jurong East");
  const listing = page
    .getByRole("region", { name: "External housing listings" })
    .getByRole("link")
    .first();
  const listingUrl = new URL((await listing.getAttribute("href"))!);
  expect(listingUrl.searchParams.get("keyword")).toBe("JURONG EAST");
  expect(listingUrl.searchParams.get("propertyTypeGroup")).toBe("H");
  expect(await listing.getAttribute("target")).toBe("_blank");
  expect(await listing.getAttribute("rel")).toContain("noreferrer");
  await expect(page.getByRole("note")).toContainText(
    "Provisional groceries evidence",
  );
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Hospital locations only");
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Test Schools");
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Test Groceries");
  rejectSave = true;
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Save failed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save area", exact: true }),
  ).toBeEnabled();
  rejectSave = false;
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved area", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".leaflet-tile-loaded").first()).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.locator(".leaflet-overlay-pane path").first(),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/recommendations-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.locator('.leaflet-tile-loaded[src*="GreyLite"]').first(),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/recommendations-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Matches (2)", exact: true }).click();
  await page
    .getByRole("region", { name: "Ranked areas" })
    .getByRole("button", { name: /Bedok/ })
    .click();
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Bedok MRT");
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove saved area", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Matches (2)", exact: true }).click();
  await page.getByLabel("Compare area").nth(0).check();
  await page.getByLabel("Compare area").nth(1).check();
  await page.getByRole("button", { name: "Compare (2/3)" }).click();
  await expect(page.getByRole("table")).toContainText("Price quartiles");
  await page.getByRole("button", { name: "Back to matches" }).click();
  await page.getByRole("button", { name: "My profiles", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recent area searches" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Saved areas 2", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Saved areas" })).toContainText(
    "Bedok",
  );
  await page.screenshot({
    path: `test-results/shortlist-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.getByLabel("Compare saved Bedok").check();
  await page.getByLabel("Compare saved Jurong East").check();
  await page.getByRole("button", { name: "Compare saved (2/3)" }).click();
  await expect(page.getByRole("table")).toContainText("Search date");
  await expect(page.getByRole("note")).toContainText("not directly comparable");
  await page.getByRole("button", { name: "Back to saved areas" }).click();
  await page
    .getByRole("region", { name: "Saved areas" })
    .getByRole("button", { name: "View evidence" })
    .first()
    .click();
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Bedok MRT");
  await page.getByRole("button", { name: "Saved areas", exact: true }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Saved areas 2", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Saved areas" })).toContainText(
    "Bedok",
  );
  await page
    .getByRole("button", { name: "Remove Bedok from saved areas", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Saved areas 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Remove Jurong East from saved areas",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "No saved areas yet" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Find areas", exact: true }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  await page.getByRole("button", { name: "Save area", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Saved areas 1", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: /Find a home that fits the way you live/,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview planner without an account" })
    .click();
  await page
    .getByRole("button", { name: "Saved areas 0", exact: true })
    .click();
  await expect(page.getByText("Sign in to see your shortlist.")).toBeVisible();
});

test("shortlist read failure is not shown as an empty shortlist and can be retried", async ({
  page,
}) => {
  let failed = true;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return failed
        ? route.fulfill({
            status: 503,
            json: {
              error: {
                code: "SHORTLIST_UNAVAILABLE",
                message: "Saved areas unavailable. Retry.",
              },
            },
          })
        : route.fulfill({ json: { savedAreas: [] } });
    return route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Saved areas 0", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Saved areas could not be loaded" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No saved areas yet" }),
  ).toHaveCount(0);
  failed = false;
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No saved areas yet" }),
  ).toBeVisible();
});

test("map focuses the first match and tile warnings recover after navigating to healthy tiles", async ({
  page,
}) => {
  const tile = await readFile("public/pwa/favicon-32.png");
  let failures: "all" | "one" | "none" = "all";
  await page.route("**/maps/tiles/**", async (route) => {
    if (failures === "all") return route.abort();
    if (failures === "one") {
      failures = "none";
      return route.abort();
    }
    return route.fulfill({ contentType: "image/png", body: tile });
  });
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/facilities"))
      return route.fulfill({
        json: { facilities: browsingFixture("jurong-east", 1000) },
      });
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { discovery }
            : { discoveries: [] },
      });
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  await expect(
    page.getByText(
      "OneMap tiles unavailable. Area evidence is still accessible.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Jurong East MRT");
  failures = "none";
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(
    page.locator('.leaflet-tile-loaded[src*="/Night/15/"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry map", exact: true }),
  ).toHaveCount(0);
  failures = "one";
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByText(
      "Some OneMap tiles could not load. Area evidence is still accessible.",
    ),
  ).toBeVisible();
  // A fresh viewport clears the earlier failure without remounting/retrying the layer.
  await expect(page.locator(".leaflet-zoom-anim")).toHaveCount(0);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.locator('.leaflet-tile-loaded[src*="/Night/17/"]').first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Retry map", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Collapse panels", exact: true }).click();
  await page
    .getByRole("button", { name: "Show all matching areas", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /BEDOK: match score/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /BEDOK: match score/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Bedok MRT");
  await expect(
    page.locator('.leaflet-tile-loaded[src*="/Night/15/"]').first(),
  ).toBeVisible();
});

test("map workspace filters, layers, keyboard pins and view state", async ({
  page,
}, info) => {
  let discoveryWrites = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/facilities")) {
      const url = new URL(route.request().url());
      return route.fulfill({
        json: {
          facilities: browsingFixture(
            url.searchParams.get("areaId")!,
            Number(url.searchParams.get("radius")),
          ),
        },
      });
    }
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/discoveries") {
      if (route.request().method() === "POST") discoveryWrites++;
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { discovery }
            : { discoveries: [] },
      });
    }
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible();
  await expect(
    page.locator('.leaflet-tile-loaded[src*="Night"]').first(),
  ).toBeVisible();
  const originalMap = await map.elementHandle();
  const mapBox = await map.boundingBox();
  // The mobile header wraps; keep at least half the viewport usable as a map.
  expect(mapBox!.height).toBeGreaterThan(
    info.project.name === "mobile" ? page.viewportSize()!.height / 2 : 500,
  );
  expect(mapBox!.width).toBe(info.project.name === "mobile" ? 360 : 1440);
  expect(mapBox!.y + mapBox!.height).toBeLessThanOrEqual(
    info.project.name === "mobile" ? 801 : 1001,
  );
  await page.getByRole("button", { name: "Matches (2)", exact: true }).click();
  await page.getByRole("searchbox", { name: "Filter towns" }).fill("bedok");
  await expect(
    page.getByRole("region", { name: "Ranked areas" }).getByRole("button"),
  ).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: "Ranked areas" }),
  ).toContainText("2");
  await page
    .getByRole("searchbox", { name: "Filter towns" })
    .fill("no-such-town");
  await expect(page.getByText(/No towns match/)).toBeVisible();
  await page.getByRole("button", { name: "Clear filter" }).click();
  await page.getByLabel("Sort areas").selectOption("median");
  await expect(
    page.getByRole("region", { name: "Ranked areas" }).getByRole("button"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const layers = page.getByRole("region", { name: "Map layers" });
  const paths = page.locator(".leaflet-overlay-pane path");
  await expect(
    page.getByText("Loading nearby amenities…", { exact: true }),
  ).toHaveCount(0);
  const before = await paths.count();
  await layers.getByLabel("Parks").uncheck();
  await expect(paths).toHaveCount(before - 1);
  await layers.getByLabel("Routes", { exact: true }).uncheck();
  await expect(paths).toHaveCount(before - 2);
  await layers.getByLabel("Geographic radii").uncheck();
  await expect(paths).toHaveCount(before - 3);
  const overall = await page
    .locator('section[aria-label="Area evidence"]')
    .textContent();
  await layers.getByLabel("Gyms").check();
  await expect(paths).toHaveCount(before - 2);
  await expect(page.getByRole("region", { name: "Map legend" })).toContainText(
    "Gyms",
  );
  await expect(layers.getByLabel("Hospitals")).toBeVisible();
  await layers.getByLabel("Explore radius").selectOption("2000");
  await expect(
    page.getByText("Loading nearby amenities…", { exact: true }),
  ).toHaveCount(0);
  if (overall)
    expect(
      await page.locator('section[aria-label="Area evidence"]').textContent(),
    ).toBe(overall);
  await layers
    .getByRole("button", { name: "Historical median", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "BEDOK: historical median $500k",
      exact: true,
    }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "Close map layers" }).click();
  await page.getByRole("button", { name: "Collapse panels" }).click();
  await page.getByRole("button", { name: "Show all matching areas" }).click();
  const bedok = page.getByRole("button", {
    name: "BEDOK: historical median $500k",
    exact: true,
  });
  await bedok.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Bedok MRT");
  await expect(page.getByRole("button", { name: "Expand panels" })).toHaveCount(
    0,
  );
  const markerBox = await bedok.boundingBox();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(
    page.locator('.leaflet-tile-loaded[src*="GreyLite"]').first(),
  ).toBeVisible();
  const lightBox = await bedok.boundingBox();
  expect(Math.abs(markerBox!.x - lightBox!.x)).toBeLessThan(2);
  expect(Math.abs(markerBox!.y - lightBox!.y)).toBeLessThan(2);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(map).toBeHidden();
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(map).toBeVisible();
  await expect
    .poll(async () => {
      const afterList = await bedok.boundingBox();
      return afterList
        ? Math.max(
            Math.abs(afterList.x - lightBox!.x),
            Math.abs(afterList.y - lightBox!.y),
          )
        : Infinity;
    })
    .toBeLessThan(2);
  expect(await originalMap!.evaluate((el) => el.isConnected)).toBe(true);
  expect(discoveryWrites).toBe(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/map-workspace-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page.route("**/maps/tiles/**", (route) => route.abort());
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  // Previously displayed Night images can be reused from the browser's image cache.
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(
    page.getByText(
      /(?:OneMap tiles unavailable|Some OneMap tiles could not load)\. Area evidence is still accessible\./,
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Area evidence" }),
  ).toContainText("Bedok MRT");
  await page.unroute("**/maps/tiles/**");
  await page.getByRole("button", { name: "Retry map", exact: true }).click();
  await expect(
    page.locator('.leaflet-tile-loaded[src*="Night"]').first(),
  ).toBeVisible();
  await expect(
    page.getByText(
      /(?:OneMap tiles unavailable|Some OneMap tiles could not load)\. Area evidence is still accessible\./,
    ),
  ).toHaveCount(0);
  await bedok.focus();
  const areaTooltip = page
    .getByRole("tooltip")
    .filter({ hasText: "BEDOK · Bedok MRT" });
  await expect(areaTooltip).toBeVisible();
  const tooltipBox = await areaTooltip.boundingBox();
  expect(tooltipBox!.width).toBeGreaterThan(100);
  expect(tooltipBox!.width).toBeLessThanOrEqual(240);
  expect(tooltipBox!.height).toBeLessThan(80);
  await page.screenshot({
    path: `test-results/map-tooltip-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await bedok.focus();
  await expect(areaTooltip).toBeVisible();
  const lightTooltipBox = await areaTooltip.boundingBox();
  expect(lightTooltipBox!.width).toBeGreaterThan(100);
  expect(lightTooltipBox!.width).toBeLessThanOrEqual(240);
  expect(lightTooltipBox!.height).toBeLessThan(80);
  await page.screenshot({
    path: `test-results/map-tooltip-${info.project.name}-light.png`,
    fullPage: true,
  });
});

test("saved comparison requires two areas and caps selection at three", async ({
  page,
}) => {
  const items = ["Bedok", "Jurong East", "Bishan", "Ang Mo Kio"].map(
    (name, i) => ({
      ...savedArea(
        {
          id: crypto.randomUUID(),
          created_at: new Date().toISOString(),
          discovery_id: discovery.id,
          area_id: discovery.results[0].area.id,
        },
        discovery,
      ),
      result: {
        ...discovery.results[0],
        area: { ...discovery.results[0].area, id: `test-${i}`, name },
      },
    }),
  );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: items } });
    return route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Saved areas 4", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Compare saved (0/3)" }),
  ).toBeDisabled();
  await page.getByLabel("Compare saved Bedok").check();
  await expect(
    page.getByRole("button", { name: "Compare saved (1/3)" }),
  ).toBeDisabled();
  await page.getByLabel("Compare saved Jurong East").check();
  await page.getByLabel("Compare saved Bishan").check();
  await expect(page.getByLabel("Compare saved Ang Mo Kio")).toBeDisabled();
  await page.getByRole("button", { name: "Compare saved (3/3)" }).click();
  await expect(page.getByRole("table")).toContainText(
    "Journey / lifestyle / budget weights",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("exploration outside profile preferences is retryable and never changes scores", async ({
  page,
}, info) => {
  let fail = true;
  let mutationCount = 0;
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() !== "GET") mutationCount++;
    if (path.endsWith("/facilities"))
      return fail
        ? route.fulfill({
            status: 503,
            json: {
              error: { message: "Amenity service temporarily unavailable." },
            },
          })
        : route.fulfill({
            json: {
              facilities: browsingFixture(
                url.searchParams.get("areaId")!,
                Number(url.searchParams.get("radius")),
              ),
            },
          });
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { discovery }
            : { discoveries: [] },
      });
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  await expect(
    page.getByText(/Amenity service temporarily unavailable/),
  ).toBeVisible();
  const originalEvidence = await page
    .locator('section[aria-label="Area evidence"]')
    .textContent();
  fail = false;
  await page.getByRole("button", { name: "Retry amenities" }).click();
  await expect(
    page.getByText(/Amenity service temporarily unavailable/),
  ).toHaveCount(0);
  await page
    .getByRole("toolbar", { name: "Explore amenities" })
    .getByRole("button", { name: "Show Hawker centres", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Map legend" })).toContainText(
    "Hawker centres",
  );
  await page.getByRole("button", { name: "Layers", exact: true }).click();
  const layers = page.getByRole("region", { name: "Map layers" });
  await expect(
    layers.getByText("Your destination", { exact: true }),
  ).toBeVisible();
  await expect(layers.getByLabel("Gyms")).toBeVisible();
  await layers.getByLabel("Basketball").check();
  await layers.getByLabel("Football / futsal").check();
  expect(
    await page.locator('section[aria-label="Area evidence"]').textContent(),
  ).toBe(originalEvidence);
  expect(mutationCount).toBe(1);
  await page.screenshot({
    path: `test-results/amenity-layers-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close map layers" }).click();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
  await page
    .getByRole("group", { name: "Gyms priority" })
    .getByRole("button", { name: "Nice" })
    .click();
  await expect(
    page.getByRole("button", { name: /^Gyms search radius/ }),
  ).toBeVisible();
  await page
    .getByRole("group", { name: "Football / futsal priority" })
    .getByRole("button", { name: "Nice" })
    .click();
  await expect(
    page.getByRole("button", { name: /^Football \/ futsal search radius/ }),
  ).toBeVisible();
});

test("matches light up once, then a weekday and a block comparison are told from the search evidence", async ({
  page,
}) => {
  // Undo the shared skip so this search plays the reveal.
  await page.addInitScript(() =>
    sessionStorage.removeItem("homematch-reveal-seen"),
  );
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (path.endsWith("/facilities"))
      return route.fulfill({
        json: {
          facilities: browsingFixture(
            url.searchParams.get("areaId")!,
            Number(url.searchParams.get("radius")),
          ),
        },
      });
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: profile.id }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [profile] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { discovery }
            : { discoveries: [] },
      });
    return route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: /My profiles 1/ }).click();
  await page.getByRole("button", { name: "Find matching areas" }).click();
  const reveal = page.getByRole("dialog", {
    name: "Your matches are lighting up",
  });
  await expect(reveal).toContainText("2 towns fit your week.");
  await expect(
    reveal.getByRole("img", { name: /Jurong East fits best/ }),
  ).toBeVisible();
  await reveal.getByRole("button", { name: "Skip" }).click();
  await expect(reveal).toHaveCount(0);
  expect(
    await page.evaluate(() => sessionStorage.getItem("homematch-reveal-seen")),
  ).toBe("1");
  await page.getByRole("button", { name: "Replay reveal" }).click();
  await expect(reveal).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(reveal).toHaveCount(0);

  const evidence = page.getByRole("region", { name: "Area evidence" });
  await expect(evidence).toContainText("of 10 lit");
  await evidence
    .getByRole("button", { name: "A weekday in Jurong East" })
    .click();
  const weekday = page.getByRole("region", {
    name: "A weekday in Jurong East",
  });
  await expect(weekday).toContainText(
    `30 min to ${preference.destinations[0].location!.label}`,
  );
  await expect(weekday).toContainText("About 5 hours of travel a week");
  const play = weekday.getByRole("button", { name: /the day/ });
  const playing = await play.getAttribute("aria-pressed");
  await play.click();
  await expect(play).not.toHaveAttribute("aria-pressed", playing!);
  await weekday.getByRole("button", { name: /22:30/ }).click();
  await expect(weekday.getByRole("button", { name: /22:30/ })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await weekday.getByRole("button", { name: "Close weekday view" }).click();
  await expect(weekday).toHaveCount(0);

  await page.getByRole("button", { name: "Matches (2)", exact: true }).click();
  await page.getByLabel("Compare area").nth(0).check();
  await page.getByLabel("Compare area").nth(1).check();
  await page.getByRole("button", { name: "Compare (2/3)" }).click();
  const comparison = page.getByRole("region", { name: "Area comparison" });
  await expect(
    comparison.getByRole("heading", { name: "Side by side, block by block." }),
  ).toBeVisible();
  await expect(
    comparison.getByRole("region", { name: "Bedok block" }),
  ).toContainText("Getting around");
  await expect(comparison.getByRole("table")).toContainText("Overall match");
});
