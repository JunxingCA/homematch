import { test, expect, type Page } from "@playwright/test";

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

async function ready(page: Page) {
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
}
async function cacheUrls(page: Page) {
  return page.evaluate(async () => {
    const result: string[] = [];
    for (const name of await caches.keys())
      for (const request of await (await caches.open(name)).keys())
        result.push(new URL(request.url).pathname);
    return result.sort();
  });
}
const allowed = [
  "/homematch-logo.svg",
  "/pwa/offline.css",
  "/pwa/offline.html",
  "/pwa/offline.js",
];

test("manifest, icon dimensions, secure worker headers and control", async ({
  page,
  request,
}) => {
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest).toMatchObject({
    name: "HomeMatch",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    const png = await (await request.get(icon.src)).body();
    expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
  }
  const worker = await request.get("/sw.js");
  expect(worker.headers()["cache-control"]).toContain("no-store");
  expect(worker.headers()["service-worker-allowed"]).toBe("/");
  await ready(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    "/pwa/apple-touch-icon.png",
  );
  expect(await cacheUrls(page)).toEqual(allowed);
});

test("installation help fits both themes; keyboard dismissal restores focus", async ({
  page,
}, testInfo) => {
  await ready(page);
  for (const theme of ["dark", "light"]) {
    if (theme === "light")
      await page
        .getByRole("button", { name: "Switch to light mode", exact: true })
        .click();
    await page
      .getByRole("button", { name: "Install HomeMatch", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "HomeMatch, closer." });
    await expect(dialog).toBeVisible();
    if (testInfo.project.name === "ios-guidance-emulation") {
      await expect(dialog).toContainText("Add to Home Screen");
      await expect(dialog).toContainText("Open as Web App");
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await page.screenshot({
      path: testInfo.outputPath(`install-${theme}.png`),
    });
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Install HomeMatch", exact: true }),
    ).toBeFocused();
  }
});

test("supported install prompt is one-use; dismissal and installed state are handled", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "ios-guidance-emulation",
    "Safari uses OS instructions, not beforeinstallprompt.",
  );
  await ready(page);
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "dismissed" }),
    });
    dispatchEvent(event);
  });
  await page
    .getByRole("button", { name: "Install HomeMatch", exact: true })
    .click();
  await page.getByRole("button", { name: "Install app", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Installation cancelled",
  );
  await expect(
    page.getByRole("button", { name: "Install app", exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    dispatchEvent(new Event("appinstalled"));
  });
  await expect(
    page.getByRole("button", { name: "Install HomeMatch", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("offline navigation shows only reconnect content, including token-bearing auth URLs", async ({
  page,
  context,
}, testInfo) => {
  await ready(page);
  await page
    .getByLabel("Profile name", { exact: true })
    .fill("PRIVATE SENTINEL");
  await context.setOffline(true);
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline" }),
  ).toContainText("Changes are not saved");
  await page
    .getByLabel("Profile name", { exact: true })
    .fill("PRIVATE UNSAVED");
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(
    "PRIVATE UNSAVED",
  );
  // This test deliberately leaves the unsaved form to check the cold offline document.
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/auth/callback?code=SECRET_SENTINEL");
  await expect(
    page.getByRole("heading", { name: "A connection away." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open HomeMatch" }),
  ).toHaveAttribute("href", "/");
  expect(await page.content()).not.toMatch(
    /SECRET_SENTINEL|PRIVATE SENTINEL|PRIVATE UNSAVED/,
  );
  expect(await cacheUrls(page)).toEqual(allowed);
  for (const theme of ["dark", "light"]) {
    await page.evaluate((value) => {
      document.documentElement.dataset.theme = value;
    }, theme);
    await page.screenshot({
      path: testInfo.outputPath(`offline-${theme}.png`),
    });
  }
  await context.setOffline(false);
  await expect(page.getByRole("status")).toContainText("Connection detected");
  await page.getByRole("link", { name: "Open HomeMatch" }).click();
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  expect(new URL(page.url()).search).toBe("");
  expect(await cacheUrls(page)).toEqual(allowed);
});

test("private reads and mutations never enter the cache or replay after reconnect", async ({
  page,
  context,
}) => {
  await ready(page);
  const results = await page.evaluate(async () => {
    const values = [];
    for (const path of [
      "/api/auth/session",
      "/api/profiles",
      "/api/shortlist",
      "/api/discoveries",
    ])
      values.push((await fetch(path, { cache: "no-store" })).status);
    return values;
  });
  expect(results).toEqual([200, 503, 503, 503]);
  // A synthetic authenticated response also remains network-only; no hosted user is involved.
  await page.route("**/api/profiles", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "Cache-Control": "private, no-store" },
      body: JSON.stringify({
        profiles: [{ name: "PRIVATE RESPONSE SENTINEL" }],
      }),
    }),
  );
  expect(
    await page.evaluate(async () =>
      (await fetch("/api/profiles", { cache: "no-store" })).text(),
    ),
  ).toContain("PRIVATE RESPONSE SENTINEL");
  await page.unroute("**/api/profiles");
  expect(await cacheUrls(page)).toEqual(allowed);
  let attemptedPosts = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/profiles") && request.method() === "POST")
      attemptedPosts++;
  });
  await context.setOffline(true);
  const failed = await page.evaluate(async () => {
    try {
      await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "PRIVATE SENTINEL" }),
      });
      return false;
    } catch {
      return true;
    }
  });
  expect(failed).toBe(true);
  const beforeReconnect = attemptedPosts;
  expect(await cacheUrls(page)).toEqual(allowed);
  await context.setOffline(false);
  await expect(
    page.getByRole("status").filter({ hasText: "You are offline" }),
  ).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(attemptedPosts).toBe(beforeReconnect);
  expect(await cacheUrls(page)).toEqual(allowed);
});

