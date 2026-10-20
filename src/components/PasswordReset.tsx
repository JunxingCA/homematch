"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Moon, Sun } from "lucide-react";
import { resetPasswordSchema } from "@/domain/recovery";
import { Wordmark } from "./lights/Logo";
import styles from "./PasswordReset.module.css";
import { applyTheme, initialTheme } from "./theme";

export function PasswordReset({ available }: { available: boolean }) {
  const [theme, setTheme] = useState("dark");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [usable, setUsable] = useState(available);
  useEffect(() => {
    const selected = initialTheme(localStorage.getItem("homematch-theme"));
    document.documentElement.dataset.theme = selected;
    queueMicrotask(() => setTheme(selected));
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = {
      password: data.get("password"),
      confirmation: data.get("confirmation"),
    };
    const checked = resetPasswordSchema.safeParse(input);
    setError("");
    setFields({});
    if (!checked.success) {
      setFields(
        Object.fromEntries(
          checked.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.data),
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        if (
          [
            "RECOVERY_LINK_INVALID",
            "RECOVERY_UNAVAILABLE",
            "PASSWORD_RESET_FAILED",
          ].includes(result.error?.code)
        )
          setUsable(false);
        throw Error(
          result.error?.message ||
            "Reset failed. Your password may not have changed; request a new link before trying again.",
        );
      }
      form.reset();
      setMessage(result.message);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Connection failed. Request a new link if this one was already used.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link
          className={styles.brand}
          href="/"
          prefetch={false}
          aria-label="HomeMatch home"
        >
          <Wordmark />
        </Link>
        <button
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title="Change theme"
          onClick={() => {
            const next = theme === "dark" ? "light" : "dark";
            setTheme(next);
            applyTheme(next);
            localStorage.setItem("homematch-theme", next);
          }}
        >
          {theme === "dark" ? <Sun /> : <Moon />}
        </button>
      </header>
      <main className={styles.main}>
        <div className={styles.door} aria-hidden="true">
          <span />
        </div>
        {message ? (
          <>
            <h1>Password reset</h1>
            <p role="status">{message}</p>
            <Link
              className={styles.primary}
              href="/?auth=password-reset"
              prefetch={false}
            >
              Return to sign in <ArrowRight />
            </Link>
          </>
        ) : !usable ? (
          <>
            <h1>Request a new link</h1>
            <p>
              This recovery link is missing, expired or unavailable. Request a
              fresh link from HomeMatch.
            </p>
            {error && (
              <p role="alert" className={styles.error}>
                {error}
              </p>
            )}
            <Link
              className={styles.primary}
              href="/?auth=recovery"
              prefetch={false}
            >
              Request recovery email <ArrowRight />
            </Link>
          </>
        ) : (
          <>
            <h1>Choose a new password</h1>
            <p>
              Use at least 12 characters. You will need to sign in again after
              the reset.
            </p>
            <form onSubmit={submit} noValidate>
              <label>
                <span id="password-label">New password</span>
                <input
                  name="password"
                  aria-labelledby="password-label"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  maxLength={128}
                  disabled={busy}
                  aria-invalid={Boolean(fields.password)}
                  aria-describedby={
                    fields.password ? "password-error" : undefined
                  }
                />
                {fields.password && (
                  <span id="password-error" className={styles.error}>
                    {fields.password}
                  </span>
                )}
              </label>
              <label>
                <span id="confirmation-label">Confirm new password</span>
                <input
                  name="confirmation"
                  aria-labelledby="confirmation-label"
                  type="password"
                  autoComplete="new-password"
                  required
                  maxLength={128}
                  disabled={busy}
                  aria-invalid={Boolean(fields.confirmation)}
                  aria-describedby={
                    fields.confirmation ? "confirmation-error" : undefined
                  }
                />
                {fields.confirmation && (
                  <span id="confirmation-error" className={styles.error}>
                    {fields.confirmation}
                  </span>
                )}
              </label>
              {error && (
                <p role="alert" className={styles.error}>
                  {error}
                </p>
              )}
              <button className={styles.primary} type="submit" disabled={busy}>
                {busy ? "Resetting..." : "Reset password"}
                <ArrowRight />
              </button>
            </form>
          </>
        )}
        <Link className={styles.back} href="/" prefetch={false}>
          <ArrowLeft /> Back to HomeMatch
        </Link>
      </main>
    </div>
  );
}
