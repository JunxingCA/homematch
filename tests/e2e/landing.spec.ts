import { expect, test, type Page } from "@playwright/test";

const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "landing@example.test",
};

for (const palette of ["rose", "red"] as const) {
  test(`${palette} palette applies to landing and planner in both modes without persisting private state`, async ({
    page,
  }, info) => {
    await fixture(page);
    await page.goto(`/welcome?palette=${palette}`);
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette);
    await expect(
      page.locator(`img[src="/homematch-logo-${palette}.svg"]`),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeEnabled();
    for (const theme of ["dark", "light"] as const) {
      if (theme === "light")
        await page
          .getByRole("button", { name: "Switch to light mode" })
          .click();
      const color = await page
        .getByRole("button", { name: "Sign in", exact: true })
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(color).toBe(
        palette === "red"
          ? theme === "dark"
            ? "rgb(173, 30, 48)"
            : "rgb(173, 30, 48)"
          : theme === "dark"
            ? "rgb(239, 155, 171)"
            : "rgb(153, 52, 84)",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${palette}-${info.project.name}-${theme}.png`,
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Preview planner", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-palette", palette);
    await expect(
      page.getByLabel("Profile name", { exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `test-results/${palette}-${info.project.name}-planner.png`,
      fullPage: true,
    });
    expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
      "homematch-theme",
    ]);
    await page.goto("/welcome?palette=emerald");
    await expect(page.locator("html")).toHaveAttribute(
      "data-palette",
      "emerald",
    );
    await expect(page.locator('img[src="/homematch-logo-emerald.svg"]')).toBeVisible();
  });
}

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

test("signed-out landing photo, pathways, both themes and responsive layout", async ({
  page,
}, info) => {
  const calls = await fixture(page);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-palette", "red");
  await expect(
    page.getByRole("heading", { name: "HomeMatch", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  const image = page.getByRole("img", {
    name: "Singapore HDB apartment blocks surrounded by trees",
  });
  await expect(image).toBeVisible();
  await expect
    .poll(() =>
      image.evaluate(
        (el: HTMLImageElement) => el.complete && el.naturalWidth > 0,
      ),
    )
    .toBe(true);
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
  await page
    .getByRole("link", { name: "Find your next chapter", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "BTO", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Existing homes", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Private pricing awaits a verified URA import.", {
      exact: false,
    }),
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
  const start = page.getByRole("button", { name: "Find my area", exact: true });
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
    page.getByRole("heading", {
      name: "Make room for your life.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "HomeMatch", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
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
    .getByRole("button", { name: "Preview planner", exact: true })
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
  await expect(
    page.getByRole("heading", { name: "HomeMatch", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Preview planner", exact: true })
    .click();
  await expect(page.getByLabel("Profile name", { exact: true })).toHaveValue(
    "Unsaved public example",
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "HomeMatch", exact: true }),
  ).toBeVisible();
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
  await expect(
    page.getByRole("heading", { name: "HomeMatch", exact: true }),
  ).toBeVisible();
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
