import type { AreaResult } from "@/domain/recommendations";
import {
  leader,
  litWindows,
  SCORE_TILES,
  scoreFor,
  town,
  verdict,
} from "./resultView";
import styles from "./CompareBlocks.module.css";

/** Each compared area as a three-floor block: the taller the floor, the stronger that score. */
export function CompareBlocks({ results }: { results: AreaResult[] }) {
  const leaders = Object.fromEntries(
    SCORE_TILES.map((t) => [t.key, leader(results, (r) => scoreFor(r, t.key))]),
  );
  const summary = verdict(results);
  return (
    <div className={styles.wrap}>
      <h2 className="h-page">Side by side, block by block.</h2>
      <div className={styles.sides}>
        {results.map((r) => (
          <section
            key={r.area.id}
            className={styles.side}
            aria-label={`${town(r.area.name)} block`}
          >
            <div className={styles.titleRow}>
              <h3>{town(r.area.name)}</h3>
              <span className="chip chip--soft">
                <span className="dot" />
                {litWindows(r.overall)} of 10 lit
              </span>
            </div>
            <div className={styles.stage}>
              <div className={styles.building}>
                {SCORE_TILES.map((t) => {
                  const v = scoreFor(r, t.key);
                  const lit = v === null ? 0 : Math.round((v / 100) * 6);
                  return (
                    <div
                      key={t.key}
                      className={styles.floor}
                      style={{
                        height: 34 + (v ?? 0) * 0.7,
                        background: t.tint,
                      }}
                    >
                      <span className={styles.windows} aria-hidden="true">
                        {Array.from({ length: 6 }, (_, k) => (
                          <span key={k} data-lit={k < lit} />
                        ))}
                      </span>
                      <span className={styles.floorLabel}>
                        {t.label} · {v === null ? "not scored" : v.toFixed(1)}
                      </span>
                      {leaders[t.key] === r.area.id && (
                        <span className={styles.wins}>Leads</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
      {summary && (
        <p className={styles.verdict}>
          <span className={styles.verdictWin} aria-hidden="true" />
          {summary}
        </p>
      )}
    </div>
  );
}
