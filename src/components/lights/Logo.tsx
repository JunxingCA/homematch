import styles from "./Logo.module.css";

/**
 * The HomeMatch mark: a lowercase "h" built from two HDB blocks. The counter of the h is a
 * doorway, and the single amber window on the lower block is "your match".
 */
export function LogoMark({
  size = 28,
  tone = "theme",
  windowClassName,
}: {
  size?: number;
  tone?: "theme" | "light";
  windowClassName?: string;
}) {
  const body = tone === "light" ? "#EEF1EA" : "var(--ink)";
  const win = tone === "light" ? "#9AA6BC" : "var(--logo-win)";
  return (
    <svg
      width={size}
      height={(size * 36) / 32}
      viewBox="0 0 32 36"
      aria-hidden="true"
      className={styles.mark}
    >
      <path
        d="M5 2h7a2 2 0 0 1 2 2v9h9a6 6 0 0 1 6 6v15h-8v-8a4 4 0 0 0-8 0v8H3V4a2 2 0 0 1 2-2z"
        style={{ fill: body }}
      />
      <rect x="6" y="6" width="5" height="4" rx="1" style={{ fill: win }} />
      <rect x="6" y="13" width="5" height="4" rx="1" style={{ fill: win }} />
      <rect
        x="21"
        y="16"
        width="5"
        height="5"
        rx="1"
        fill="#FFB547"
        className={windowClassName}
      />
    </svg>
  );
}

/** Mark and wordmark. Rendered inside the caller's link or button. */
export function Wordmark({ tone = "theme" }: { tone?: "theme" | "light" }) {
  return (
    <span className={styles.logo} data-tone={tone}>
      <LogoMark tone={tone} />
      <span className={styles.word}>homematch</span>
    </span>
  );
}
