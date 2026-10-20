"use client";

import { useRef, type ReactNode } from "react";
import styles from "./TiltCard.module.css";

/** A card button that tilts toward the pointer in 3D with a soft glare; updates CSS variables only. */
export function TiltCard({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      className={styles.card}
      onClick={onClick}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el || e.pointerType !== "mouse") return;
        const b = el.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width;
        const y = (e.clientY - b.top) / b.height;
        el.style.setProperty("--rx", `${((0.5 - y) * 14).toFixed(2)}deg`);
        el.style.setProperty("--ry", `${((x - 0.5) * 16).toFixed(2)}deg`);
        el.style.setProperty("--gx", `${Math.round(x * 100)}%`);
        el.style.setProperty("--gy", `${Math.round(y * 100)}%`);
        el.dataset.tilt = "on";
      }}
      onPointerLeave={() => {
        const el = ref.current;
        if (el) el.dataset.tilt = "off";
      }}
    >
      {children}
      <span className={styles.glare} aria-hidden="true" />
    </button>
  );
}
