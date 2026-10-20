import { expect, test } from "@playwright/test";
import { description, interpreted } from "../fixtures/interpretation";

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
const candidate = {
  id: "test-onemap",
  label: "NANYANG TECHNOLOGICAL UNIVERSITY",
  latitude: 1.3483,
  longitude: 103.6831,
  source: "onemap",
};
test("AI consent, unsupported requests, editable draft, explicit location choice and no implicit save", async ({
  page,
}, info) => {
  let calls = 0,
    profileWrites = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: "test-user" }, mode: "supabase" },
      });
    if (path === "/api/profiles") {
      if (route.request().method() !== "GET") profileWrites++;
      return route.fulfill({ json: { profiles: [] } });
    }
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/preferences/interpret") {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: { enabled: true, provider: "Gemini", model: "test" },
        });
      calls++;
      expect(route.request().postDataJSON()).toEqual({
        text: description,
        consent: true,
      });
      return route.fulfill({
        json: {
          interpretation: {
            draft: interpreted(),
            model: "test",
            locations: [{ query: "NTU", candidates: [candidate], error: null }],
          },
        },
      });
    }
    return route.abort();
  });
  await page.goto("/");
  const ai = page.getByRole("region", { name: "AI preference input" });
  await ai.getByLabel("Your description").fill(description);
  await expect(
    ai.getByRole("button", { name: "Interpret description" }),
  ).toBeDisabled();
  await ai.getByLabel(/I agree to send/).check();
  await ai.getByRole("button", { name: "Interpret description" }).click();
  await expect(ai.getByRole("heading", { name: "Draft review" })).toBeVisible();
  await expect(ai).toContainText("Not stated");
  await expect(ai).toContainText("proposed 1000 m radius");
  await expect(
    ai.getByRole("button", { name: "Apply draft to form" }),
  ).toBeDisabled();
  await ai.getByLabel(/I understand these requests/).check();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.screenshot({
    path: `test-results/ai-review-${info.project.name}-dark.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await page.screenshot({
    path: `test-results/ai-review-${info.project.name}-light.png`,
    fullPage: true,
  });
  await ai.getByRole("button", { name: "Apply draft to form" }).click();
  await expect(page.getByLabel("Maximum budget (SGD)")).toHaveValue("600000");
  await expect(page.getByLabel("Destination 1 location")).toHaveValue("NTU");
  await page
    .getByRole("button", { name: "Review preferences", exact: true })
    .click();
  await expect(
    page.getByText("Select a location match for every destination.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: candidate.label, exact: true })
    .click();
  await page.getByLabel("Maximum budget (SGD)").fill("610000");
  await page
    .getByRole("button", { name: "Review preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your profile, at a glance" }),
  ).toBeVisible();
  expect(calls).toBe(1);
  expect(profileWrites).toBe(0);
  expect(
    await page.evaluate(
      (input) =>
        Object.values(localStorage).some((value) => value.includes(input)),
      description,
    ),
  ).toBe(false);
});
test("quota failure preserves text and manual preferences", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: "test-user" }, mode: "supabase" },
      });
    if (path === "/api/profiles")
      return route.fulfill({ json: { profiles: [] } });
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/preferences/interpret")
      return route.request().method() === "GET"
        ? route.fulfill({ json: { enabled: true } })
        : route.fulfill({
            status: 429,
            json: {
              error: {
                code: "AI_QUOTA",
                message: "Gemini quota exhausted. Manual entry is available.",
              },
            },
          });
    return route.abort();
  });
  await page.goto("/");
  const ai = page.getByRole("region", { name: "AI preference input" });
  await page.getByLabel("Maximum budget (SGD)").fill("720000");
  await ai.getByLabel("Your description").fill(description);
  await ai.getByLabel(/I agree to send/).check();
  await ai.getByRole("button", { name: "Interpret description" }).click();
  await expect(ai.getByRole("alert")).toContainText("quota exhausted");
  await expect(ai.getByLabel("Your description")).toHaveValue(description);
  await expect(page.getByLabel("Maximum budget (SGD)")).toHaveValue("720000");
  await expect(ai.getByRole("heading", { name: "Draft review" })).toHaveCount(
    0,
  );
});
