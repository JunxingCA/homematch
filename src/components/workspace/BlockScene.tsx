import type { Preference } from "@/domain/preferences";
import { amenityPresentation } from "../amenityPresentation";
import { seeded } from "../lights/rand";
import { BUDGET_SCALE, priorityLevel, radiusLabel } from "./preferenceText";
import styles from "./BlockScene.module.css";

const ROWS = 10;
const COLS = 5;
const r = seeded(11);
const WINDOW_TONES = Array.from({ length: ROWS * COLS }, () =>
  r() > 0.5 ? "#FFD08A" : "#7E9C8B",
);

/**
 * Live picture of the profile: a higher budget lights a higher floor, weekly
 * places hang beside the block, chosen amenities appear on the ground, and a
 * train runs when any trip is by public transport.
 */
export function BlockScene({ preference }: { preference: Preference }) {
  const landed = preference.category === "Private / landed";
  const scale = BUDGET_SCALE[preference.category];
  const share = Math.min(
    1,
    Math.max(0, (preference.budgetMax - scale.min) / (scale.max - scale.min)),
  );
  const floorIdx = Math.min(ROWS - 1, Math.floor(share * ROWS));
  const myRow = ROWS - 1 - floorIdx;
  const houseWindow = Math.min(4, Math.floor(share * 5));
  const level = String((floorIdx + 1) * 3 + 2).padStart(2, "0");
  const trips = preference.destinations.filter(
    (d) => d.location || d.query.trim(),
  );
  const showTrain = preference.destinations.some((d) => d.mode === "public");
  const showPark = preference.lifestyles.some(
    (l) => l.category === "Parks" || l.category === "Running tracks",
  );

  return (
    <div
      className={`${styles.scene} ${landed ? styles.landedScene : ""}`}
      role="img"
      aria-label={`${landed ? "Your landed home" : `Your block: level ${level}`}, ${preference.lifestyles.length} amenities within reach, ${trips.length} weekly places`}
    >
      <div className={styles.topChips}>
        <span className="chip chip--dark">
          <span className="dot" />
          {landed ? "Your home" : `Level ${level}`}
        </span>
        <span className="chip chip--dark">
          <span className="dot" style={{ background: "var(--mint)" }} />
          {preference.category}
        </span>
      </div>
      <div className={styles.sun} />

      {landed ? (
        <div className={styles.house} aria-hidden="true">
          <div className={styles.chimney} />
          <div className={styles.roof} />
          <div className={styles.houseWall}>
            <div className={styles.houseWindows}>
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={i === houseWindow ? styles.mine : undefined}
                  style={{
                    background:
                      i === houseWindow ? "var(--coral)" : WINDOW_TONES[i],
                  }}
                />
              ))}
            </div>
            <div className={styles.frontDoor}>
              <span />
            </div>
          </div>
          <div className={styles.doorstep} />
          <div className={styles.hedge} />
          <div className={styles.gardenPath} />
        </div>
      ) : (
        <div className={styles.block}>
          {WINDOW_TONES.map((tone, i) => {
            const mine = Math.floor(i / COLS) === myRow && i % COLS === 2;
            return (
              <span
                key={i}
                className={mine ? styles.mine : undefined}
                style={{ background: mine ? "var(--coral)" : tone }}
              />
            );
          })}
        </div>
      )}

      <div className={styles.trips}>
        {trips.map((d, i) => (
          <span
            key={i}
            className={`chip chip--dark ${styles.pop}`}
            style={{ fontSize: 12, padding: "5px 10px 5px 7px" }}
          >
            <span className="dot" style={{ background: "var(--coral)" }} />
            <span className={styles.tripLabel}>
              {(d.location?.label ?? d.query).split(",")[0]}
            </span>
            · {d.visits}×
          </span>
        ))}
      </div>

      {showPark && (
        <div className={`${styles.trees} ${styles.pop}`} aria-hidden="true">
          <svg width="30" height="52" viewBox="0 0 30 52">
            <circle cx="15" cy="16" r="14" fill="#5FA77A" />
            <rect x="13" y="26" width="4" height="26" fill="#6B4E2E" />
          </svg>
          <svg width="22" height="38" viewBox="0 0 22 38">
            <circle cx="11" cy="11" r="10" fill="#8FB8A0" />
            <rect x="9" y="18" width="4" height="20" fill="#6B4E2E" />
          </svg>
        </div>
      )}

      <div className={styles.rail}>
        <div className={styles.railLine} />
        {showTrain && (
          <div className={styles.train}>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>

      <div className={styles.ground}>
        {preference.lifestyles.map((l) => {
          const Icon = amenityPresentation[l.category].icon;
          const must = priorityLevel(l.priority) === "must";
          return (
            <span
              key={l.category}
              className={`${styles.amenity} ${styles.pop}`}
              style={{ background: must ? "var(--amber)" : "var(--mint)" }}
            >
              <Icon aria-hidden="true" />
              <b>{amenityPresentation[l.category].label}</b>
              <i>{radiusLabel(l.radius)}</i>
            </span>
          );
        })}
      </div>
    </div>
  );
}
