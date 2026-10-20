import styles from "./FacadeMarker.module.css";

/**
 * Question marker used instead of numbers: a tiny 2×3 facade where earlier questions are lit
 * amber and the current one glows coral. Also used as the progress meter (`mode="progress"`).
 */
export function FacadeMarker({
  index,
  done,
  total = 6,
}: {
  index?: number;
  done?: boolean[];
  total?: number;
}) {
  return (
    <span className={styles.facade} aria-hidden="true">
      {Array.from({ length: total }, (_, i) => {
        let bg = "#FFFFFF";
        if (done) bg = done[i] ? "var(--amber)" : "#7E9C8B";
        else if (index !== undefined)
          bg =
            i === index
              ? "var(--coral)"
              : i < index
                ? "var(--amber)"
                : "#FFFFFF";
        return <span key={i} style={{ background: bg }} />;
      })}
    </span>
  );
}
