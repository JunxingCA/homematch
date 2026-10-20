"use client";

import { useRef, useState, type ReactNode } from "react";
import styles from "./MagnifierHeadline.module.css";

const RADIUS = 120;
const ZOOM = 1.45;

/**
 * A headline that shows a round magnifying lens under a mouse pointer.
 * The lens renders a second copy of the text, scaled and offset so the point under the cursor
 * stays centred. Touch and pen users simply see the headline.
 */
export function MagnifierHeadline({ children }: { children: ReactNode }) {
  const zone = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number; w: number } | null>(
    null,
  );

  return (
    <div
      ref={zone}
      className={styles.zone}
      data-active={lens ? "true" : "false"}
      onPointerMove={(e) => {
        if (e.pointerType !== "mouse" || !zone.current) return;
        const b = zone.current.getBoundingClientRect();
        setLens({ x: e.clientX - b.left, y: e.clientY - b.top, w: b.width });
      }}
      onPointerLeave={() => setLens(null)}
    >
      <h1 className={styles.headline}>{children}</h1>
      {lens && (
        <div
          className={styles.lens}
          style={{ left: lens.x - RADIUS, top: lens.y - RADIUS }}
          aria-hidden="true"
        >
          <div
            className={styles.inner}
            style={{
              left: RADIUS - lens.x * ZOOM,
              top: RADIUS - lens.y * ZOOM,
              width: lens.w,
              transform: `scale(${ZOOM})`,
            }}
          >
            <p className={styles.headline}>{children}</p>
          </div>
          <span className={styles.glint} />
        </div>
      )}
    </div>
  );
}
