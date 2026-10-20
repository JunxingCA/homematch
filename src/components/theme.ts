export type Theme = "light" | "dark";

/** Night in Singapore runs roughly 7pm to 7am; the site follows it until the visitor picks a theme. */
export function themeForHour(hour: number): Theme {
  return hour >= 19 || hour < 7 ? "dark" : "light";
}

/** An explicit choice (stored by the theme switch) wins; otherwise follow the local time of day. */
export function initialTheme(stored: string | null, now = new Date()): Theme {
  if (stored === "light" || stored === "dark") return stored;
  return themeForHour(now.getHours());
}

/** The mark drawn for the current surface: navy by day, light at night. */
export function logoFor(theme: string): string {
  return theme === "dark"
    ? "/homematch-logo-lights-night.svg"
    : "/homematch-logo-lights.svg";
}

/** Swap themes in one frame: colour transitions are paused so text never sits on a half-faded background. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.themeSwitching = "";
  root.dataset.theme = theme;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => delete root.dataset.themeSwitching),
  );
}
