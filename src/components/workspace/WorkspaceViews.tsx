"use client";

import { ArrowRight, FilePenLine, MapPin, Search, Trash2 } from "lucide-react";
import type { Preference, Profile } from "@/domain/preferences";
import { amenityPresentation } from "../amenityPresentation";
import { BlockScene } from "./BlockScene";
import {
  money,
  preferenceSentence,
  priorityLevel,
  radiusLabel,
} from "./preferenceText";
import styles from "./Workspace.module.css";

/** Review before saving: the one-sentence summary, then every field that will be saved. */
export function ReviewView({
  preference,
  preview,
  busy,
  onEdit,
  onConfirm,
}: {
  preference: Preference;
  preview: boolean;
  busy: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className={styles.split}>
      <div className={styles.splitMain}>
        <h1 className="h-page">A little more you.</h1>
        <p className={styles.lede}>
          Check the places and priorities that will shape your search.
        </p>
        <div className={styles.sentenceCard}>
          <span className="chip chip--soft">
            <span className="dot" />
            Your home, in one sentence
          </span>
          <p>{preferenceSentence(preference)}</p>
        </div>
        <section className={styles.card} aria-labelledby="review-title">
          <div className={styles.cardHead}>
            <h2 id="review-title">Your profile, at a glance</h2>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={onEdit}
            >
              <FilePenLine aria-hidden="true" size={16} />
              Edit
            </button>
          </div>
          <dl className={styles.review}>
            <div>
              <dt>Profile & housing</dt>
              <dd>
                {preference.name} · {preference.category}
              </dd>
            </div>
            <div>
              <dt>Budget & historical evidence</dt>
              <dd>
                {money(preference.budgetMin)} - {money(preference.budgetMax)}
                <p>
                  {preference.flatTypes.join(", ")} ·{" "}
                  {preference.lookbackMonths} complete months
                </p>
              </dd>
            </div>
            <div>
              <dt>Frequent places</dt>
              <dd>
                {preference.destinations.map((d, i) => (
                  <p key={i}>
                    {d.location?.label} · {d.visits} visits/week ·{" "}
                    {d.mode === "public" ? "Public" : "Private"} transport
                  </p>
                ))}
              </dd>
            </div>
            <div>
              <dt>Lifestyle</dt>
              <dd>
                {preference.lifestyles.length
                  ? preference.lifestyles.map((l) => (
                      <p key={l.category}>
                        {amenityPresentation[l.category].label} ·{" "}
                        {priorityLevel(l.priority) === "must"
                          ? "Must"
                          : "Nice to have"}{" "}
                        · within {radiusLabel(l.radius)} · priority {l.priority}
                        /5
                      </p>
                    ))
                  : "No lifestyle preferences"}
              </dd>
            </div>
            <div>
              <dt>Priorities</dt>
              <dd>
                Journeys {preference.weights.destination}% · Lifestyle{" "}
                {preference.weights.lifestyle}% · Budget{" "}
                {preference.weights.affordability}%
              </dd>
            </div>
          </dl>
        </section>
        <div className={styles.footer}>
          <button type="button" className="btn btn--ghost" onClick={onEdit}>
            ← Back
          </button>
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy
              ? "Saving..."
              : preview
                ? "Confirm preview"
                : "Confirm & save"}
          </button>
        </div>
      </div>
      <aside className={styles.splitAside} aria-label="Your block">
        <BlockScene preference={preference} />
      </aside>
    </div>
  );
}

/** After saving: the next step is lighting up matching areas. */
export function DoneView({
  preference,
  preview,
  busy,
  canSearch,
  searchLabel,
  onEdit,
  onSearch,
  onProfiles,
}: {
  preference: Preference;
  preview: boolean;
  busy: boolean;
  canSearch: boolean;
  searchLabel: string;
  onEdit: () => void;
  onSearch: () => void;
  onProfiles: () => void;
}) {
  return (
    <div className={styles.split}>
      <div className={styles.splitMain}>
        <h1 className="h-page">Preferences, confirmed.</h1>
        <div className={styles.doneCard}>
          <span className={styles.doneWindow} aria-hidden="true" />
          <h2>{preview ? "Preview reviewed" : "Profile saved"}</h2>
          <p>
            {preview
              ? "This is a reviewed sample, not a stored profile or a recommendation."
              : `${preference.name} is confirmed. You can return to it from My profiles.`}
          </p>
          <p className={styles.small}>
            Area ranking currently supports Resale HDB, with parks, hawker
            centres, badminton venues, schools and hospitals. Grocery evidence
            is partial; its rankings are provisional.
          </p>
        </div>
        <div className={styles.footer}>
          <button type="button" className="btn btn--ghost" onClick={onEdit}>
            <FilePenLine aria-hidden="true" size={16} />
            Edit preferences
          </button>
          {!preview && (
            <button
              type="button"
              className="btn"
              disabled={busy || !canSearch}
              onClick={onSearch}
            >
              <Search aria-hidden="true" size={16} />
              {searchLabel}
            </button>
          )}
          {!preview && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={onProfiles}
            >
              My profiles →
            </button>
          )}
        </div>
      </div>
      <aside className={styles.splitAside} aria-label="Your block">
        <BlockScene preference={preference} />
      </aside>
    </div>
  );
}

