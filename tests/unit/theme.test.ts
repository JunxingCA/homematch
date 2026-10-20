import { describe, expect, it } from "vitest";
import { initialTheme, logoFor, themeForHour } from "@/components/theme";

describe("time-of-day theme", () => {
  it("is night from 7pm to before 7am and day otherwise", () => {
    expect(themeForHour(6)).toBe("dark");
    expect(themeForHour(7)).toBe("light");
    expect(themeForHour(18)).toBe("light");
    expect(themeForHour(19)).toBe("dark");
    expect(themeForHour(0)).toBe("dark");
  });

  it("keeps an explicit choice and ignores unknown stored values", () => {
    const noon = new Date(2026, 9, 20, 12);
    const night = new Date(2026, 9, 20, 22);
    expect(initialTheme("dark", noon)).toBe("dark");
    expect(initialTheme("light", night)).toBe("light");
    expect(initialTheme(null, noon)).toBe("light");
    expect(initialTheme("sepia", night)).toBe("dark");
  });

  it("uses the night logo on dark surfaces", () => {
    expect(logoFor("dark")).toBe("/homematch-logo-lights-night.svg");
    expect(logoFor("light")).toBe("/homematch-logo-lights.svg");
  });
});
