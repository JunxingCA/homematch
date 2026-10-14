import { test, expect } from "@playwright/test";

test("manual edit, resolved location, review, and honest preview confirmation", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Make room for your life." }),
  ).toBeVisible();
  await expect(
    page.getByText("Preview only. Sample locations", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Profile name", { exact: true }).fill("Our first home");
  await page.getByLabel("Destination 1 location").fill("Bishan");
  await page
    .getByRole("button", { name: "Search destination 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Bishan MRT", exact: true }).click();
  await page
    .getByRole("button", { name: "Review preferences", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "A little more you." }),
  ).toBeVisible();
  await expect(
    page.getByText("Bishan MRT · 5 visits/week", { exact: false }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("review-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Confirm preview", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Preview reviewed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "This is a reviewed sample, not a stored profile or a recommendation.",
    ),
  ).toBeVisible();
});

test("unresolved places block confirmation; bad weights show validation", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Destination 1 location").fill("Unresolved place");
  await page
    .getByRole("button", { name: "Review preferences", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Select a location match",
  );
  await page.getByLabel("Your journeys", { exact: true }).focus();
  await page.keyboard.press("ArrowLeft");
  await page
    .getByRole("button", { name: "Review preferences", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "add up to 100%",
  );
});

test("light/dark layout, persistence, housing pathways and sign-in disclosure", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.locator('[data-ready="true"]')).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("preferences-dark.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Switch to light mode", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({
    path: testInfo.outputPath("preferences-light.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "BTO", exact: true }).click();
  await expect(page.getByLabel("Property type", { exact: true })).toHaveValue(
    "BTO",
  );
  await expect(
    page.getByText("Historical resale evidence is neighborhood context", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "not connected in this preview",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("preview cannot write profiles and API rejects cross-origin writes", async ({
  request,
}) => {
  const denied = await request.post("/api/profiles", {
    headers: { Origin: "https://malicious.example" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  const preview = await request.post("/api/profiles", {
    headers: { Origin: "http://127.0.0.1:4317" },
    data: {},
  });
  expect(preview.status()).toBe(503);
  expect((await preview.json()).error.code).toBe("PREVIEW_ONLY");
  const saveArea = await request.post("/api/shortlist", {
    headers: { Origin: "https://malicious.example" },
    data: {},
  });
  expect(saveArea.status()).toBe(403);
  const removeArea = await request.delete(
    "/api/shortlist/11111111-1111-4111-8111-111111111111",
    { headers: { Origin: "https://malicious.example" } },
  );
  expect(removeArea.status()).toBe(403);
  const shortlist = await request.get("/api/shortlist");
  expect(shortlist.status()).toBe(503);
  expect((await shortlist.json()).error.code).toBe("PREVIEW_ONLY");
  const ai = await request.post("/api/preferences/interpret", {
    headers: { Origin: "https://malicious.example" },
    data: { text: "A sample resale home", consent: true },
  });
  expect(ai.status()).toBe(403);
  const aiStatus = await request.get("/api/preferences/interpret");
  expect(aiStatus.status()).toBe(503);
  expect((await aiStatus.json()).error.code).toBe("PREVIEW_ONLY");
});
