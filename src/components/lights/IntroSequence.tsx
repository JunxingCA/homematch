"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LogoMark } from "./Logo";
import { seeded } from "./rand";
import { playIntroScore, setSoundEnabled, stopIntroScore } from "./sound";
import styles from "./IntroSequence.module.css";

export const INTRO_SEEN_KEY = "homematch-intro-seen";
const INTRO_MS = 7300;
export const REPLAY_EVENT = "homematch:replay-intro";

type Phase = "pending" | "gate" | "intro" | "done";

const rand = seeded(7);
const BLOCKS = [
  [4, 9],
  [6, 14],
  [5, 11],
  [7, 17],
  [4, 8],
  [6, 13],
  [5, 10],
].map(([cols, rows]) => ({
  cols,
  windows: Array.from({ length: cols * rows }, () => ({
    lit: rand() > 0.32,
    delay: Number((0.5 + rand() * 2.4).toFixed(2)),
  })),
}));
const LIT_DELAYS = BLOCKS.flatMap((b) =>
  b.windows.filter((w) => w.lit).map((w) => w.delay),
);

/** Netflix-style launch: a gate (needed so the browser allows sound), then the city lighting up. */
export function IntroSequence() {
  const [phase, setPhase] = useState<Phase>("pending");
  const [sound, setSound] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const finish = useCallback(() => {
    window.clearTimeout(timer.current);
    stopIntroScore();
    setPhase("done");
  }, []);

  const start = useCallback((withSound: boolean) => {
    window.clearTimeout(timer.current);
    setSound(withSound);
    setSoundEnabled(withSound);
    try {
      window.sessionStorage.setItem(INTRO_SEEN_KEY, "1");
    } catch {
      /* storage unavailable: the intro may show again next visit */
    }
    setPhase("intro");
    if (withSound) playIntroScore(LIT_DELAYS);
    timer.current = window.setTimeout(() => setPhase("done"), INTRO_MS);
  }, []);

  useEffect(() => {
    let seen = false;
    try {
      seen = window.sessionStorage.getItem(INTRO_SEEN_KEY) === "1";
    } catch {
      /* treat as unseen */
    }
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    queueMicrotask(() => setPhase(seen || reduced ? "done" : "gate"));
    const replay = () => setPhase("gate");
    window.addEventListener(REPLAY_EVENT, replay);
    return () => {
      window.removeEventListener(REPLAY_EVENT, replay);
      window.clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    if (phase === "done") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  if (phase === "done") return null;
  if (phase === "pending")
    return <div className={styles.gate} aria-hidden="true" />;

  if (phase === "gate") {
    return (
      <div
        className={styles.gate}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to HomeMatch"
      >
        <svg width="70" height="78" viewBox="0 0 32 36" aria-hidden="true">
          <path
            d="M5 2h7a2 2 0 0 1 2 2v9h9a6 6 0 0 1 6 6v15h-8v-8a4 4 0 0 0-8 0v8H3V4a2 2 0 0 1 2-2z"
            fill="#1F2C47"
          />
          <rect x="6" y="6" width="5" height="4" rx="1" fill="#2A3754" />
          <rect x="6" y="13" width="5" height="4" rx="1" fill="#2A3754" />
          <rect
            className={styles.gateWindow}
            x="21"
            y="16"
            width="5"
            height="5"
            rx="1"
            fill="#3A4A6B"
          />
        </svg>
        <p className={styles.gateLine}>It’s getting dark in Singapore.</p>
        <button
          type="button"
          className={styles.enter}
          onClick={() => start(true)}
          autoFocus
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />
          </svg>
          Turn the lights on
        </button>
        <button
          type="button"
          className={styles.quiet}
          onClick={() => start(false)}
        >
          Enter without sound
        </button>
      </div>
    );
  }

  return (
    <div
      className={styles.intro}
      aria-label="HomeMatch intro"
      role="dialog"
      aria-modal="true"
    >
      <div className={styles.skyline} aria-hidden="true">
        {BLOCKS.map((b, i) => (
          <div
            key={i}
            className={styles.block}
            style={{ gridTemplateColumns: `repeat(${b.cols}, 14px)` }}
          >
            {b.windows.map((w, j) => (
              <span
                key={j}
                className={w.lit ? `${styles.win} ${styles.on}` : styles.win}
                style={{ animationDelay: `${w.delay}s` }}
              />
            ))}
          </div>
        ))}
      </div>
      <p className={styles.tagline}>Every lit window is somebody’s home.</p>
      <div className={styles.mark}>
        <div className={styles.lockup}>
          <span className={styles.markDrop}>
            <LogoMark
              size={86}
              tone="light"
              windowClassName={styles.markWindow}
            />
          </span>
          <span className={styles.word}>homematch</span>
        </div>
        <span className={`chip chip--dark ${styles.word}`}>
          <span className="dot" />
          Find the one that fits your life
        </span>
      </div>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.ibtn}
          aria-pressed={sound}
          onClick={() => {
            if (sound) stopIntroScore();
            setSound(!sound);
            setSoundEnabled(!sound);
          }}
        >
          {sound ? "Sound on" : "Sound off"}
        </button>
        <button type="button" className={styles.ibtn} onClick={finish}>
          Skip intro →
        </button>
      </div>
    </div>
  );
}

export function ReplayIntroButton() {
  return (
    <button
      type="button"
      className="btn btn--ghost btn--small"
      onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}
    >
      ↺ Intro
    </button>
  );
}