for (const outcome of ["accepted", "error"]) {
  test(`installation ${outcome} does not claim completion or reuse the prompt`, async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "ios-guidance-emulation",
      "Safari uses the operating system installation menu.",
    );
    await ready(page);
    await page.evaluate((result) => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      Object.assign(event, {
        prompt: async () => {
          if (result === "error") throw new Error("Unavailable");
        },
        userChoice: Promise.resolve({ outcome: result }),
      });
      dispatchEvent(event);
    }, outcome);
    await page
      .getByRole("button", { name: "Install HomeMatch", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Install app", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      outcome === "accepted"
        ? "Installation requested"
        : "Installation could not start",
    );
    await expect(
      page.getByRole("button", { name: "Install app", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Install HomeMatch", exact: true }),
    ).toBeAttached();
  });
}

test("standalone launches hide installation controls", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "standalone", { get: () => true });
  });
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Install HomeMatch", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Build your ideal block." }),
  ).toBeVisible();
});

test("waiting updates need explicit approval and are disabled offline", async ({
  page,
  context,
}) => {
  // Fake only the waiting update to test approval safely; installation/cache use the real worker.
  await page.addInitScript(() => {
    const register = navigator.serviceWorker.register.bind(
      navigator.serviceWorker,
    );
    const state = Object.assign(window, { updateMessages: 0 });
    navigator.serviceWorker.register = async (...args) => {
      const registration = await register(...args);
      Object.defineProperty(registration, "waiting", {
        get: () => ({
          postMessage: (message: { type: string }) => {
            if (message.type === "ACTIVATE_UPDATE") state.updateMessages++;
          },
        }),
      });
      return registration;
    };
  });
  await ready(page);
  const update = page.getByRole("button", { name: "Update now", exact: true });
  await expect(update).toBeVisible();
  page.once("dialog", (dialog) => dialog.dismiss());
  await update.click();
  expect(await page.evaluate(() => Reflect.get(window, "updateMessages"))).toBe(
    0,
  );
  await context.setOffline(true);
  await expect(update).toBeDisabled();
  await context.setOffline(false);
  await expect(update).toBeEnabled();
  page.once("dialog", (dialog) => dialog.accept());
  await update.click();
  expect(await page.evaluate(() => Reflect.get(window, "updateMessages"))).toBe(
    1,
  );
});
