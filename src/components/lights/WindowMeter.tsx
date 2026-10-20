import styles from "./WindowMeter.module.css";

/** Lifestyle fit shown as ten windows, `lit` of them glowing. Replaces percentage badges. */
export function WindowMeter({
  lit,
  total = 10,
  delayOffset = 0,
  compact = false,
}: {
  lit: number;
  total?: number;
  delayOffset?: number;
  /** Small windows for list rows and chips. */
  compact?: boolean;
}) {
  return (
    <span
      className={compact ? `${styles.meter} ${styles.compact}` : styles.meter}
      role="img"
      aria-label={`${lit} of ${total} windows lit`}
    >
      {Array.from({ length: total }, (_, k) => (
        <span
          key={k}
          className={k < lit ? styles.on : styles.off}
          style={{ animationDelay: `${(delayOffset + k * 0.06).toFixed(2)}s` }}
        />
      ))}
    </span>
  );
}
