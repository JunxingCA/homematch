"use client";

import { useEffect, useState, type ReactNode } from "react";
import { seeded } from "../lights/rand";
import styles from "./States.module.css";

const random = seeded(3);
const WAVE_DELAYS = Array.from({ length: 36 }, () =>
  (random() * 2.8).toFixed(2),
);

type Frame = "page" | "panel";

function Stage({
  frame,
  role,
  label,
  children,
}: {
  frame: Frame;
  role?: "status" | "alert";
  label?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={frame === "page" ? styles.stage : styles.panel}
      role={role}
      aria-label={label}
      aria-live={role === "status" ? "polite" : undefined}
    >
      <div className={styles.stack}>{children}</div>
    </div>
  );
}

/** Windows light up in a wave while a status line steps through the work being done. */
export function LoadingState({
  title,
  messages,
  frame = "panel",
}: {
  title: string;
  messages: string[];
  frame?: Frame;
}) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const id = window.setInterval(
      () => setStep((s) => Math.min(s + 1, messages.length - 1)),
      2200,
    );
    return () => window.clearInterval(id);
  }, [messages.length]);
  return (
    <Stage frame={frame} role="status">
      <div
        className={styles.block}
        style={{ gridTemplateColumns: "repeat(6, 18px)" }}
        aria-hidden="true"
      >
        {WAVE_DELAYS.map((d, i) => (
          <span
            key={i}
            className={`${styles.unlit} ${styles.wave}`}
            style={{ width: 18, height: 22, animationDelay: `${d}s` }}
          />
        ))}
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p key={step} className={styles.message}>
        {messages[step]}
      </p>
    </Stage>
  );
}

/** Something failed: one window flickers; the copy says what is safe and what to do. */
export function ErrorState({
  title,
  body,
  frame = "panel",
  heading = "h2",
  children,
}: {
  title: string;
  body: ReactNode;
  frame?: Frame;
  heading?: "h1" | "h2";
  children?: ReactNode;
}) {
  const Heading = heading;
  return (
    <Stage frame={frame} role="alert">
      <div
        className={styles.block}
        style={{
          gridTemplateColumns: "repeat(3, 26px)",
          padding: "22px 20px 28px",
          gap: 14,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: 9 }, (_, i) => (
          <span
            key={i}
            className={i === 4 ? styles.flicker : styles.unlit}
            style={{ width: 26, height: 30 }}
          />
        ))}
      </div>
      <Heading className={styles.title}>{title}</Heading>
      <div className={styles.body}>{body}</div>
      {children && <div className={styles.actions}>{children}</div>}
    </Stage>
  );
}

/** Nothing to show yet: a dark block with every window off. */
export function EmptyState({
  title,
  body,
  frame = "panel",
  children,
}: {
  title: string;
  body: ReactNode;
  frame?: Frame;
  children?: ReactNode;
}) {
  return (
    <Stage frame={frame}>
      <div
        className={styles.block}
        style={{
          gridTemplateColumns: "repeat(5, 20px)",
          padding: "20px 18px 26px",
          gap: 12,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: 20 }, (_, i) => (
          <span
            key={i}
            className={styles.unlit}
            style={{ width: 20, height: 24 }}
          />
        ))}
      </div>
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.body}>{body}</div>
      {children && <div className={styles.actions}>{children}</div>}
    </Stage>
  );
}

/** The 404: a block with one window missing. */
export function MissingUnit({ children }: { children: ReactNode }) {
  return (
    <main className={styles.stage}>
      <div className={styles.stack}>
        <div
          className={styles.block}
          style={{
            gridTemplateColumns: "repeat(4, 24px)",
            padding: "22px 20px 28px",
            gap: 14,
            background: "var(--mint)",
          }}
          aria-hidden="true"
        >
          {Array.from({ length: 16 }, (_, i) => (
            <span
              key={i}
              className={
                i === 9 ? styles.gap : i % 3 === 0 ? styles.warm : styles.sage
              }
            />
          ))}
        </div>
        {children}
      </div>
    </main>
  );
}
