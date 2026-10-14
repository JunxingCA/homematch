"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  ArrowRight,
  Map,
  List,
  RefreshCw,
  Route,
  Bookmark,
  BookmarkCheck,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Layers,
  Scale,
} from "lucide-react";
import type { AreaResult, Discovery } from "@/domain/recommendations";
import { priceHeading, priceRange } from "@/domain/recommendations";
import type { SavedArea } from "@/domain/shortlist";
import styles from "./RecommendationResults.module.css";
import { lifestyleCategories } from "@/domain/preferences";
import {
  amenityPresentation,
  destinationColor,
  radiusColor,
  routeColors,
} from "./amenityPresentation";
import { useMapFacilities } from "./useMapFacilities";
import { ListingLinks } from "./ListingLinks";
const AreaMap = dynamic(() => import("./AreaMap"), {
  ssr: false,
  loading: () => <div className={styles.map}>Loading map...</div>,
});
const money = (n: number) =>
  new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency: "SGD",
    maximumFractionDigits: 0,
  }).format(n);
const town = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const score = (n: number | null) =>
  n === null ? "Not contributing" : n.toFixed(1);

export function RecommendationResults({
  discovery,
  loading,
  onBack,
  onRetry,
  savedAreas,
  saving,
  shortlistReady,
  initialArea,
  onToggleSave,
  backLabel = "My profiles",
  theme,
}: {
  discovery: Discovery | null;
  loading: boolean;
  onBack: () => void;
  onRetry: () => void;
  savedAreas: SavedArea[];
  saving: boolean;
  shortlistReady: boolean;
  initialArea?: string;
  onToggleSave: (areaId: string) => void;
  backLabel?: string;
  theme: "light" | "dark";
}) {
  const [selection, setSelection] = useState<string | null>(
    initialArea ?? null,
  );
  const [view, setView] = useState("map");
  const [showRoutes, setShowRoutes] = useState(true);
  const [categories, setCategories] = useState<
    (typeof lifestyleCategories)[number][]
  >(() => discovery?.preference.lifestyles.map((l) => l.category) ?? []);
  const [showRadii, setShowRadii] = useState(true);
  const [markerMode, setMarkerMode] = useState<"score" | "median">("score");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("match");
  const [panel, setPanel] = useState("details");
  const [collapsed, setCollapsed] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [browseRadius, setBrowseRadius] = useState(1000);
  const [compare, setCompare] = useState<string[]>([]),
    [comparison, setComparison] = useState(false);
  const selected =
    discovery?.results.find((r) => r.area.id === selection) ??
    discovery?.results[0];
  const browsing = useMapFacilities(
    discovery?.id,
    selected?.area.id,
    browseRadius,
  );
  const toggleCategory = (category: (typeof lifestyleCategories)[number]) =>
    setCategories((ids) =>
      ids.includes(category)
        ? ids.filter((id) => id !== category)
        : [...ids, category],
    );
  const detailRef = useRef<HTMLElement>(null);
  useEffect(() => {
    detailRef.current?.scrollTo({ top: 0 });
  }, [selected?.area.id]);
  const choose = (id: string) => {
    setSelection(id);
    setPanel("details");
    setCollapsed(false);
  };
  if (loading)
    return (
      <div className={styles.loading} role="status">
        <RefreshCw className={styles.spin} />
        <h2>Finding areas that fit</h2>
        <p>
          Checking historical prices, your journeys, and nearby amenities across
          Singapore.
        </p>
      </div>
    );
  if (!discovery)
    return (
      <div className={styles.empty}>
        <h2>Your search is ready to retry</h2>
        <p>Your saved preferences are unchanged.</p>
        <button onClick={onRetry}>
          <RefreshCw /> Retry search
        </button>
        <button onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </button>
      </div>
    );
  const compared = discovery.results.filter((r) => compare.includes(r.area.id));
  const visible = discovery.results
    .filter((r) =>
      r.area.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .toSorted((a, b) =>
      sort === "journey"
        ? a.weightedMinutes - b.weightedMinutes
        : sort === "median"
          ? a.median - b.median
          : b.overall - a.overall,
    );
  return (
    <div className={`${styles.results} ${styles.mapResults}`}>
      <div className={styles.toolbar}>
        <button onClick={onBack}>
          <ArrowLeft /> {backLabel}
        </button>
        <div className={styles.searchTitle}>
          <h1>Your area matches</h1>
          <span>
            {discovery.preference.category} · {discovery.preference.name}
          </span>
        </div>
        <div className={styles.actions}>
          <button onClick={onRetry} title="Recalculate with current evidence">
            <RefreshCw />
            <span className={styles.refreshLabel}>Refresh search</span>
          </button>
          <button
            disabled={compared.length < 2}
            onClick={() => setComparison(!comparison)}
          >
            <Scale />
            {comparison ? "Back to matches" : `Compare (${compared.length}/3)`}
          </button>
        </div>
      </div>
      {discovery.market && (
        <p className={styles.marketNotice} role="note">
          {discovery.market.coverage}
        </p>
      )}
      <div className={styles.workspace} data-view={view}>
        {!discovery.results.length ? (
          <div className={styles.empty}>
            <h2>No areas have enough evidence</h2>
            <p>
              {discovery.market?.kind === "bto"
                ? "No projects in the imported catalogue match the launch status and selected flat types. Closed launches require the historical-research option in Explore areas."
                : "Try a longer lookback or broader size filters. Each area needs at least five matching transactions."}
            </p>
            {discovery.excluded.length > 0 && (
              <ul>
                {discovery.excluded.map((x) => (
                  <li key={x.area}>
                    {town(x.area)}: {x.reason}
                  </li>
                ))}
              </ul>
            )}
            <button onClick={onBack}>
              <ArrowLeft /> Adjust preferences
            </button>
          </div>
        ) : (
          <>
            {comparison && (
              <div
                className={styles.comparisonOverlay}
                role="region"
                aria-label="Area comparison"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setComparison(false);
                }}
              >
                <button
                  className={styles.closeComparison}
                  onClick={() => setComparison(false)}
                  aria-label="Close comparison"
                  title="Close comparison"
                  autoFocus
                >
                  <X />
                </button>
                <div className={styles.tableWrap}>
                  <table>
                    <caption>Comparison from this saved search</caption>
                    <thead>
                      <tr>
                        <th>Evidence</th>
                        {compared.map((r) => (
                          <th key={r.area.id}>{town(r.area.name)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Overall match", (r) => score(r.overall)],
                          ["Journey score", (r) => score(r.destinationScore)],
                          ["Lifestyle score", (r) => score(r.lifestyleScore)],
                          ["Budget score", (r) => score(r.affordabilityScore)],
                          [
                            "Weighted journey",
                            (r) => `${r.weightedMinutes.toFixed(1)} min`,
                          ],
                          [
                            discovery.market?.kind === "bto"
                              ? "Published upper bound"
                              : "Historical median",
                            (r) => money(r.median),
                          ],
                          [
                            discovery.market?.kind === "bto"
                              ? "Published price range"
                              : "Price quartiles",
                            (r) =>
                              `${money(priceRange(r).min)}–${money(priceRange(r).max)}`,
                          ],
                          [
                            "Transactions",
                            (r) =>
                              r.priceEvidence?.kind === "bto-range"
                                ? "Not transaction data"
                                : String(r.transactions),
                          ],
                          [
                            "Within budget",
                            (r) =>
                              r.priceEvidence?.kind === "bto-range"
                                ? `${r.affordabilityScore.toFixed(1)}% range coverage`
                                : `${r.withinBudget}/${r.transactions}`,
                          ],
                        ] as [string, (r: AreaResult) => string][]
                      ).map(([label, format]) => (
                        <tr key={label}>
                          <th>{label}</th>
                          {compared.map((r) => (
                            <td key={r.area.id}>{format(r)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className={styles.mapControls} inert={comparison}>
              <div className={styles.viewButtons}>
                <button
                  aria-pressed={view === "map"}
                  onClick={() => setView("map")}
                >
                  <Map /> Map
                </button>
                <button
                  aria-pressed={view === "list"}
                  onClick={() => setView("list")}
                >
                  <List /> List
                </button>
              </div>
              <button
                aria-expanded={layersOpen}
                onClick={() => setLayersOpen(!layersOpen)}
              >
                <Layers /> Layers
              </button>
            </div>
            {view === "map" && (
              <div
                className={styles.quickLayers}
                role="toolbar"
                aria-label="Explore amenities"
                inert={comparison}
              >
                {lifestyleCategories.map((category) => {
                  const {
                    icon: Icon,
                    color,
                    label,
                  } = amenityPresentation[category];
                  const layer = browsing.data?.layers.find(
                    (l) => l.category === category,
                  );
                  return (
                    <button
                      key={category}
                      title={`${label}${layer ? ` · ${layer.available ? `${layer.count} nearby` : "not imported"}` : ""}`}
                      aria-label={`Show ${label}`}
                      aria-pressed={categories.includes(category)}
                      disabled={layer?.available === false}
                      onClick={() => toggleCategory(category)}
                    >
                      <Icon />
                      <i style={{ background: color }} />
                    </button>
                  );
                })}
              </div>
            )}
            {view === "map" && (
              <div
                className={styles.mapLegend}
                role="region"
                aria-label="Map legend"
                inert={comparison}
              >
                <span>
                  <b
                    className={styles.destinationSwatch}
                    style={{ background: destinationColor }}
                  >
                    D
                  </b>
                  <span>Your destination</span>
                </span>
                {showRoutes && (
                  <span>
                    <i
                      className={styles.lineSwatch}
                      style={{ borderColor: routeColors[0] }}
                    />
                    Routes
                  </span>
                )}
                {showRadii && (
                  <span>
                    <i
                      className={styles.ringSwatch}
                      style={{ borderColor: radiusColor }}
                    />
                    {browseRadius / 1000} km radius
                  </span>
                )}
                {categories.map((category) => (
                  <span key={category}>
                    <i
                      className={styles.dotSwatch}
                      style={{
                        background: amenityPresentation[category].color,
                      }}
                    />
                    {amenityPresentation[category].label}
                  </span>
                ))}
              </div>
            )}
            {(browsing.loading || browsing.error) && (
              <div
                className={styles.browseStatus}
                role="status"
                inert={comparison}
              >
                {browsing.loading ? (
                  "Loading nearby amenities…"
                ) : (
                  <>
                    <span>{browsing.error} Saved scores are unchanged.</span>
                    <button onClick={browsing.retry}>
                      <RefreshCw /> Retry amenities
                    </button>
                  </>
                )}
              </div>
            )}
            {layersOpen && (
              <div
                className={styles.layers}
                role="region"
                aria-label="Map layers"
              >
                <div className={styles.layerHeading}>
                  <strong>Map layers</strong>
                  <button
                    onClick={() => setLayersOpen(false)}
                    title="Close map layers"
                    aria-label="Close map layers"
                  >
                    <X />
                  </button>
                </div>
                <p className={styles.exploreNote}>
                  Explore nearby · does not change your scores
                </p>
                <label className={styles.exploreRadius}>
                  Explore radius{" "}
                  <select
                    aria-label="Explore radius"
                    value={browseRadius}
                    onChange={(e) => setBrowseRadius(Number(e.target.value))}
                  >
                    {[1000, 2000, 3000, 5000].map((radius) => (
                      <option key={radius} value={radius}>
                        {radius / 1000} km
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(e) => setShowRoutes(e.target.checked)}
                  />
                  <span
                    className={styles.lineSwatch}
                    style={{ borderColor: routeColors[0] }}
                  />
                  <Route /> Routes
                </label>
                {selected?.routes.map((r, i) => (
                  <div key={i} className={styles.routeLegend}>
                    <span
                      className={styles.lineSwatch}
                      style={{
                        borderColor: routeColors[i % routeColors.length],
                      }}
                    />
                    <span>{r.destination}</span>
                  </div>
                ))}
                <label>
                  <input
                    type="checkbox"
                    checked={showRadii}
                    onChange={(e) => setShowRadii(e.target.checked)}
                  />
                  <span
                    className={styles.ringSwatch}
                    style={{ borderColor: radiusColor }}
                  />
                  <CircleDot /> Geographic radii
                </label>
                <div className={styles.destinationLegend}>
                  <span
                    className={styles.destinationSwatch}
                    style={{ background: destinationColor }}
                  >
                    D
                  </span>
                  <span>Your destination</span>
                </div>
                {lifestyleCategories.map((category) => {
                  const {
                    icon: Icon,
                    color,
                    label,
                  } = amenityPresentation[category];
                  const layer = browsing.data?.layers.find(
                    (l) => l.category === category,
                  );
                  return (
                    <label key={category} title={layer?.source?.coverage}>
                      <input
                        type="checkbox"
                        checked={categories.includes(category)}
                        disabled={layer?.available === false}
                        onChange={() => toggleCategory(category)}
                      />
                      <i
                        className={styles.dotSwatch}
                        style={{ background: color }}
                      />
                      <Icon />
                      {label}
                      <small>
                        {layer
                          ? layer.available
                            ? `${layer.count}${layer.truncated ? " (100 shown)" : ""}`
                            : "Not imported"
                          : "…"}
                      </small>
                    </label>
                  );
                })}
                <p>
                  Counts use geographic distance from the selected MRT origin,
                  not walking distance. Sports may be private or school
                  facilities; access and bookings are unverified. Hospitals
                  only; groceries coverage is partial.
                </p>
                {browsing.data && (
                  <details className={styles.browseSources}>
                    <summary>Exploration sources</summary>
                    <p>
                      Imported{" "}
                      {new Date(browsing.data.fetchedAt).toLocaleDateString(
                        "en-SG",
                      )}
                      . Saved score evidence can use an earlier snapshot.
                    </p>
                    {browsing.data.layers.map(
                      (layer) =>
                        layer.source && (
                          <p key={layer.category}>
                            <strong>
                              {amenityPresentation[layer.category].label}
                            </strong>{" "}
                            · {layer.source.coverage}
                            {layer.source.sourceUrl && (
                              <>
                                {" "}
                                <a
                                  href={layer.source.sourceUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Source
                                </a>
                              </>
                            )}
                          </p>
                        ),
                    )}
                  </details>
                )}
                <div
                  className={styles.markerMode}
                  aria-label="Map marker values"
                >
                  <button
                    aria-pressed={markerMode === "score"}
                    onClick={() => setMarkerMode("score")}
                  >
                    Match score
                  </button>
                  <button
                    aria-pressed={markerMode === "median"}
                    onClick={() => setMarkerMode("median")}
                  >
                    {discovery.market?.kind === "bto"
                      ? "Quoted upper bound"
                      : "Historical median"}
                  </button>
                </div>
              </div>
            )}
            <div
              className={styles.mapCanvas}
              hidden={view !== "map"}
              inert={comparison}
            >
              {selected && (
                <AreaMap
                  discovery={discovery}
                  selected={selected.area.id}
                  onSelect={choose}
                  showRoutes={showRoutes}
                  categories={categories}
                  showRadii={showRadii}
                  theme={theme}
                  markerMode={markerMode}
                  visibleAreas={visible.map((r) => r.area.id)}
                  browsing={browsing.data}
                  browseRadius={browseRadius}
                />
              )}
            </div>
            <div
              className={styles.body}
              data-panel={panel}
              data-collapsed={collapsed}
              inert={comparison}
            >
              <div className={styles.trayTabs}>
                <button
                  aria-pressed={panel === "matches" && !collapsed}
                  onClick={() => {
                    setPanel("matches");
                    setCollapsed(false);
                  }}
                >
                  <List /> Matches ({visible.length})
                </button>
                <button
                  aria-pressed={panel === "details" && !collapsed}
                  onClick={() => {
                    setPanel("details");
                    setCollapsed(false);
                  }}
                >
                  Area details
                </button>
                <button
                  title={collapsed ? "Expand panels" : "Collapse panels"}
                  aria-label={collapsed ? "Expand panels" : "Collapse panels"}
                  aria-expanded={!collapsed}
                  onClick={() => setCollapsed(!collapsed)}
                >
                  {collapsed ? <ChevronUp /> : <ChevronDown />}
                </button>
              </div>
              <div className={styles.matchTray}>
                <div className={styles.trayHeading}>
                  <span className={styles.eyebrow}>
                    Your neighbourhood shortlist
                  </span>
                  <h2>{visible.length} matching areas</h2>
                  <p>
                    {discovery.preference.flatTypes.join(", ")} ·{" "}
                    {money(discovery.preference.budgetMin)}–
                    {money(discovery.preference.budgetMax)}
                  </p>
                </div>
                <div className={styles.filters}>
                  <label className={styles.townSearch}>
                    <Search />
                    <input
                      type="search"
                      aria-label="Filter towns"
                      placeholder={
                        discovery.market
                          ? "Search a project or district"
                          : "Search a town"
                      }
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <label className={styles.sort}>
                    Sort by{" "}
                    <select
                      aria-label="Sort areas"
                      value={sort}
                      onChange={(e) => setSort(e.target.value)}
                    >
                      <option value="match">Best match</option>
                      <option value="journey">Shortest journey</option>
                      <option value="median">
                        {discovery.market?.kind === "bto"
                          ? "Lowest quoted upper bound"
                          : "Lowest historical median"}
                      </option>
                    </select>
                  </label>
                </div>
                <div
                  className={styles.list}
                  role="region"
                  aria-label="Ranked areas"
                >
                  {!visible.length && (
                    <div className={styles.filterEmpty}>
                      <p>No towns match “{query}”.</p>
                      <button onClick={() => setQuery("")}>Clear filter</button>
                    </div>
                  )}
                  {visible.map((r) => (
                    <article
                      key={r.area.id}
                      className={
                        r.area.id === selected?.area.id
                          ? styles.active
                          : undefined
                      }
                    >
                      <button
                        className={styles.row}
                        onClick={() => choose(r.area.id)}
                        aria-pressed={r.area.id === selected?.area.id}
                      >
                        <span className={styles.rank}>
                          {discovery.results.indexOf(r) + 1}
                        </span>
                        <div>
                          <h3>{town(r.area.name)}</h3>
                          <p>
                            {r.priceEvidence?.kind === "bto-range"
                              ? `${money(priceRange(r).min)}–${money(priceRange(r).max)} published range`
                              : `${money(r.median)} median · ${r.transactions} sales`}
                          </p>
                          <p>
                            {r.weightedMinutes.toFixed(1)} min weighted journey
                          </p>
                        </div>
                        <strong>
                          {r.overall.toFixed(1)}
                          <small>/100</small>
                        </strong>
                      </button>
                      <label className={styles.compare}>
                        <input
                          type="checkbox"
                          checked={compare.includes(r.area.id)}
                          disabled={
                            !compare.includes(r.area.id) && compare.length >= 3
                          }
                          onChange={(e) =>
                            setCompare((ids) =>
                              e.target.checked
                                ? [...ids, r.area.id]
                                : ids.filter((id) => id !== r.area.id),
                            )
                          }
                        />{" "}
                        Compare area
                      </label>
                    </article>
                  ))}
                </div>
                <p className={styles.trayFoot}>
                  {discovery.market?.kind === "bto"
                    ? "Published launch"
                    : "Historical sales"}{" "}
                  · through {discovery.latestMonth}
                  <br />
                  {discovery.market?.kind === "private"
                    ? "District scores"
                    : discovery.market?.kind === "bto"
                      ? "Launch area scores"
                      : "Town scores"}
                  , not individual property listings.
                </p>
              </div>
              {selected && (
                <section
                  ref={detailRef}
                  className={styles.detail}
                  aria-label="Area evidence"
                >
                  <p className={styles.eyebrow}>Why this area</p>
                  <h2>{town(selected.area.name)}</h2>
                  <p className={styles.areaSubtitle}>
                    {selected.area.originLabel} · representative origin
                  </p>
                  <div className={styles.heroMetrics}>
                    <strong>
                      {selected.overall.toFixed(1)}
                      <small>/100 match</small>
                    </strong>
                    <strong>
                      {money(selected.median)}
                      <small>{priceHeading(selected)}</small>
                    </strong>
                  </div>
                  <button
                    disabled={saving || !shortlistReady}
                    onClick={() => onToggleSave(selected.area.id)}
                    aria-pressed={savedAreas.some(
                      (s) => s.result.area.id === selected.area.id,
                    )}
                  >
                    {savedAreas.some(
                      (s) => s.result.area.id === selected.area.id,
                    ) ? (
                      <>
                        <BookmarkCheck /> Remove saved area
                      </>
                    ) : (
                      <>
                        <Bookmark /> Save area
                      </>
                    )}
                  </button>
                  {savedAreas
                    .filter((s) => s.result.area.id === selected.area.id)
                    .map((s) => (
                      <p key={s.id}>
                        Saved from {s.context.preference.name}, searched{" "}
                        {new Date(s.context.createdAt).toLocaleDateString(
                          "en-SG",
                        )}
                        .
                      </p>
                    ))}
                  <div className={styles.scores}>
                    {[
                      [
                        "Journeys",
                        selected.destinationScore,
                        discovery.preference.weights.destination,
                      ],
                      [
                        "Lifestyle",
                        selected.lifestyleScore,
                        discovery.preference.weights.lifestyle,
                      ],
                      [
                        "Budget",
                        selected.affordabilityScore,
                        discovery.preference.weights.affordability,
                      ],
                    ].map(([label, value, weight]) => (
                      <div key={String(label)}>
                        <span>{label}</span>
                        <strong>{score(value as number | null)}</strong>
                        <small>{weight}% weight</small>
                      </div>
                    ))}
                  </div>
                  {selected.priceEvidence?.kind === "bto-range" ? (
                    <>
                      <h3>Published launch price fit</h3>
                      <p>
                        {selected.priceEvidence.classification} ·{" "}
                        {selected.priceEvidence.waitingMonths} months estimated
                        waiting time at launch. Applications:{" "}
                        {selected.priceEvidence.applicationOpens} to{" "}
                        {selected.priceEvidence.applicationCloses}. Published
                        evidence is not proof of current unit availability.
                      </p>
                      <p>
                        {selected.affordabilityScore.toFixed(1)}% average
                        coverage of the selected published price ranges by your
                        budget. This is not the percentage of flats affordable,
                        an eligibility check, or a grant estimate. Lookback
                        months are not used for BTO.
                      </p>
                      <dl className={`${styles.prices} ${styles.quotedRanges}`}>
                        {selected.priceEvidence.ranges.map((range) => (
                          <div key={range.flatType}>
                            <dt>{range.flatType} · before grants</dt>
                            <dd>
                              {money(range.min)}–{money(range.max)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <>
                      <h3>Historical budget fit</h3>
                      <p>
                        {selected.withinBudget} of {selected.transactions}{" "}
                        matching transactions fall within your inclusive budget.
                        This is historical budget fit, not a prediction of
                        current listings.
                      </p>
                      <dl className={styles.prices}>
                        <div>
                          <dt>25th percentile</dt>
                          <dd>{money(selected.p25)}</dd>
                        </div>
                        <div>
                          <dt>Median</dt>
                          <dd>{money(selected.median)}</dd>
                        </div>
                        <div>
                          <dt>75th percentile</dt>
                          <dd>{money(selected.p75)}</dd>
                        </div>
                      </dl>
                    </>
                  )}
                  <h3>Your journeys</h3>
                  <p className={styles.origin}>
                    Origin: {selected.area.originLabel}
                  </p>
                  {selected.routes.map((r, i) => (
                    <div className={styles.evidence} key={i}>
                      <strong>{r.destination}</strong>
                      <span>
                        {r.minutes.toFixed(1)} min ·{" "}
                        {(r.metres / 1000).toFixed(1)} km ·{" "}
                        {r.mode === "public" ? "Public transport" : "Driving"} ·{" "}
                        {r.visits} visits/week
                      </span>
                    </div>
                  ))}
                  <h3>Life nearby</h3>
                  {discovery.facilitySources
                    .filter(
                      (s) =>
                        s.partial &&
                        selected.amenities.some(
                          (a) => a.category === s.category,
                        ),
                    )
                    .map((s) => (
                      <p key={s.category} role="note">
                        <strong>
                          Provisional {s.category.toLowerCase()} evidence.
                        </strong>{" "}
                        {s.coverage}
                      </p>
                    ))}
                  {discovery.facilitySources
                    .filter(
                      (s) =>
                        s.coverage &&
                        selected.amenities.some(
                          (a) => a.category === s.category,
                        ),
                    )
                    .map((s) => (
                      <p key={s.category}>{s.coverage}</p>
                    ))}
                  {selected.amenities.length ? (
                    selected.amenities.map((a) => (
                      <div className={styles.evidence} key={a.category}>
                        <strong>
                          {a.category} · {a.count} imported points within{" "}
                          {a.radius} m
                        </strong>
                        <span>
                          {a.nearest
                            ? `${a.nearest.name} · ${Math.round(a.nearest.metres)} m geographic distance`
                            : `No facilities in the imported layer within your radius.`}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p>No lifestyle preferences contribute to this search.</p>
                  )}
                  <ListingLinks
                    category={discovery.preference.category}
                    areaName={selected.area.name}
                  />
                  <p className={styles.context}>
                    {discovery.market?.kind === "bto"
                      ? `Published launch: ${discovery.latestMonth}; transaction lookback does not apply. Source published `
                      : `Historical evidence: ${discovery.fromMonth} to ${discovery.toMonthExclusive} (end month excluded). Imported `}
                    {new Date(discovery.fetchedAt).toLocaleDateString("en-SG")};
                    source covers through {discovery.latestMonth}. Routes use
                    {discovery.market?.kind === "private"
                      ? " means of matching URA project locations"
                      : " representative town MRT points"}
                    , not individual homes. Transit departure:{" "}
                    {discovery.departure.slice(0, 10)} at 08:00 Singapore time.
                  </p>
                  {discovery.excluded.length > 0 && (
                    <details>
                      <summary>
                        {discovery.excluded.length} areas excluded for
                        insufficient evidence
                      </summary>
                      <ul>
                        {discovery.excluded.map((x) => (
                          <li key={x.area}>
                            {town(x.area)}: {x.reason}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  <details className={styles.sources}>
                    <summary>
                      Sources and scoring assumptions <ArrowRight />
                    </summary>
                    <p>
                      <a
                        href={discovery.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {discovery.market?.kind === "bto"
                          ? "HDB BTO launch price annex"
                          : discovery.market?.kind === "private"
                            ? "URA private transaction source"
                            : "HDB resale transaction dataset"}
                      </a>{" "}
                      ·{" "}
                      <a
                        href="https://www.onemap.gov.sg/"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        OneMap, Singapore Land Authority
                      </a>
                      . Contains information made available under the Singapore
                      Open Data Licence.
                    </p>
                    <p>
                      Formula {discovery.formulaVersion}: journeys = 100 ×
                      max(0, 1 − weighted minutes / 90); lifestyle uses
                      nearest-facility geographic distance and priority; budget
                      ={" "}
                      {discovery.market?.kind === "bto"
                        ? "average proportion of published price ranges covered by your budget, not a unit count"
                        : "percentage of historical sales in range"}
                      . Your three weights combine these scores. The 90-minute
                      scale is HomeMatch’s provisional research assumption.
                    </p>
                    {discovery.facilitySources.map((s) => (
                      <p key={s.category}>
                        {s.category} layer{" "}
                        {s.dateKind === "retrieved" ? "retrieved" : "updated"}:{" "}
                        {new Date(s.updatedAt).toLocaleDateString("en-SG")}
                        {s.sourceUrl && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href={s.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Dataset
                            </a>
                          </>
                        )}
                        {s.coverage && <> · {s.coverage}</>}
                      </p>
                    ))}
                    <p>
                      Saved search:{" "}
                      {new Date(discovery.createdAt).toLocaleString("en-SG")} ·{" "}
                      {discovery.id}
                    </p>
                  </details>
                </section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
