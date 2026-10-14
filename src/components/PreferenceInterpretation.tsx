"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, RefreshCw, Sparkles, X } from "lucide-react";
import {
  draftFields,
  fieldLabels,
  draftProposal,
  type InterpretationResult,
} from "@/domain/interpretation";
import type { Preference } from "@/domain/preferences";
import styles from "./PreferenceInterpretation.module.css";

function describe(value: unknown): string {
  if (value === null) return "Not stated";
  if (Array.isArray(value))
    return value.length ? value.map(describe).join("; ") : "None requested";
  if (typeof value === "object")
    if ("query" in value) {
      const d = value as {
        query: string;
        visits: number | null;
        mode: string | null;
      };
      return `${d.query} · ${d.visits === null ? "Visits not stated" : `${d.visits} visits/week`} · ${d.mode === null ? "Travel mode not stated" : d.mode === "public" ? "Public transport" : "Driving"}`;
    } else if ("category" in value) {
      const l = value as {
        category: string;
        radius: number | null;
        priority: number | null;
      };
      return `${l.category} · ${l.radius === null ? "Radius not stated" : `${l.radius} m`} · ${l.priority === null ? "Priority not stated" : `Priority ${l.priority}/5`}`;
    } else
      return Object.entries(value as Record<string, unknown>)
        .map(([key, v]) => `${key}: ${describe(v)}`)
        .join(" · ");
  return String(value);
}
export function PreferenceInterpretation({
  base,
  signedIn,
  preview,
  onApply,
  onSignIn,
  onSessionError,
}: {
  base: Preference;
  signedIn: boolean;
  preview: boolean;
  onApply: (result: InterpretationResult) => void;
  onSignIn: () => void;
  onSessionError: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [consent, setConsent] = useState(false),
    [acknowledged, setAcknowledged] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<InterpretationResult | null>(null);
  const [applied, setApplied] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!signedIn || preview) return;
    const abort = new AbortController();
    fetch("/api/preferences/interpret", {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw Error(body.error?.message ?? "AI status unavailable.");
        setEnabled(body.enabled === true);
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e.message);
      });
    return () => {
      abort.abort();
      request.current?.abort();
    };
  }, [signedIn, preview]);
  async function interpret() {
    if (busy || !consent || text.trim().length < 10 || !enabled) return;
    const abort = new AbortController();
    request.current = abort;
    setBusy(true);
    setError("");
    setResult(null);
    setApplied(false);
    setAcknowledged(false);
    try {
      const response = await fetch("/api/preferences/interpret", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, consent }),
        signal: abort.signal,
      });
      const body = await response.json();
      if (!response.ok) {
        if (["SESSION_EXPIRED", "SIGN_IN_REQUIRED"].includes(body.error?.code))
          onSessionError(body.error.message);
        throw Error(
          body.error?.message ??
            "Interpretation unavailable. Manual entry is unchanged.",
        );
      }
      if (!abort.signal.aborted) setResult(body.interpretation);
    } catch (e) {
      if (!abort.signal.aborted)
        setError(e instanceof Error ? e.message : "Please retry.");
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  }
  const proposal = result ? draftProposal(base, result.draft) : null;
  return (
    <section className={styles.section} aria-label="AI preference input">
      <div className={styles.heading}>
        <Sparkles />
        <h2>Describe your next home</h2>
        <span>Gemini draft</span>
      </div>
      <label className={styles.label}>
        Your description
        <textarea
          value={text}
          maxLength={4000}
          disabled={busy || (!signedIn && !preview)}
          rows={4}
          placeholder="A 4-room resale HDB under $600k. I visit NTU five times a week by MRT and play badminton."
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
            setApplied(false);
            setAcknowledged(false);
          }}
        />
      </label>
      <p className={styles.privacy}>
        Only this description is sent to Google. Free-tier inputs may be used to
        improve Google’s products. Use sample data, not personal addresses or
        sensitive household details. Destination names are also sent to OneMap
        for lookup.
      </p>
      <label className={styles.consent}>
        <input
          type="checkbox"
          checked={consent}
          disabled={busy || !signedIn || preview}
          onChange={(e) => setConsent(e.target.checked)}
        />{" "}
        I agree to send this description to Gemini and destination names to
        OneMap.
      </label>
      <div className={styles.actions}>
        <span>{text.length}/4000</span>
        {!signedIn && !preview ? (
          <button onClick={onSignIn}>
            <Sparkles /> Sign in for AI input
          </button>
        ) : (
          <button
            disabled={
              busy || !consent || text.trim().length < 10 || !enabled || preview
            }
            onClick={interpret}
          >
            {busy ? (
              <>
                <RefreshCw className={styles.spin} /> Interpreting
              </>
            ) : (
              <>
                <Sparkles /> Interpret description
              </>
            )}
          </button>
        )}
      </div>
      {preview && (
        <p className={styles.privacy}>
          AI extraction is unavailable in preview.
        </p>
      )}
      {signedIn && enabled === false && (
        <p role="status">
          Gemini is not configured. Manual entry is available.
        </p>
      )}
      {error && (
        <p className={styles.warning} role="alert">
          {error}
        </p>
      )}
      {busy && <p role="status">Creating an unsaved preference draft...</p>}
      {applied && (
        <p role="status">
          Draft applied to the editable form. No profile has been saved or
          confirmed.
        </p>
      )}
      {result && proposal && (
        <div className={styles.draft}>
          <div className={styles.heading}>
            <h3>Draft review</h3>
            <span>Not saved</span>
            <button
              aria-label="Discard AI draft"
              title="Discard AI draft"
              onClick={() => setResult(null)}
            >
              <X />
            </button>
          </div>
          <dl>
            {draftFields.map((field) => (
              <div key={field}>
                <dt>{fieldLabels[field]}</dt>
                <dd>
                  {(field === "budgetMin" || field === "budgetMax") &&
                  typeof result.draft[field] === "number"
                    ? new Intl.NumberFormat("en-SG", {
                        style: "currency",
                        currency: "SGD",
                        maximumFractionDigits: 0,
                      }).format(result.draft[field])
                    : describe(result.draft[field])}
                </dd>
              </div>
            ))}
          </dl>
          {result.draft.ambiguities.length > 0 && (
            <div role="note">
              <h3>Needs clarification</h3>
              <ul>
                {result.draft.ambiguities.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          {result.draft.unsupported.length > 0 && (
            <div role="note">
              <h3>Not supported by current filters</h3>
              <ul>
                {result.draft.unsupported.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
              <label className={styles.consent}>
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />{" "}
                I understand these requests will not contribute to matching.
              </label>
            </div>
          )}
          {proposal.proposed.length > 0 && (
            <details open>
              <summary>Proposed defaults and retained values</summary>
              <ul>
                {proposal.proposed.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </details>
          )}
          {result.locations.length > 0 && (
            <div>
              <h3>Location checks</h3>
              <ul>
                {result.locations.map((l, i) => (
                  <li key={i}>
                    {l.query}:{" "}
                    {l.error ??
                      `${l.candidates.length} OneMap candidates; no location selected`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <details>
            <summary>Source phrases</summary>
            <ul>
              {result.draft.evidence.map((e, i) => (
                <li key={i}>
                  {fieldLabels[e.field]}: &quot;{e.quote}&quot;
                </li>
              ))}
            </ul>
          </details>
          <button
            disabled={result.draft.unsupported.length > 0 && !acknowledged}
            onClick={() => {
              onApply(result);
              setResult(null);
              setApplied(true);
            }}
          >
            <ArrowDown /> Apply draft to form
          </button>
        </div>
      )}
    </section>
  );
}
