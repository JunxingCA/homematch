import { expect, test, type Page, type Route } from "@playwright/test";
import axe from "axe-core";
import { writeFile } from "node:fs/promises";
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

declare global {
  interface Window {
    axe: typeof axe;
  }
}

async function workspace(page: Page, respond: (route: Route) => Promise<void>) {
  const calls = { interpretations: 0, profileWrites: 0 };
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({
        json: { user: { id: "synthetic-user" }, mode: "supabase" },
      });
    if (path === "/api/profiles") {
      if (route.request().method() !== "GET") calls.profileWrites++;
      return route.fulfill({ json: { profiles: [] } });
    }
    if (path === "/api/discoveries")
      return route.fulfill({ json: { discoveries: [] } });
    if (path === "/api/shortlist")
      return route.fulfill({ json: { savedAreas: [] } });
    if (path === "/api/auth/activity")
      return route.fulfill({ json: { active: true } });
    if (path === "/api/preferences/interpret") {
      if (route.request().method() === "GET")
        return route.fulfill({
          json: { enabled: true, provider: "Gemini", model: "synthetic" },
        });
      calls.interpretations++;
      return respond(route);
    }
    return route.abort();
  });
  await page.goto("/");
  const ai = page.getByRole("region", { name: "AI preference input" });
  await ai.getByLabel("Your description").fill(description);
  return { ai, calls };
}

test("AI keyboard journey and WCAG checks cover form and draft in both themes", async ({
  page,
}, info) => {
  const { ai, calls } = await workspace(page, (route) =>
    route.fulfill({
      json: {
        interpretation: {
          draft: interpreted(),
          model: "synthetic",
          locations: [],
        },
      },
    }),
  );
  await page.addScriptTag({ content: axe.source });
  const scan = async (state: string) => {
    const result = await page.evaluate(async () =>
      window.axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      }),
    );
    const report = JSON.stringify(
      { violations: result.violations, incomplete: result.incomplete },
      null,
      2,
    );
    await writeFile(info.outputPath(`accessibility-${state}.json`), report);
    await info.attach(`accessibility-${state}`, {
      body: report,
      contentType: "application/json",
    });
    expect(
      result.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      result.incomplete
        .filter((v) => ["serious", "critical"].includes(v.impact ?? ""))
        .map((v) => v.id),
    ).toEqual([]);
  };
  await scan("form-dark");
  await ai.getByLabel("Your description").focus();
  await page.keyboard.press("Tab");
  await expect(ai.getByLabel(/I agree to send/)).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Tab");
  await expect(
    ai.getByRole("button", { name: "Interpret description" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(ai.getByRole("heading", { name: "Draft review" })).toBeVisible();
  await scan("draft-dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await scan("draft-light");
  await ai.getByRole("button", { name: "Discard AI draft" }).click();
  await scan("form-light");
  expect(calls.profileWrites).toBe(0);
});

test("pending AI requests cannot double-submit or replace manual form values", async ({
  page,
}) => {
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const { ai, calls } = await workspace(page, async (route) => {
    await waiting;
    await route.fulfill({
      status: 503,
      json: {
        error: {
          code: "AI_UNAVAILABLE",
          message: "Temporary interpretation failure. Please retry.",
        },
      },
    });
  });
  await page.getByLabel("Maximum budget (SGD)").fill("720000");
  await ai.getByLabel(/I agree to send/).check();
  await ai.getByRole("button", { name: "Interpret description" }).click();
  await expect(ai.getByRole("button", { name: "Interpreting" })).toBeDisabled();
  await expect(ai.getByLabel("Your description")).toBeDisabled();
  await expect(ai.getByLabel(/I agree to send/)).toBeDisabled();
  expect(calls.interpretations).toBe(1);
  release();
  await expect(ai.getByRole("alert")).toContainText(
    "Temporary interpretation failure",
  );
  await expect(ai.getByLabel("Your description")).toHaveValue(description);
  await expect(page.getByLabel("Maximum budget (SGD)")).toHaveValue("720000");
  await expect(
    ai.getByRole("button", { name: "Interpret description" }),
  ).toBeEnabled();
  expect(calls.profileWrites).toBe(0);
});

test("session expiry during interpretation opens sign-in and never exposes an applicable draft", async ({
  page,
}) => {
  const { ai, calls } = await workspace(page, (route) =>
    route.fulfill({
      status: 401,
      json: {
        error: {
          code: "SESSION_EXPIRED",
          message: "Sign in again to continue.",
        },
      },
    }),
  );
  await ai.getByLabel(/I agree to send/).check();
  await ai.getByRole("button", { name: "Interpret description" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Apply draft to form" }),
  ).toHaveCount(0);
  expect(calls.profileWrites).toBe(0);
});