type HistoryItem = { id: string; createdAt: string; profileName: string };

/** Up to four saved profiles as small blocks, plus recent area searches. */
export function ProfilesView({
  profiles,
  preview,
  signedIn,
  busy,
  history,
  historyReady,
  historyError,
  clearingHistory,
  onNew,
  onEdit,
  onFind,
  onExplore,
  onDelete,
  onOpenHistory,
  onClearHistory,
  onRetryHistory,
}: {
  profiles: Profile[];
  preview: boolean;
  signedIn: boolean;
  busy: boolean;
  history: HistoryItem[];
  historyReady: boolean;
  historyError: string;
  clearingHistory: boolean;
  onNew: () => void;
  onEdit: (profile: Profile) => void;
  onFind: (profile: Profile) => void;
  onExplore: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onOpenHistory: (id: string) => void;
  onClearHistory: () => void;
  onRetryHistory: () => void;
}) {
  return (
    <div className={styles.stack}>
      <div className={styles.pageHead}>
        <div>
          <h1 className="h-page">Your profiles</h1>
          <p className={styles.lede}>
            Different possibilities, thoughtfully kept in one place.
          </p>
        </div>
        <button type="button" className="btn" onClick={onNew}>
          + New profile
        </button>
      </div>
      <section aria-labelledby="saved-preferences">
        <h2 id="saved-preferences" className="sr-only">
          Saved preferences
        </h2>
        {!profiles.length ? (
          <div className={styles.empty}>
            <span className={styles.emptyBlock} aria-hidden="true">
              {Array.from({ length: 12 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
            <h2>No saved profiles yet</h2>
            <p>
              {preview
                ? "Sign-in and persistent profiles need a configured Supabase project."
                : signedIn
                  ? "Create your first profile to get started."
                  : "Sign in to see your profiles."}
            </p>
          </div>
        ) : (
          <div className={styles.profileGrid}>
            {profiles.map((p) => (
              <article className={styles.profile} key={p.id}>
                <div className={styles.profileTop}>
                  <span className={styles.miniBlock} aria-hidden="true">
                    {Array.from({ length: 9 }, (_, i) => (
                      <i
                        key={i}
                        style={{
                          background:
                            i === 4
                              ? "var(--coral)"
                              : i % 3 === 0
                                ? "var(--amber)"
                                : "#7E9C8B",
                        }}
                      />
                    ))}
                  </span>
                  <span className={`tag ${p.confirmed ? "" : styles.draft}`}>
                    {p.confirmed ? "Confirmed" : "Draft"}
                  </span>
                </div>
                <h2>{p.preference.name}</h2>
                <p className={styles.small}>
                  {p.preference.category} · {money(p.preference.budgetMin)} -{" "}
                  {money(p.preference.budgetMax)}
                </p>
                {p.preference.category === "BTO" && (
                  <p className={styles.small}>
                    BTO simulation: past launch, applications closed.
                  </p>
                )}
                <div className={styles.profileActions}>
                  <button
                    type="button"
                    className="btn btn--small"
                    disabled={!p.confirmed || busy}
                    onClick={() => onFind(p)}
                  >
                    <Search aria-hidden="true" size={16} />
                    Find matching areas
                  </button>
                  {p.preference.category !== "Resale HDB" && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--small"
                      disabled={busy}
                      onClick={() => onExplore(p)}
                    >
                      <Search aria-hidden="true" size={16} />
                      Explore without ranking
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn--ghost btn--small"
                    onClick={() => onEdit(p)}
                  >
                    <FilePenLine aria-hidden="true" size={16} />
                    Edit profile
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label={`Delete ${p.preference.name}`}
                    title="Delete profile"
                    onClick={() => onDelete(p)}
                  >
                    <Trash2 aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {signedIn && (
        <section className={styles.card} aria-label="Recent area searches">
          <div className={styles.cardHead}>
            <h2>Recent area searches</h2>
            <button
              type="button"
              className="btn btn--ghost btn--small"
              disabled={
                busy || clearingHistory || !historyReady || !history.length
              }
              onClick={onClearHistory}
            >
              <Trash2 aria-hidden="true" size={16} />
              {clearingHistory ? "Clearing…" : "Clear recent searches"}
            </button>
          </div>
          {historyError && (
            <p role="alert" className={styles.alert}>
              {historyError}{" "}
              <button
                type="button"
                className={styles.textButton}
                disabled={clearingHistory}
                onClick={onRetryHistory}
              >
                Retry loading history
              </button>
            </p>
          )}
          {!historyReady && <p role="status">Loading recent searches…</p>}
          {historyReady && !historyError && !history.length && (
            <p role="status">No recent searches.</p>
          )}
          <div className={styles.historyList}>
            {history.map((item) => (
              <button
                type="button"
                key={item.id}
                className={styles.historyItem}
                disabled={busy || clearingHistory}
                onClick={() => onOpenHistory(item.id)}
              >
                <MapPin aria-hidden="true" />
                <span>
                  {item.profileName} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString("en-SG")}
                </span>
                <ArrowRight aria-hidden="true" />
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
