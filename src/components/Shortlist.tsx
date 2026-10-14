"use client";
import { useState } from "react";
import { ArrowRight, Bookmark, RefreshCw, Trash2 } from "lucide-react";
import type { SavedArea } from "@/domain/shortlist";
import styles from "./RecommendationResults.module.css";
const town = (name: string) =>
  name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
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
      <div className={styles.empty}>
        <Bookmark />
        <h2>Your saved areas</h2>
        <p>Sign in to see your shortlist.</p>
        <button onClick={onSignIn}>Sign in</button>
      </div>
    );
  if (!ready)
    return (
      <div className={styles.loading} role="status">
        <RefreshCw className={styles.spin} />
        <h2>Loading saved areas</h2>
      </div>
    );
  if (error)
    return (
      <div className={styles.empty} role="alert">
        <h2>Saved areas could not be loaded</h2>
        <p>{error}</p>
        <button onClick={onReload}>
          <RefreshCw /> Retry
        </button>
      </div>
    );
  return (
    <div className={styles.results}>
      <div className={styles.toolbar}>
        <p>
          {items.length} saved {items.length === 1 ? "area" : "areas"}
        </p>
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
        <div className={styles.empty}>
          <Bookmark />
          <h2>No saved areas yet</h2>
          <p>Your shortlist is empty.</p>
          <button onClick={onFind}>
            Find areas <ArrowRight />
          </button>
        </div>
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
        <section aria-label="Saved areas">
          {items.map((item) => (
            <article className={styles.savedRow} key={item.id}>
              <div>
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
