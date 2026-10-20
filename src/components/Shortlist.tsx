"use client";
import { useState } from "react";
import { ArrowRight, RefreshCw, Trash2 } from "lucide-react";
import type { SavedArea } from "@/domain/shortlist";
import styles from "./RecommendationResults.module.css";
import { WindowMeter } from "./lights/WindowMeter";
import { EmptyState, ErrorState, LoadingState } from "./states/States";
import { litWindows, town } from "./results/resultView";
const money = (value: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(value);

export function Shortlist({
  items,
  ready,
  error,
  pending,
  signedIn,
  onReload,
  onOpen,
  onRemove,
  onFind,
  onSignIn,
}: {
  items: SavedArea[];
  ready: boolean;
  error: string;
  pending: boolean;
  signedIn: boolean;
  onReload: () => void;
  onOpen: (item: SavedArea) => void;
  onRemove: (item: SavedArea) => void;
  onFind: () => void;
  onSignIn: () => void;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [comparison, setComparison] = useState(false);
  const compared = items.filter((item) => selection.includes(item.id));
  const validSelection = compared.map((item) => item.id);
  if (!signedIn)
    return (
      <EmptyState
        title="Your saved areas"
        body="Sign in to see your shortlist."
      >
        <button onClick={onSignIn}>Sign in</button>
      </EmptyState>
    );
  if (!ready)
    return (
      <LoadingState
        title="Loading saved areas"
        messages={["Fetching your shortlist…"]}
      />
    );
  if (error)
    return (
      <ErrorState title="Saved areas could not be loaded" body={error}>
        <button onClick={onReload}>
          <RefreshCw /> Retry
        </button>
      </ErrorState>
    );
  return (
    <div className={styles.results}>
      <div className={styles.toolbar}>
        <div>
          <h1 className="h-page">Places worth a visit.</h1>
          <span className={`chip ${styles.savedCount}`}>
            <span className="dot" />
            {items.length} saved {items.length === 1 ? "area" : "areas"}
          </span>
        </div>
        <div className={styles.actions}>
          <button onClick={onReload} disabled={pending}>
            <RefreshCw /> Refresh shortlist
          </button>
          <button
            disabled={compared.length < 2}
            onClick={() => setComparison(!comparison)}
          >
            {comparison && compared.length >= 2
              ? "Back to saved areas"
              : `Compare saved (${compared.length}/3)`}
          </button>
        </div>
      </div>
      {!items.length ? (
        <EmptyState
          title="No saved areas yet"
          body="Your shortlist is empty. Save an area from your matches to keep it here."
        >
          <button onClick={onFind}>
            Find areas <ArrowRight />
          </button>
        </EmptyState>
      ) : comparison && compared.length >= 2 ? (
        <>
          <p className={styles.context} role="note">
            Each score belongs to its original profile and search date.
            Different weights, budgets or evidence dates mean overall scores are
            not directly comparable.
          </p>
          <div className={styles.tableWrap}>
            <table>
              <caption>Saved area comparison</caption>
              <thead>
                <tr>
                  <th>Evidence</th>
                  {compared.map((item) => (
                    <th key={item.id}>{town(item.result.area.name)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ["Profile", (s) => s.context.preference.name],
                    [
                      "Search date",
                      (s) =>
                        new Date(s.context.createdAt).toLocaleDateString(
                          "en-SG",
                        ),
                    ],
                    [
                      "Housing type",
                      (s) =>
                        s.context.preference.category === "BTO" ||
                        s.context.preference.category === "Resale HDB"
                          ? `${s.context.preference.category} · ${s.context.preference.flatTypes.join(", ")}`
                          : s.context.preference.category,
                    ],
                    [
                      "Budget range",
                      (s) =>
                        `${money(s.context.preference.budgetMin)}–${money(s.context.preference.budgetMax)}`,
                    ],
                    [
                      "Journey / lifestyle / budget weights",
                      (s) =>
                        `${s.context.preference.weights.destination}% / ${s.context.preference.weights.lifestyle}% / ${s.context.preference.weights.affordability}%`,
                    ],
                    [
                      "Original overall score",
                      (s) => s.result.overall.toFixed(1),
                    ],
                    [
                      "Weighted journey",
                      (s) => `${s.result.weightedMinutes.toFixed(1)} min`,
                    ],
                    [
                      "Price evidence",
                      (s) =>
                        s.result.priceEvidence?.kind === "bto-range"
                          ? `${money(s.result.p25)}–${money(s.result.p75)} published range`
                          : `${money(s.result.median)} historical median`,
                    ],
                    [
                      "Budget evidence",
                      (s) =>
                        s.result.priceEvidence?.kind === "bto-range"
                          ? `${s.result.affordabilityScore.toFixed(1)}% range coverage, not a unit count`
                          : `${s.result.withinBudget}/${s.result.transactions}`,
                    ],
                    [
                      "Price evidence window",
                      (s) =>
                        s.result.priceEvidence?.kind === "bto-range"
                          ? `${s.result.priceEvidence.launch} launch; applications ${s.result.priceEvidence.applicationOpens} to ${s.result.priceEvidence.applicationCloses}`
                          : `${s.context.fromMonth} to ${s.context.toMonthExclusive} (end excluded)`,
                    ],
                    ["Formula", (s) => s.context.formulaVersion],
                    [
                      "Amenity coverage",
                      (s) =>
                        s.context.facilitySources
                          .filter((source) =>
                            s.context.preference.lifestyles.some(
                              (l) => l.category === source.category,
                            ),
                          )
                          .map((source) => source.coverage ?? source.category)
                          .join("; "),
                    ],
                  ] as [string, (s: SavedArea) => string][]
                ).map(([label, format]) => (
                  <tr key={label}>
                    <th>{label}</th>
                    {compared.map((item) => (
                      <td key={item.id}>{format(item)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <section aria-label="Saved areas" className={styles.savedGrid}>
          {items.map((item) => (
            <article className={styles.savedRow} key={item.id}>
              <div>
                <span className={styles.savedMeter}>
                  <WindowMeter lit={litWindows(item.result.overall)} compact />
                  <span className="tag">
                    {litWindows(item.result.overall)} of 10 lit
                  </span>
                </span>
                <h2>{town(item.result.area.name)}</h2>
                <p>
                  {item.context.preference.name} · searched{" "}
                  {new Date(item.context.createdAt).toLocaleDateString("en-SG")}
                </p>
                <p>
                  {item.result.priceEvidence?.kind === "bto-range"
                    ? `${money(item.result.p25)}–${money(item.result.p75)} published range`
                    : `${money(item.result.median)} historical median`}{" "}
                  · {item.result.weightedMinutes.toFixed(1)} min weighted
                  journey
                </p>
              </div>
              <div className={styles.actions}>
                <label className={styles.compare}>
                  <input
                    type="checkbox"
                    aria-label={`Compare saved ${town(item.result.area.name)}`}
                    checked={validSelection.includes(item.id)}
                    disabled={
                      !validSelection.includes(item.id) && compared.length >= 3
                    }
                    onChange={(event) =>
                      setSelection(
                        event.target.checked
                          ? [...validSelection, item.id]
                          : validSelection.filter((id) => id !== item.id),
                      )
                    }
                  />{" "}
                  Compare
                </label>
                <button onClick={() => onOpen(item)} disabled={pending}>
                  View evidence <ArrowRight />
                </button>
                <button
                  onClick={() => onRemove(item)}
                  disabled={pending}
                  aria-label={`Remove ${town(item.result.area.name)} from saved areas`}
                  title="Remove from saved areas"
                >
                  <Trash2 />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
