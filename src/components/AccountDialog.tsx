"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, LogIn, Trash2, UserRound, X } from "lucide-react";
import styles from "./AccountDialog.module.css";

export type DeletionFeedback = { error?: string; reauthenticate?: boolean };
export function AccountDialog({
  email,
  onClose,
  onDelete,
  onReauthenticate,
}: {
  email?: string;
  onClose: () => void;
  onDelete: (confirmation: string) => Promise<DeletionFeedback>;
  onReauthenticate: () => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<DeletionFeedback>({});
  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (confirmation !== "DELETE" || pending || feedback.reauthenticate) return;
    setPending(true);
    setFeedback({});
    try {
      setFeedback(await onDelete(confirmation));
    } catch {
      setFeedback({
        error:
          "Deletion could not be confirmed. Sign in to check your account before retrying.",
      });
    } finally {
      setPending(false);
    }
  }
  async function reauthenticate() {
    setPending(true);
    try {
      await onReauthenticate();
    } catch {
      setFeedback({
        error: "Sign-in could not be restarted. Please retry.",
        reauthenticate: true,
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="account-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), [tabindex='0']",
          ),
        );
        const first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        if (pending) event.preventDefault();
        else onClose();
      }}
    >
      <header>
        <h2 id="account-title">
          {confirming ? "Delete your account?" : "Your account"}
        </h2>
        <button
          className={styles.icon}
          title="Close account settings"
          aria-label="Close account settings"
          disabled={pending}
          onClick={onClose}
        >
          <X />
        </button>
      </header>
      {confirming ? (
        <form onSubmit={submit}>
          <p>
            This permanently removes your HomeMatch account, all preference
            profiles, saved searches and saved areas. This cannot be undone.
          </p>
          <p>
            Your Google account is not deleted. Shared government datasets are
            kept.
          </p>
          <label>
            Type DELETE to confirm
            <input
              aria-label="Type DELETE to confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={pending}
            />
          </label>
          <p className={styles.note}>
            A sign-in within the last 10 minutes is required.
          </p>
          {feedback.error && (
            <p className={styles.error} role="alert">
              {feedback.error}
            </p>
          )}
          {feedback.reauthenticate && (
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={reauthenticate}
            >
              <LogIn /> Sign in again
            </button>
          )}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondary}
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                setConfirmation("");
                setFeedback({});
              }}
            >
              <ArrowLeft /> Cancel
            </button>
            <button
              type="submit"
              className={styles.danger}
              disabled={
                pending || confirmation !== "DELETE" || feedback.reauthenticate
              }
            >
              <Trash2 />
              {pending ? "Deleting..." : "Delete account"}
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className={styles.identity}>
            <UserRound />
            <span>{email ?? "Signed-in HomeMatch account"}</span>
          </div>
          <div className={styles.deleteSection}>
            <h3>Delete HomeMatch account</h3>
            <p>Permanently remove this account and its saved research.</p>
            <button
              className={styles.danger}
              onClick={() => setConfirming(true)}
            >
              <Trash2 /> Delete account
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
