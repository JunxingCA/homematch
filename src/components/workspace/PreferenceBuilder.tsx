"use client";

import type { FormEvent, ReactNode } from "react";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  Minus,
  Plus,
  Search,
  X,
} from "lucide-react";
import {
  flatTypes,
  lifestyleCategories,
  LIMITS,
  type Location,
  type Preference,
} from "@/domain/preferences";
import { amenityPresentation } from "../amenityPresentation";
import { FacadeMarker } from "../lights/FacadeMarker";
import { tick } from "../lights/sound";
import { BlockScene } from "./BlockScene";
import {
  BUDGET_SCALE,
  MUST,
  NICE,
  money,
  preferenceSentence,
  priorityLevel,
  radiusLabel,
  shortMoney,
} from "./preferenceText";
import styles from "./PreferenceBuilder.module.css";

type Category = Preference["category"];
type LifestyleCategory = Preference["lifestyles"][number]["category"];
type FieldError = { path: string; message: string };

const CATEGORY_TILES: {
  id: Category;
  sub: string;
  icon: string;
}[] = [
  {
    id: "BTO",
    sub: "Launch-price ranges from published HDB exercises",
    icon: "M3 21h18M5 21V9l7-4 7 4v12M9 21v-6h6v6M12 2v3M17 4l2-2",
  },
  {
    id: "Resale HDB",
    sub: "Ranked with historical HDB resale prices",
    icon: "M15 7a4 4 0 1 1-3.9 4.9L4 19v2h3v-2h2v-2h2l1.1-1.1A4 4 0 0 1 15 7zM16 10h.01",
  },
  {
    id: "Condominium",
    sub: "Area exploration; private prices need a URA import",
    icon: "M4 21V5a2 2 0 0 1 2-2h6v18M12 9h6a2 2 0 0 1 2 2v10M8 7h.01M8 11h.01M8 15h.01M16 13h.01M16 17h.01",
  },
  {
    id: "Private / landed",
    sub: "Area exploration for landed and other private homes",
    icon: "M3 12l9-8 9 8M5 10v10h14V10M10 20v-6h4v6",
  },
];

const PLANS: Record<
  Preference["flatTypes"][number],
  { size: string; rooms: [number, number, number, number][] }
> = {
  "2-room": {
    size: "38–47 m²",
    rooms: [
      [0, 0, 55, 100],
      [55, 0, 45, 60],
      [55, 60, 45, 40],
    ],
  },
  "3-room": {
    size: "60–68 m²",
    rooms: [
      [0, 0, 50, 100],
      [50, 0, 50, 50],
      [50, 50, 30, 50],
      [80, 50, 20, 50],
    ],
  },
  "4-room": {
    size: "90–93 m²",
    rooms: [
      [0, 0, 40, 100],
      [40, 0, 30, 50],
      [70, 0, 30, 50],
      [40, 50, 30, 50],
      [70, 50, 30, 50],
    ],
  },
  "5-room": {
    size: "110–113 m²",
    rooms: [
      [0, 0, 35, 100],
      [35, 0, 22, 50],
      [57, 0, 22, 50],
      [79, 0, 21, 50],
      [35, 50, 32, 50],
      [67, 50, 33, 50],
    ],
  },
  Executive: {
    size: "130 m² and up",
    rooms: [
      [0, 0, 30, 60],
      [0, 60, 30, 40],
      [30, 0, 25, 50],
      [55, 0, 25, 50],
      [80, 0, 20, 50],
      [30, 50, 35, 50],
      [65, 50, 35, 50],
    ],
  },
};

const LOOKBACKS = [3, 6, 12, 24, 36, 60];
const RADII = [300, 500, 800, 1000, 1500, 2000, 3000, 5000];
const EVERYDAY: LifestyleCategory[] = [
  "Parks",
  "Hawker centres",
  "Groceries",
  "Schools",
  "Healthcare",
];
const SPORTS = lifestyleCategories.filter((c) => !EVERYDAY.includes(c));
const LIFESTYLE_TINTS: Partial<Record<LifestyleCategory, string>> = {
  Parks: "var(--pastel-green)",
  "Hawker centres": "var(--amber-soft)",
  Groceries: "var(--pastel-pink)",
  Schools: "var(--pastel-lilac)",
  Healthcare: "var(--pastel-teal)",
};

