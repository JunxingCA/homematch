import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import config from "../../next.config";

describe("Vercel deployment configuration", () => {
  it("redirects only known old hosts when the custom production origin is active", async () => {
    const previous = process.env.APP_ORIGIN;
    try {
      process.env.APP_ORIGIN = "http://127.0.0.1:4175";
      expect(await config.redirects!()).toEqual([]);
      process.env.APP_ORIGIN = "https://homematch.unify-x.com";
      const redirects = await config.redirects!();
      expect(redirects).toHaveLength(2);
      expect(redirects.map((r) => r.has?.[0].value)).toEqual([
        "homematch-sandy.vercel.app",
        "homematch-home-match1.vercel.app",
      ]);
      expect(
        redirects.every(
          (r) => r.destination === "https://homematch.unify-x.com/:path*",
        ),
      ).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.APP_ORIGIN;
      else process.env.APP_ORIGIN = previous;
    }
  });
  it("uses a single Singapore region, Fluid Compute and a lockfile install", async () => {
    const deployment = JSON.parse(
      await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
    );
    expect(deployment).toEqual({
      $schema: "https://openapi.vercel.sh/vercel.json",
      framework: "nextjs",
      fluid: true,
      regions: ["sin1"],
      installCommand: "npm ci",
      buildCommand: "npm run build",
      public: false,
    });
  });

  it("excludes secrets, local data and development artifacts from CLI uploads", async () => {
    const rules = (
      await readFile(new URL("../../.vercelignore", import.meta.url), "utf8")
    )
      .trim()
      .split(/\r?\n/);
    for (const rule of [
      ".env*",
      ".git/",
      ".vercel/",
      ".cache/",
      ".next/",
      "node_modules/",
      "coverage/",
      "test-results/",
      "playwright-report/",
      "tests/",
      "docs/",
      "scripts/",
      "supabase/",
      "ops/",
    ])
      expect(rules).toContain(rule);
    expect(rules.some((rule) => rule.startsWith("!"))).toBe(false);
    const gitignore = await readFile(
      new URL("../../.gitignore", import.meta.url),
      "utf8",
    );
    expect(gitignore.split(/\r?\n/)).toContain(".vercel/");
  });
});
