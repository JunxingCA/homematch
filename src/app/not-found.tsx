import type { Metadata } from "next";
import Link from "next/link";
import { MissingUnit } from "@/components/states/States";
import styles from "@/components/states/States.module.css";

export const metadata: Metadata = { title: "HomeMatch | Page not found" };

export default function NotFound() {
  return (
    <MissingUnit>
      <h1 className={styles.title}>This unit doesn’t exist.</h1>
      <p className={styles.body}>
        The page you’re looking for has moved or was never built. Let’s get you
        back to the lobby.
      </p>
      <div className={styles.actions}>
        <Link href="/">Back to the lobby</Link>
        <Link href="/welcome#how">How HomeMatch works</Link>
      </div>
    </MissingUnit>
  );
}
