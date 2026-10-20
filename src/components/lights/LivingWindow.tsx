"use client";

import { useRef, type CSSProperties } from "react";
import { seeded } from "./rand";
import styles from "./LivingWindow.module.css";

const r = seeded(42);
const MAIN_WINDOWS = Array.from({ length: 40 }, (_, i) => ({
  mine: i === 17,
  lit: r() > 0.3,
  delay: -(r() * 2.5),
}));
const SIDE_WINDOWS = Array.from({ length: 18 }, () => ({
  lit: r() > 0.35,
  delay: -(r() * 2.5),
}));
const STARS = Array.from({ length: 16 }, () => ({
  x: r() * 96,
  y: r() * 38,
  big: r() > 0.7,
}));
const FAR = Array.from({ length: 18 }, () => ({
  w: 26 + Math.round(r() * 30),
  h: 90 + Math.round(r() * 150),
}));

const depth = (k: number) => ({ "--k": k }) as CSSProperties;

/**
 * The hero "window": a 24-second day-to-night loop over an HDB estate, with drifting clouds,
 * a passing MRT and parallax layers that follow the pointer. Pointer position is written to
 * CSS variables, so moving the mouse never re-renders React.
 */
export function LivingWindow() {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const b = el.getBoundingClientRect();
    el.style.setProperty(
      "--mx",
      (((e.clientX - b.left) / b.width - 0.5) * 2).toFixed(3),
    );
    el.style.setProperty(
      "--my",
      (((e.clientY - b.top) / b.height - 0.5) * 2).toFixed(3),
    );
  };
  const leave = () => {
    ref.current?.style.setProperty("--mx", "0");
    ref.current?.style.setProperty("--my", "0");
  };

  return (
    <div
      ref={ref}
      className={styles.window}
      onPointerMove={move}
      onPointerLeave={leave}
      role="img"
      aria-label="An HDB estate going from day to night, with your matching window glowing"
    >
      <div className={styles.sky} />
      <div className={styles.layer} style={depth(0.15)}>
        <div className={styles.sun} />
        <div className={`${styles.night} ${styles.moon}`} />
        <div className={styles.night}>
          {STARS.map((s, i) => (
            <span
              key={i}
              className={styles.star}
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.big ? 3 : 2,
                height: s.big ? 3 : 2,
              }}
            />
          ))}
        </div>
      </div>
      <div className={styles.layer} style={depth(0.3)}>
        <span
          className={styles.cloud}
          style={{ top: 120, width: 140, animationDelay: "-6s, 0s" }}
        />
        <span
          className={styles.cloud}
          style={{
            top: 170,
            width: 90,
            animationDelay: "-24s, 0s",
            animationDuration: "58s, 24s",
          }}
        />
        <span
          className={styles.cloud}
          style={{
            top: 84,
            width: 110,
            animationDelay: "-38s, 0s",
            animationDuration: "52s, 24s",
          }}
        />
      </div>
      <div className={styles.layer} style={depth(0.5)}>
        <div className={styles.farRow}>
          {FAR.map((f, i) => (
            <span
              key={i}
              className={styles.far}
              style={{ width: f.w, height: f.h }}
            />
          ))}
        </div>
      </div>
      <div className={styles.layer} style={depth(0.8)}>
        <div className={styles.estate}>
          <div className={styles.facade}>
            {MAIN_WINDOWS.map((w, i) => (
              <span
                key={i}
                className={
                  w.mine
                    ? `${styles.hw} ${styles.mine}`
                    : w.lit
                      ? `${styles.hw} ${styles.nightLit}`
                      : styles.hw
                }
                style={{ animationDelay: `${w.delay.toFixed(2)}s` }}
              />
            ))}
            <span className={styles.yours}>← your match</span>
          </div>
          <div className={styles.facade2}>
            {SIDE_WINDOWS.map((w, i) => (
              <span
                key={i}
                className={
                  w.lit ? `${styles.sw} ${styles.nightLit}` : styles.sw
                }
                style={{ animationDelay: `${w.delay.toFixed(2)}s` }}
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.layer} style={depth(1.1)}>
        <div className={styles.viaduct}>
          <div className={styles.train}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
          <div className={styles.track} />
        </div>
        <div className={styles.pillars}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
      <div className={styles.layer} style={depth(1.6)}>
        <svg
          className={styles.treeLeft}
          width="150"
          height="150"
          viewBox="0 0 150 150"
          aria-hidden="true"
        >
          <circle cx="50" cy="70" r="44" fill="#2F5A44" />
          <circle cx="96" cy="88" r="34" fill="#3E7556" />
          <rect x="46" y="100" width="8" height="50" fill="#22382B" />
        </svg>
        <svg
          className={styles.treeRight}
          width="130"
          height="140"
          viewBox="0 0 130 140"
          aria-hidden="true"
        >
          <circle cx="70" cy="62" r="46" fill="#2F5A44" />
          <circle cx="34" cy="86" r="28" fill="#3E7556" />
          <rect x="66" y="96" width="8" height="44" fill="#22382B" />
        </svg>
      </div>
    </div>
  );
}
