import { expect, test, type Page } from "@playwright/test";
import { samplePreference } from "../../src/domain/fixtures";

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
const owner = "11111111-1111-4111-8111-111111111111";
async function fixture(
  page: Page,
  outcome: "success" | "reauth" | "failure" = "success",
  userId = owner,
) {
  const calls = { deletes: 0, signOuts: 0 };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: {
          user: { id: userId, email: "account-test@example.test" },
          mode: "supabase",
        },
      });
    if (path === "/api/profiles")
      return route.fulfill({
        json: {
          profiles: [
            {
              id: "fixture-profile",
              revision: 1,
              confirmed: true,
              updatedAt: new Date().toISOString(),
              preference: {
                ...samplePreference,
                name: "Private fixture research",
              },
            },
          ],
        },
      });
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/preferences/interpret")
      return route.fulfill({ json: { enabled: false } });
    if (path === "/api/auth/sign-out") {
      calls.signOuts++;
      return route.fulfill({ json: { signedOut: true } });
    }
    if (path === "/api/account") {
      calls.deletes++;
      expect(route.request().method()).toBe("DELETE");
      expect(route.request().postDataJSON()).toEqual({
        confirmation: "DELETE",
      });
      if (outcome === "success")
        return route.fulfill({ json: { deleted: true } });
      return route.fulfill({
        status: outcome === "reauth" ? 409 : 503,
        json: {
          error: {
            code:
              outcome === "reauth"
                ? "ACCOUNT_REAUTH_REQUIRED"
                : "ACCOUNT_DELETE_UNCONFIRMED",
            message:
              outcome === "reauth"
                ? "Sign in again before deleting your account, then confirm deletion again."
                : "Account deletion could not be confirmed. Sign in to check before retrying.",
            retryable: false,
          },
        },
      });
    }
    return route.abort();
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
  // The workspace tab counts saved profiles; deletion must clear them from view.
  await expect(
    page.getByRole("button", { name: "My profiles 1/4", exact: true }),
  ).toBeVisible();
  return calls;
}
async function openDelete(page: Page) {
  await page
    .getByRole("button", { name: "Account settings", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  return dialog;
}
test("confirmation, cancellation, focus and light/dark responsive account settings", async ({
  page,
}, info) => {
  const calls = await fixture(page);
  let dialog = await openDelete(page);
  await expect(
    dialog.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Type DELETE to confirm").fill("delete");
  await expect(
    dialog.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `test-results/account-${info.project.name}-dark.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
  }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Your account", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  dialog = await openDelete(page);
  await page.screenshot({
    path: `test-results/account-${info.project.name}-light.png`,
    fullPage: true,
  });
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog.getByLabel("Type DELETE to confirm").press("Enter");
  await expect(
    page.getByRole("status").filter({ hasText: "have been deleted" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "My profiles 1/4", exact: true }),
  ).toHaveCount(0);
  expect(calls.deletes).toBe(1);
});
test("stale proof requires explicit sign-in and never auto-retries deletion", async ({
  page,
}) => {
  const calls = await fixture(page, "reauth");
  const dialog = await openDelete(page);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("Sign in again");
  await expect(
    dialog.getByRole("button", { name: "Delete account", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Sign in again", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "then reopen Account settings and confirm deletion",
  );
  expect(calls.deletes).toBe(1);
  expect(calls.signOuts).toBe(1);
});
test("unconfirmed deletion clears visible private data without claiming success", async ({
  page,
}) => {
  const calls = await fixture(page, "failure");
  const dialog = await openDelete(page);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not be confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "My profiles 1/4", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Account settings", exact: true }),
  ).toHaveCount(0);
  expect(calls.deletes).toBe(1);
});
test("pending deletion blocks duplicate submission and dismissal", async ({
  page,
}) => {
  await fixture(page);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/account", async (route) => {
    calls++;
    await waiting;
    await route.fulfill({ json: { deleted: true } });
  });
  const dialog = await openDelete(page);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Deleting...", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Close account settings", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(calls).toBe(1);
  release();
  await expect(
    page.getByRole("status").filter({ hasText: "have been deleted" }),
  ).toBeVisible();
});
test("confirmed deletion clears another tab for the same owner, not another owner", async ({
  page,
  context,
}) => {
  await fixture(page);
  const same = await context.newPage();
  const other = await context.newPage();
  await fixture(same);
  await fixture(other, "success", "22222222-2222-4222-8222-222222222222");
  const dialog = await openDelete(page);
  await dialog.getByLabel("Type DELETE to confirm").fill("DELETE");
  await dialog
    .getByRole("button", { name: "Delete account", exact: true })
    .click();
  await expect(
    same.getByRole("status").filter({ hasText: "deleted in another tab" }),
  ).toBeVisible();
  await expect(
    same.getByRole("button", { name: "Account settings", exact: true }),
  ).toHaveCount(0);
  await expect(
    other.getByRole("button", { name: "Account settings", exact: true }),
  ).toBeVisible();
  await same.close();
  await other.close();
});
