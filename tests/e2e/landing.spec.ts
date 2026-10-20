import { expect, test, type Page } from "@playwright/test";

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

const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "landing@example.test",
};

const headline = /Find a home that fits the way you live/;

test("landing fonts load locally without Google Fonts or platform cursive fallback", async ({
  page,
}, info) => {
  await fixture(page);
  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url()))
      externalFontRequests.push(request.url());
  });
  await page.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/, (route) =>
    route.abort(),
  );
  await page.goto("/welcome");
  const title = page.getByRole("heading", { name: headline });
  await expect(title).toBeVisible();
  const fonts = await title.evaluate(async (el) => {
    await document.fonts.ready;
    const family = getComputedStyle(el).fontFamily;
    const faces = await document.fonts.load(`800 32px ${family}`, "home");
    return {
      family,
      loaded: faces.length,
      status: faces.map((face) => face.status),
    };
  });
  expect(fonts.family).not.toMatch(/Comic|cursive|Playwrite/i);
  expect(fonts.loaded).toBeGreaterThan(0);
  expect(fonts.status.every((status) => status === "loaded")).toBe(true);
  expect(externalFontRequests).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/local-font-${info.project.name}.png`,
  });
});

test("launch intro plays once per session, can be skipped and replayed", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: info.project.use.viewport ?? undefined,
  });
  const page = await context.newPage();
  await fixture(page);
  await page.goto("/");
  const gate = page.getByRole("dialog", { name: "Welcome to HomeMatch" });
  await expect(gate).toBeVisible();
  await expect(
    gate.getByRole("button", { name: "Turn the lights on" }),
  ).toBeVisible();
  await gate.getByRole("button", { name: "Enter without sound" }).click();
  const intro = page.getByRole("dialog", { name: "HomeMatch intro" });
  await expect(intro).toBeVisible();
  await expect(intro.getByRole("button", { name: "Sound off" })).toBeVisible();
  await intro.getByRole("button", { name: "Skip intro →" }).click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await expect(gate).toHaveCount(0);
  // Replay sits in the desktop header; phones keep a shorter header.
  if (info.project.name === "desktop") {
    await page.getByRole("button", { name: "↺ Intro" }).click();
    await expect(gate).toBeVisible();
    await gate.getByRole("button", { name: "Enter without sound" }).click();
    await expect(intro).toHaveCount(0, { timeout: 10_000 });
  }
  // The intro flag and sound choice are session-only; nothing personal is stored.
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect(
    (await page.evaluate(() => Object.keys(sessionStorage))).sort(),
  ).toEqual(["homematch-intro-seen", "homematch-sound"]);
  await context.close();
});

test("theme follows the time of day until a choice is made", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: info.project.use.viewport ?? undefined,
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("homematch-intro-seen", "1"),
  );
  const page = await context.newPage();
  await fixture(page);
  await page.clock.setFixedTime(new Date(2026, 9, 20, 13, 0));
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("button", { name: "Follow the time of day" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Follow the time of day" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  await context.close();
});

test("signed-out landing hero, trust, floors, lifestyles, both themes and responsive layout", async ({
  page,
}, info) => {
  const calls = await fixture(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("img", { name: /HDB estate going from day to night/ }),
  ).toBeVisible();
  await expect(
    page.getByText("Official records", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveCount(0);
  for (const theme of ["dark", "light"] as const) {
    if (theme === "light")
      await page.getByRole("button", { name: "Switch to light mode" }).click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/landing-${info.project.name}-${theme}.png`,
      fullPage: true,
    });
  }
  await page.getByRole("link", { name: "How it works" }).first().click();
  await expect(
    page.getByRole("heading", { name: "Three floors up to the right home." }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Not sure where to start? Pick a life.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /The young family/ }),
  ).toBeVisible();
  expect(calls.privateReads).toBe(0);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("landing opens existing registration and login, retains provider errors and traps focus", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/");
  const start = page.getByRole("button", {
    name: "Start matching",
    exact: true,
  });
  await start.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Create your account", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Continue with Apple" }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Back to sign in", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Continue with Google", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText(
    "temporarily unavailable",
  );
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(start).toBeFocused();
  expect(calls.google).toBe(1);
});

