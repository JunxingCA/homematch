import { expect, test } from "@playwright/test";

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
const token = "c".repeat(64);
test("auth callbacks and the reset page suppress referrers and caching in the actual server", async ({
  request,
}) => {
  for (const path of [
    "/auth/recovery",
    "/auth/confirm",
    "/auth/callback",
    "/reset-password",
  ]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.headers()["referrer-policy"]).toBe("no-referrer");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(response.status()).toBe(path === "/reset-password" ? 200 : 307);
  }
});
test("forgot password preserves manual preferences and supports email failure/retry", async ({
  page,
}) => {
  let count = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        status: 401,
        json: { error: { code: "SIGN_IN_REQUIRED", message: "Sign in" } },
      });
    if (path === "/api/auth/recover") {
      expect(route.request().postDataJSON()).toEqual({
        email: "demo@example.com",
      });
      return ++count === 1
        ? route.fulfill({
            status: 503,
            json: {
              error: {
                code: "RECOVERY_EMAIL_FAILED",
                message:
                  "Recovery instructions could not be sent. Please retry later.",
              },
            },
          })
        : route.fulfill({
            json: {
              message:
                "If an account uses this email, recovery instructions will be sent.",
            },
          });
    }
    return route.abort();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Preview planner without an account" })
    .click();
  await page.getByLabel("Maximum budget (SGD)").fill("720000");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByRole("button", { name: "Forgot password?" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Password", { exact: true })).toHaveCount(0);
  await dialog.getByLabel("Email").fill("demo@example.com");
  await dialog.getByRole("button", { name: "Send recovery email" }).click();
  await expect(dialog.getByRole("alert")).toContainText("could not be sent");
  await expect(dialog.getByLabel("Email")).toHaveValue("demo@example.com");
  await dialog.getByRole("button", { name: "Send recovery email" }).click();
  await expect(dialog.getByRole("alert")).toContainText("If an account");
  await dialog.getByRole("button", { name: "Back to sign in" }).click();
  await expect(dialog.getByLabel("Password", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Maximum budget (SGD)")).toHaveValue("720000");
});
test("recovery proof is HTTP-only, passwords are reviewed, success requires a fresh sign-in", async ({
  page,
  context,
}, info) => {
  let resetCalls = 0;
  await page.route("**/api/auth/reset-password", async (route) => {
    resetCalls++;
    expect(route.request().postDataJSON()).toEqual({
      password: "A long test password!",
      confirmation: "A long test password!",
    });
    return route.fulfill({
      json: {
        message:
          "Your password was reset. Sign in again with your new password.",
      },
    });
  });
  await page.goto(`/auth/recovery?token_hash=${token}&next=https://evil.test`);
  await expect(page).toHaveURL(/\/reset-password$/);
  expect(
    (await context.cookies()).find(
      (cookie) => cookie.name === "homematch-recovery",
    )?.httpOnly,
  ).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain(token);
  await page.getByLabel("New password", { exact: true }).fill("short");
  await page.getByLabel("Confirm new password").fill("short");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(
    page.getByText("Use at least 12 characters.", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("New password", { exact: true })
    .fill("A long test password!");
  await page.getByLabel("Confirm new password").fill("not matching");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByText("The passwords must match.")).toBeVisible();
  expect(resetCalls).toBe(0);
  await page.getByLabel("Confirm new password").fill("A long test password!");
  await page.screenshot({
    path: `test-results/password-reset-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/password-reset-${info.project.name}-light.png`,
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Sign in again");
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  expect(resetCalls).toBe(1);
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([
    "homematch-theme",
  ]);
});
test("expired link and missing link lead to requesting a new email", async ({
  page,
}) => {
  await page.route("**/api/auth/reset-password", (route) =>
    route.fulfill({
      status: 410,
      json: {
        error: {
          code: "RECOVERY_LINK_INVALID",
          message:
            "This recovery link expired or was already used. Request a new link.",
        },
      },
    }),
  );
  await page.goto("/reset-password");
  await expect(
    page.getByRole("heading", { name: "Request a new link" }),
  ).toBeVisible();
  await page.goto(`/auth/recovery?token_hash=${token}`);
  await page
    .getByLabel("New password", { exact: true })
    .fill("A long test password!");
  await page.getByLabel("Confirm new password").fill("A long test password!");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "expired or was already used",
  );
  await expect(
    page.getByRole("link", { name: "Request recovery email" }),
  ).toBeVisible();
});
