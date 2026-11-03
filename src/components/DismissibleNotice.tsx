"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import styles from "./DismissibleNotice.module.css";

export function DismissibleNotice({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div role="note" className={`${className} ${styles.notice}`}>
      <div className={styles.content}>{children}</div>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss housing notice"
        title="Dismiss housing notice"
        onClick={() => setDismissed(true)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