const WEIGHT_PRESETS: {
  label: string;
  weights: Preference["weights"];
}[] = [
  {
    label: "A bit of everything",
    weights: { destination: 34, lifestyle: 33, affordability: 33 },
  },
  {
    label: "Shorter trips",
    weights: { destination: 50, lifestyle: 25, affordability: 25 },
  },
  {
    label: "Life around me",
    weights: { destination: 25, lifestyle: 50, affordability: 25 },
  },
  {
    label: "Best value",
    weights: { destination: 25, lifestyle: 25, affordability: 50 },
  },
];

/** The profile rules require 0% lifestyle weight when no lifestyles are chosen. */
function fitWeights(
  weights: Preference["weights"],
  hasLifestyles: boolean,
): Preference["weights"] {
  if (hasLifestyles || weights.lifestyle === 0) return weights;
  return {
    destination: weights.destination + weights.lifestyle,
    lifestyle: 0,
    affordability: weights.affordability,
  };
}

function Question({
  index,
  title,
  aside,
  children,
}: {
  index: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={styles.q} aria-labelledby={`q${index}`}>
      <div className={styles.qh}>
        <FacadeMarker index={index} />
        <h2 id={`q${index}`} className={styles.qt}>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function FieldMessages({
  fields,
  prefix,
}: {
  fields: FieldError[];
  prefix: string;
}) {
  const messages = [
    ...new Set(
      fields
        .filter((f) => f.path === prefix || f.path.startsWith(`${prefix}.`))
        .map((f) => f.message),
    ),
  ];
  if (!messages.length) return null;
  return (
    <p className={styles.fieldError}>
      {messages.map((m) => (
        <span key={m}>
          <b className={styles.fixTag}>Fix</b> {m}
        </span>
      ))}
    </p>
  );
}

export function preferenceProgress(p: Preference): boolean[] {
  const total =
    p.weights.destination + p.weights.lifestyle + p.weights.affordability;
  return [
    Boolean(p.name.trim()),
    p.budgetMax >= p.budgetMin && p.budgetMax > 0,
    p.flatTypes.length > 0,
    p.destinations.every((d) => d.location && d.query === d.location.label),
    p.lifestyles.length > 0,
    total === 100,
  ];
}

export function PreferenceBuilder({
  preference,
  update,
  preview,
  fields,
  candidates,
  searching,
  searchError,
  onSearch,
  onQueryChange,
  onSelectLocation,
  onRemoveDestination,
  onAddDestination,
  onSubmit,
  ai,
}: {
  preference: Preference;
  update: (change: Partial<Preference>) => void;
  preview: boolean;
  fields: FieldError[];
  candidates: Record<number, Location[]>;
  searching: number | null;
  searchError: Record<number, string>;
  onSearch: (index: number) => void;
  onQueryChange: (index: number, query: string) => void;
  onSelectLocation: (index: number, location: Location) => void;
  onRemoveDestination: (index: number) => void;
  onAddDestination: () => void;
  onSubmit: (event: FormEvent) => void;
  ai: ReactNode;
}) {
  const scale = BUDGET_SCALE[preference.category];
  const pct = (v: number) =>
    Math.round(
      Math.min(1, Math.max(0, (v - scale.min) / (scale.max - scale.min))) * 100,
    );
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) =>
    shortMoney(
      Math.round((scale.min + t * (scale.max - scale.min)) / scale.step) *
        scale.step,
    ),
  );
  const total =
    preference.weights.destination +
    preference.weights.lifestyle +
    preference.weights.affordability;
  const hasLifestyles = preference.lifestyles.length > 0;
  const full = preference.lifestyles.length >= LIMITS.lifestyles;
  const privateHousing =
    preference.category === "Condominium" ||
    preference.category === "Private / landed";

  const setLifestyle = (
    category: LifestyleCategory,
    level: "must" | "nice" | "skip",
  ) => {
    const current = preference.lifestyles.find((l) => l.category === category);
    if (level === "skip") {
      if (!current) return;
      const lifestyles = preference.lifestyles.filter(
        (l) => l.category !== category,
      );
      update({
        lifestyles,
        weights: fitWeights(preference.weights, lifestyles.length > 0),
      });
      return;
    }
    if (current && priorityLevel(current.priority) === level) return;
    const priority = level === "must" ? MUST : NICE;
    update({
      lifestyles: current
        ? preference.lifestyles.map((l) =>
            l.category === category ? { ...l, priority } : l,
          )
        : [...preference.lifestyles, { category, priority, radius: 1000 }],
    });
  };

  const cycleRadius = (category: LifestyleCategory) => {
    update({
      lifestyles: preference.lifestyles.map((l) => {
        if (l.category !== category) return l;
        const next = RADII.find((r) => r > l.radius) ?? RADII[0];
        return { ...l, radius: next };
      }),
    });
  };

  const notes = [
    preference.lifestyles.some((l) => SPORTS.includes(l.category)) &&
      "Sports data includes private, condominium and school venues. Public access, memberships and bookings are not verified; source coordinates are approximate.",
    preference.lifestyles.some((l) => l.category === "Groceries") &&
      "Groceries uses a partial OneMap supermarket directory. Missing stores can affect rankings; no match is not proof of no nearby shops.",
    preference.lifestyles.some((l) => l.category === "Healthcare") &&
      "Healthcare currently measures hospital proximity, not GP or polyclinic access.",
    preference.lifestyles.some((l) => l.category === "Schools") &&
      "Schools uses the MOE school directory. Proximity does not establish admission eligibility.",
  ].filter(Boolean) as string[];

  const lifestyleRow = (category: LifestyleCategory) => {
    const current = preference.lifestyles.find((l) => l.category === category);
    const level = current ? priorityLevel(current.priority) : "skip";
    const presentation = amenityPresentation[category];
    const Icon = presentation.icon;
    const blocked = !current && full;
    return (
      <div key={category} className={styles.amenity}>
        <span className={styles.amenityName}>
          <span
            className={styles.amenityIcon}
            style={{ background: LIFESTYLE_TINTS[category] ?? "var(--mint)" }}
          >
            <Icon aria-hidden="true" />
          </span>
          {presentation.label}
        </span>
        <span className={styles.amenityControls}>
          {current && (
            <button
              type="button"
              className={styles.radius}
              aria-label={`${presentation.label} search radius: ${radiusLabel(current.radius)}. Change`}
              onClick={() => {
                tick();
                cycleRadius(category);
              }}
            >
              within {radiusLabel(current.radius)}
            </button>
          )}
          <span
            role="group"
            aria-label={`${presentation.label} priority`}
            className={`seg-group ${styles.priority}`}
          >
            {(["must", "nice", "skip"] as const).map((v) => (
              <button
                key={v}
                type="button"
                className="seg"
                data-priority={v}
                aria-pressed={level === v}
                disabled={blocked && v !== "skip"}
                onClick={() => {
                  tick(v);
                  setLifestyle(category, v);
                }}
              >
                {v === "must" ? "Must" : v === "nice" ? "Nice" : "Skip"}
              </button>
            ))}
          </span>
        </span>
      </div>
    );
  };

  const presetIndex = WEIGHT_PRESETS.findIndex((p) => {
    const w = fitWeights(p.weights, hasLifestyles);
    return (
      w.destination === preference.weights.destination &&
      w.lifestyle === preference.weights.lifestyle &&
      w.affordability === preference.weights.affordability
    );
  });

  return (
    <div className={styles.layout}>
      <aside className={styles.aside} aria-label="Preference summary">
        <h1 className="h-page">
          Build your
          <br />
          ideal block.
        </h1>
        <BlockScene preference={preference} />
        <div className={styles.sentence} aria-live="polite">
          <span className="chip chip--soft" style={{ alignSelf: "flex-start" }}>
            <span className="dot" />
            Your home, in one sentence
          </span>
          <p>{preferenceSentence(preference)}</p>
        </div>
        <p className={styles.disclaimer}>
          Area research only. Not financial, legal, or housing-eligibility
          advice.
        </p>
      </aside>

      <div className={styles.main}>
        {ai}
        <form onSubmit={onSubmit} noValidate>
          <Question index={0} title="New launch or move-in ready?">
            <div className={styles.tiles4}>
              {CATEGORY_TILES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.tile}
                  aria-pressed={preference.category === c.id}
                  aria-label={c.id}
                  aria-describedby={`category-${c.id.replace(/\W+/g, "-")}`}
                  onClick={() => {
                    tick();
                    update({ category: c.id });
                  }}
                >
                  <svg
                    width="34"
                    height="34"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d={c.icon} />
                  </svg>
                  <span className={styles.tileText}>
                    <span className={styles.tileTitle}>{c.id}</span>
                    <span
                      className={styles.tileSub}
                      id={`category-${c.id.replace(/\W+/g, "-")}`}
                    >
                      {c.sub}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {(preference.category === "BTO" || privateHousing) && (
              <p className={styles.note}>
                {privateHousing
                  ? "HDB resale evidence does not measure private-property affordability. Area exploration only."
                  : "Historical resale evidence is neighborhood context, not BTO project pricing."}
              </p>
            )}
            <label className={styles.nameField}>
              <span className="chip">
                <span className="dot" style={{ background: "var(--sage)" }} />
                Profile name
              </span>
              <input
                className={styles.field}
                value={preference.name}
                maxLength={60}
                autoComplete="off"
                aria-label="Profile name"
                onChange={(e) => update({ name: e.target.value })}
              />
            </label>
            <FieldMessages fields={fields} prefix="name" />
            <FieldMessages fields={fields} prefix="category" />
          </Question>

          <Question index={1} title="What can you spend?">
            <div className={styles.budgetRow}>
              <span className={styles.bigNum}>
                {money(preference.budgetMin)}
              </span>
              <span className="chip chip--soft">to</span>
              <span className={styles.bigNum}>
                {money(preference.budgetMax)}
              </span>
            </div>
            <div className={styles.panel}>
              <div className={styles.slider}>
                <span className="chip" style={{ alignSelf: "flex-start" }}>
                  <span className="dot" style={{ background: "var(--sage)" }} />
                  Lowest
                </span>
                <input
                  type="range"
                  aria-label="Minimum budget slider"
                  min={scale.min}
                  max={scale.max}
                  step={scale.step}
                  value={Math.min(
                    Math.max(preference.budgetMin, scale.min),
                    scale.max,
                  )}
                  aria-valuetext={money(preference.budgetMin)}
                  onChange={(e) =>
                    update({
                      budgetMin: Math.min(
                        Number(e.target.value),
                        preference.budgetMax,
                      ),
                    })
                  }
                  style={{
                    background: `linear-gradient(to right, var(--track) ${pct(preference.budgetMin)}%, var(--ink) ${pct(preference.budgetMin)}%)`,
                  }}
                />
              </div>
              <div className={styles.slider}>
                <span className="chip" style={{ alignSelf: "flex-start" }}>
                  <span className="dot" />
                  {preference.category === "Private / landed"
                    ? "Highest"
                    : "Highest · higher budget, higher floor"}
                </span>
                <input
                  type="range"
                  aria-label="Maximum budget slider"
                  min={scale.min}
                  max={scale.max}
                  step={scale.step}
                  value={Math.min(
                    Math.max(preference.budgetMax, scale.min),
                    scale.max,
                  )}
                  aria-valuetext={money(preference.budgetMax)}
                  onChange={(e) =>
                    update({
                      budgetMax: Math.max(
                        Number(e.target.value),
                        preference.budgetMin,
                      ),
                    })
                  }
                  style={{
                    background: `linear-gradient(to right, var(--ink) ${pct(preference.budgetMax)}%, var(--track) ${pct(preference.budgetMax)}%)`,
                  }}
                />
              </div>
              <div className={styles.ticks} aria-hidden="true">
                {ticks.map((t, i) => (
                  <span key={i}>{t}</span>
                ))}
              </div>
              <div className={styles.exact}>
                <label>
                  <span>Minimum budget (SGD)</span>
                  <input
                    className={styles.field}
                    type="number"
                    min={0}
                    max={20000000}
                    step={10000}
                    value={preference.budgetMin}
                    onChange={(e) =>
                      update({ budgetMin: Number(e.target.value) })
                    }
                  />
                </label>
                <label>
                  <span>Maximum budget (SGD)</span>
                  <input
                    className={styles.field}
                    type="number"
                    min={1}
                    max={20000000}
                    step={10000}
                    value={preference.budgetMax}
                    onChange={(e) =>
                      update({ budgetMax: Number(e.target.value) })
                    }
                  />
                </label>
              </div>
            </div>
            <FieldMessages fields={fields} prefix="budgetMin" />
            <FieldMessages fields={fields} prefix="budgetMax" />
            <div className={styles.inline}>
              <span className={styles.inlineLabel} id="lookback-label">
                Compare against prices from the last
              </span>
              <span
                role="group"
                aria-labelledby="lookback-label"
                className="seg-group"
              >
                {LOOKBACKS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="seg"
                    aria-pressed={preference.lookbackMonths === m}
                    aria-label={`Last ${m} complete months`}
                    onClick={() => {
                      tick();
                      update({ lookbackMonths: m });
                    }}
                  >
                    {m}
                  </button>
                ))}
              </span>
              <span className={styles.inlineLabel}>months</span>
            </div>
          </Question>

          <Question
            index={2}
            title="Which layouts work for you?"
            aside={<span className="chip chip--soft">Pick any</span>}
          >
            <div className={styles.tiles5}>
              {flatTypes.map((type) => {
                const on = preference.flatTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.tile} ${styles.planTile}`}
                    aria-pressed={on}
                    onClick={() => {
                      tick();
                      update({
                        flatTypes: on
                          ? preference.flatTypes.filter((x) => x !== type)
                          : [...preference.flatTypes, type],
                      });
                    }}
                  >
                    <span className={styles.plan} aria-hidden="true">
                      {PLANS[type].rooms.map(([l, t, w, h], i) => (
                        <span
                          key={i}
                          style={{
                            left: `${l}%`,
                            top: `${t}%`,
                            width: `${w}%`,
                            height: `${h}%`,
                            background: on
                              ? i === 0
                                ? "var(--amber)"
                                : "#FFD08A"
                              : "transparent",
                          }}
                        />
                      ))}
                    </span>
                    <span className={styles.tileText}>
                      <span className={styles.tileTitle}>{type}</span>
                      <span className={styles.size}>{PLANS[type].size}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {privateHousing && (
              <p className={styles.note}>
                Flat types are used as HDB comparison evidence only.
              </p>
            )}
            <FieldMessages fields={fields} prefix="flatTypes" />
          </Question>

          <Question
            index={3}
            title="Where do you go every week?"
            aside={
              <span className="chip chip--soft">
                {preference.destinations.length} of {LIMITS.destinations} places
              </span>
            }
          >
            <div className={styles.dests}>
              {preference.destinations.map((d, index) => (
                <div key={index} className={styles.dest}>
                  <div className={styles.destTop}>
                    <span className={styles.pin} aria-hidden="true">
                      <MapPin />
                    </span>
                    <label htmlFor={`place-${index}`} className="sr-only">
                      Destination {index + 1} location
                    </label>
                    <input
                      id={`place-${index}`}
                      className={styles.field}
                      value={d.query}
                      placeholder="Building, MRT station or postal code"
                      onChange={(e) => onQueryChange(index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onSearch(index);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className={styles.round}
                      disabled={searching !== null}
                      aria-label={`Search destination ${index + 1}`}
                      title="Search locations"
                      onClick={() => onSearch(index)}
                    >
                      <Search aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className={styles.round}
                      aria-label={`Remove destination ${index + 1}`}
                      title="Remove destination"
                      disabled={preference.destinations.length === 1}
                      onClick={() => onRemoveDestination(index)}
                    >
                      <X aria-hidden="true" />
                    </button>
                  </div>
                  {d.location ? (
                    <span className={styles.resolved}>
                      <CheckCircle2 aria-hidden="true" />
                      {d.location.source === "fixture"
                        ? "Sample location selected"
                        : "OneMap location selected"}
                    </span>
                  ) : (
                    <span className={styles.hint}>
                      Search and select a location to confirm it.
                    </span>
                  )}
                  {searchError[index] && (
                    <p className={styles.fieldError} role="alert">
                      {searchError[index]}
                    </p>
                  )}
                  {!!candidates[index]?.length && (
                    <div
                      className={styles.matches}
                      role="group"
                      aria-label="Location matches"
                    >
                      {candidates[index].map((loc) => (
                        <button
                          type="button"
                          key={loc.id}
                          className={styles.match}
                          onClick={() => {
                            tick();
                            onSelectLocation(index, loc);
                          }}
                        >
                          <MapPin aria-hidden="true" />
                          {loc.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <FieldMessages
                    fields={fields}
                    prefix={`destinations.${index}`}
                  />
                  <div className={styles.destBottom}>
                    <span className={styles.stepper}>
                      <button
                        type="button"
                        className={styles.round}
                        aria-label={`Fewer trips to destination ${index + 1}`}
                        disabled={d.visits <= 1}
                        onClick={() =>
                          update({
                            destinations: preference.destinations.map((x, i) =>
                              i === index
                                ? { ...x, visits: Math.max(1, x.visits - 1) }
                                : x,
                            ),
                          })
                        }
                      >
                        <Minus aria-hidden="true" />
                      </button>
                      <output
                        className={styles.count}
                        aria-label={`Destination ${index + 1} visits per week`}
                      >
                        {d.visits}
                      </output>
                      <button
                        type="button"
                        className={styles.round}
                        aria-label={`More trips to destination ${index + 1}`}
                        disabled={d.visits >= 21}
                        onClick={() =>
                          update({
                            destinations: preference.destinations.map((x, i) =>
                              i === index
                                ? { ...x, visits: Math.min(21, x.visits + 1) }
                                : x,
                            ),
                          })
                        }
                      >
                        <Plus aria-hidden="true" />
                      </button>
                      <span className={styles.inlineLabel}>trips a week</span>
                    </span>
                    <span
                      role="group"
                      aria-label={`Destination ${index + 1} travel by`}
                      className="seg-group"
                    >
                      {(["public", "private"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          className="seg"
                          aria-pressed={d.mode === m}
                          onClick={() => {
                            tick();
                            update({
                              destinations: preference.destinations.map(
                                (x, i) => (i === index ? { ...x, mode: m } : x),
                              ),
                            });
                          }}
                        >
                          {m === "public" ? "Public transport" : "Car"}
                        </button>
                      ))}
                    </span>
                  </div>
                </div>
              ))}
              {preference.destinations.length < LIMITS.destinations && (
                <button
                  type="button"
                  className={styles.add}
                  onClick={onAddDestination}
                >
                  + Add another place
                </button>
              )}
            </div>
          </Question>

          <Question
            index={4}
            title="What should be within reach?"
            aside={
              <span className="chip chip--soft">
                {preference.lifestyles.length} of {LIMITS.lifestyles} chosen
              </span>
            }
          >
            {full && (
              <p className={styles.note}>
                Six chosen. Skip one to choose another.
              </p>
            )}
            <div className={styles.amenities}>
              <span className={`chip ${styles.groupChip}`}>
                <span className="dot" />
                Everyday
              </span>
              {EVERYDAY.map(lifestyleRow)}
              <span className={`chip ${styles.groupChip}`}>
                <span className="dot" style={{ background: "var(--sage)" }} />
                Sports and fitness
              </span>
              {SPORTS.map(lifestyleRow)}
            </div>
            {notes.map((n) => (
              <p key={n} className={styles.note}>
                {n}
              </p>
            ))}
            <FieldMessages fields={fields} prefix="lifestyles" />
          </Question>

          <Question
            index={5}
            title="When it comes down to it, what matters most?"
          >
            <div
              className={styles.presets}
              role="group"
              aria-label="Weighting presets"
            >
              {WEIGHT_PRESETS.map((p, i) => (
                <button
                  key={p.label}
                  type="button"
                  className={styles.preset}
                  aria-pressed={presetIndex === i}
                  onClick={() => {
                    tick();
                    update({ weights: fitWeights(p.weights, hasLifestyles) });
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className={styles.weights} aria-hidden="true">
              {[
                {
                  label: "Getting around",
                  v: preference.weights.destination,
                  bg: "var(--pastel-pink)",
                },
                {
                  label: "Life nearby",
                  v: preference.weights.lifestyle,
                  bg: "var(--mint)",
                },
                {
                  label: "Value for money",
                  v: preference.weights.affordability,
                  bg: "var(--amber-soft)",
                },
              ].map((w) => (
                <div
                  key={w.label}
                  style={{ flexGrow: Math.max(w.v, 4), background: w.bg }}
                >
                  <b>{w.v}</b>
                  <span>{w.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.fine}>
              {(["destination", "lifestyle", "affordability"] as const).map(
                (key, i) => (
                  <div className={styles.fineRow} key={key}>
                    <label htmlFor={`weight-${key}`}>
                      {["Your journeys", "Your lifestyle", "Your budget"][i]}
                    </label>
                    <input
                      id={`weight-${key}`}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={preference.weights[key]}
                      onChange={(e) =>
                        update({
                          weights: {
                            ...preference.weights,
                            [key]: Number(e.target.value),
                          },
                        })
                      }
                    />
                    <output htmlFor={`weight-${key}`}>
                      {preference.weights[key]}%
                    </output>
                  </div>
                ),
              )}
              <span
                className={`chip ${total === 100 ? "chip--soft" : ""}`}
                style={
                  total === 100
                    ? undefined
                    : {
                        borderColor: "var(--coral)",
                        background: "var(--pastel-pink)",
                        color: "var(--navy)",
                      }
                }
              >
                {total === 100
                  ? "Adds up to 100%"
                  : `${total}% - adjust to 100%`}
              </span>
            </div>
            <FieldMessages fields={fields} prefix="weights" />
          </Question>

          <div className={styles.footer}>
            <span className="chip">
              <span className="dot" style={{ background: "var(--mint)" }} />
              {preview
                ? "Preview changes are not saved."
                : "Review before saving to your account."}
            </span>
            <button className="btn" type="submit">
              Review preferences
              <ArrowRight aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
