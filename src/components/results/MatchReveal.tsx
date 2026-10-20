"use client";

import { useEffect } from "react";
import type { Discovery } from "@/domain/recommendations";
import { revealChime } from "../lights/sound";
import { areaWord, project, SINGAPORE_OUTLINE, town } from "./resultView";
import styles from "./MatchReveal.module.css";

export const REVEAL_SEEN_KEY = "homematch-reveal-seen";
const START = 1.2;
const STEP = 0.7;

/** Matches light up across the island, weakest first, the best fit last. Plays once a session. */
export function MatchReveal({
  discovery,
  onDone,
}: {
  discovery: Discovery;
  onDone: () => void;
}) {
  const top = discovery.results.slice(0, 3).toReversed();
  const delays = top.map((_, i) => START + i * STEP);
  const finish = START + top.length * STEP;

  useEffect(() => {
    revealChime(delays);
    const id = window.setTimeout(onDone, (finish + 2) * 1000);
    return () => window.clearTimeout(id);
    // The score plays once per reveal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lit = new Set(top.map((r) => r.area.id));
  const best = discovery.results[0];
  const count = discovery.results.length;
  const plural = areaWord(discovery, count !== 1);
  const scanned = count + discovery.excluded.length;

  return (
    <div
      className={styles.reveal}
      role="dialog"
      aria-modal="true"
      aria-label="Your matches are lighting up"
      onKeyDown={(e) => {
        if (e.key === "Escape") onDone();
      }}
    >
      <p className={styles.kicker}>
        Reading {scanned} {areaWord(discovery, scanned !== 1)} against your
        week…
      </p>
      <svg
        viewBox="0 0 400 240"
        className={styles.map}
        role="img"
        aria-label={`Map of Singapore. ${count} ${plural} match; ${town(best.area.name)} fits best.`}
      >
        <path d={SINGAPORE_OUTLINE} className={styles.land} />
        {discovery.results
          .filter((r) => !lit.has(r.area.id))
          .map((r) => {
            const [x, y] = project(r.area.latitude, r.area.longitude);
            return (
              <circle
                key={r.area.id}
                cx={x}
                cy={y}
                r="3"
                className={styles.dim}
              />
            );
          })}
        {top.map((r, i) => {
          const [x, y] = project(r.area.latitude, r.area.longitude);
          const isBest = r === best;
          const style = { animationDelay: `${delays[i]}s` };
          return (
            <g key={r.area.id}>
              {isBest && (
                <circle
                  cx={x}
                  cy={y}
                  r="7"
                  className={styles.ring}
                  style={style}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isBest ? 8 : 5.5}
                className={isBest ? styles.best : styles.pin}
                style={style}
              />
              <text
                x={x}
                y={isBest ? y + 26 : y - 12}
                textAnchor="middle"
                className={styles.label}
                style={{ ...style, fontSize: isBest ? 14 : 11 }}
              >
                {town(r.area.name)}
                {isBest ? " · best fit" : ""}
              </text>
            </g>
          );
        })}
      </svg>
      <p className={styles.line} style={{ animationDelay: `${finish}s` }}>
        {count} {plural} fit your week.
      </p>
      <button type="button" className={styles.skip} onClick={onDone} autoFocus>
        Skip
      </button>
    </div>
  );
}