test("email login enters the existing workspace and returning sessions bypass landing", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email", { exact: true }).fill(owner.email);
  await dialog
    .getByLabel("Password", { exact: true })
    .fill("A sample password!");
  await dialog.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: headline })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
  expect(calls.signIns).toBe(1);
});

test("preview planner is temporary and keeps manual inputs when closing sign-in", async ({
  page,
}) => {
  const calls = await fixture(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Preview planner without an account" })
    .click();
  await page
    .getByLabel("Profile name", { exact: true })
    .fill("Unsaved public example");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByRole("button", { name: "Forgot password?", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByLabel("Password", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(
    "Unsaved public example",
  );
  expect(calls.privateReads).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key !== "homematch-theme"),
    ),
  ).toEqual([]);
  await page.getByRole("link", { name: "HomeMatch home", exact: true }).click();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
  await page
    .getByRole("button", { name: "Preview planner without an account" })
    .click();
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(
    "Unsaved public example",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
});

test("a lifestyle preset opens the planner pre-filled and saves nothing", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/");
  await page.getByRole("button", { name: /The young family/ }).click();
  await expect(
    page.getByRole("heading", { name: "Build your ideal block." }),
  ).toBeVisible();
  const schools = page.getByRole("group", { name: "Schools priority" });
  await expect(schools.getByRole("button", { name: "Must" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(
    page
      .getByRole("group", { name: "Parks priority" })
      .getByRole("button", { name: "Nice" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key !== "homematch-theme"),
    ),
  ).toEqual([]);
});

test("cancelled OAuth and session-provider failure are visible on the entrance", async ({
  page,
}) => {
  await fixture(page, false, true);
  await page.goto("/?auth=cancelled");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    /unavailable|cancelled/,
  );
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
});

test("welcome route offers the entrance without logging out an existing session", async ({
  page,
}) => {
  const calls = await fixture(page, true);
  await page.goto("/welcome");
  await expect(
    page.getByRole("button", { name: "Open workspace", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Open workspace", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
  expect(calls.signIns).toBe(0);
});

async function fixture(page: Page, signedIn = false, sessionFailure = false) {
  const calls = { signIns: 0, google: 0, privateReads: 0 };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill(
        signedIn
          ? { json: { user: owner } }
          : {
              status: sessionFailure ? 503 : 401,
              json: {
                error: {
                  code: sessionFailure
                    ? "AUTH_UNAVAILABLE"
                    : "SIGN_IN_REQUIRED",
                  message: sessionFailure
                    ? "Account service unavailable. Please retry."
                    : "Sign in",
                },
              },
            },
      );
    if (path === "/api/auth/sign-in") {
      calls.signIns++;
      expect(route.request().postDataJSON()).toEqual({
        email: owner.email,
        password: "A sample password!",
      });
      signedIn = true;
      return route.fulfill({ json: { user: owner } });
    }
    if (path === "/api/auth/google") {
      calls.google++;
      return route.fulfill({
        status: 503,
        json: {
          error: {
            code: "OAUTH_UNAVAILABLE",
            message: "Google sign-in is temporarily unavailable. Please retry.",
          },
        },
      });
    }
    if (path === "/api/profiles") {
      calls.privateReads++;
      return route.fulfill({ json: { profiles: [] } });
    }
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/preferences/interpret")
      return route.fulfill({ json: { enabled: false } });
    return route.abort();
  });
  return calls;
}

test("unknown pages answer 404 with a way back to the lobby", async ({
  page,
}) => {
  const response = await page.goto("/no-such-unit");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "This unit doesn’t exist.", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the lobby" }),
  ).toHaveAttribute("href", "/");
  await page.getByRole("link", { name: "Back to the lobby" }).click();
  await expect(page.getByRole("heading", { name: headline })).toBeVisible();
});
