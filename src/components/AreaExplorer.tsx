"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  CircleDot,
  Layers,
  List,
  MapPin,
  RefreshCw,
  Route,
  Search,
} from "lucide-react";
import {
  explorationCatalogueSchema,
  explorationDetailsSchema,
  type ExplorationCatalogue,
  type ExplorationDetails,
} from "@/domain/exploration";
import { lifestyleCategories, type Profile } from "@/domain/preferences";
import {
  marketFiltersSchema,
  type MarketFilters,
} from "@/domain/marketEvidence.mjs";
import type { MapContext } from "./AreaMap";
import {
  amenityPresentation,
  destinationColor,
  radiusColor,
  routeColors,
} from "./amenityPresentation";
import { ListingLinks } from "./ListingLinks";
import { ErrorState, LoadingState } from "./states/States";
import styles from "./AreaExplorer.module.css";
const AreaMap = dynamic(() => import("./AreaMap"), {
  ssr: false,
  loading: () => <p role="status">Loading map...</p>,
});
const displayName = (name: string) =>
  name.toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
async function request(path: string, signal: AbortSignal, input?: unknown) {
  const response = await fetch(path, {
    signal,
    cache: "no-store",
    ...(input
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        }
      : {}),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.error?.message ?? "Area information is unavailable. Please retry.",
    );
  return body;
}
function validateDetails(
  raw: unknown,
  profile: Profile,
  areaId: string,
  radius: number,
) {
  const detail = explorationDetailsSchema.parse(raw);
  if (
    detail.profileId !== profile.id ||
    detail.profileRevision !== profile.revision ||
    detail.category !== profile.preference.category ||
    detail.facilities.origin.id !== areaId ||
    detail.facilities.radius !== radius
  )
    throw new Error(
      "The response does not match this profile and area. Please retry.",
    );
  return detail;
}
const safeMessage = (error: unknown) =>
  error instanceof Error && error.name !== "ZodError"
    ? error.message
    : "Area information could not be validated. Please retry.";
export function AreaExplorer({
  profile,
  theme,
  onBack,
  onRank,
}: {
  profile: Profile;
  theme: "light" | "dark";
  onBack: () => void;
  onRank: (filters: MarketFilters) => void;
}) {
  const [filters, setFilters] = useState<MarketFilters>(() =>
    marketFiltersSchema.parse({}),
  );
  const [filterError, setFilterError] = useState("");
  const [catalogue, setCatalogue] = useState<ExplorationCatalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueRetry, setCatalogueRetry] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState("details");
  const [categories, setCategories] = useState<string[]>(() =>
    profile.preference.lifestyles.map((p) => p.category),
  );
  const [radius, setRadius] = useState(1000);
  const [showRadii, setShowRadii] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [amenityRetry, setAmenityRetry] = useState(0);
  const [amenityResponse, setAmenityResponse] = useState<{
    key: string;
    data: ExplorationDetails | null;
    error: string;
  } | null>(null);
  const [journeyResponse, setJourneyResponse] = useState<{
    key: string;
    data: ExplorationDetails["journeys"];
    error: string;
  } | null>(null);
  const [journeyPending, setJourneyPending] = useState<string | null>(null);
  const journeyAbort = useRef<AbortController | null>(null);
  const selected =
    catalogue?.areas.find((a) => a.id === selection) ?? catalogue?.areas[0];
  const journeyKey = `${profile.id}:${profile.revision}:${selected?.id}`;
  const amenityKey = `${journeyKey}:${radius}:${amenityRetry}`;
  const amenities =
    amenityResponse?.key === amenityKey ? amenityResponse : null;
  const journeys = journeyResponse?.key === journeyKey ? journeyResponse : null;
  const routeLoading = journeyPending === journeyKey;
  useEffect(() => {
    const controller = new AbortController();
    void request("/api/exploration", controller.signal)
      .then((body) => {
        const data = explorationCatalogueSchema.parse(body.catalogue);
        if (!controller.signal.aborted) {
          setCatalogue(data);
          setCatalogueError("");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setCatalogueError(safeMessage(error));
      });
    return () => controller.abort();
  }, [catalogueRetry]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    void request("/api/exploration", controller.signal, {
      profileId: profile.id,
      revision: profile.revision,
      areaId: selected.id,
      radius,
      includeRoutes: false,
    })
      .then((body) => {
        const data = validateDetails(
          body.exploration,
          profile,
          selected.id,
          radius,
        );
        if (!controller.signal.aborted)
          setAmenityResponse({ key: amenityKey, data, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setAmenityResponse({
            key: amenityKey,
            data: null,
            error: safeMessage(error),
          });
      });
    return () => controller.abort();
  }, [profile, selected, radius, amenityKey]);
  useEffect(() => () => journeyAbort.current?.abort(), [journeyKey]);
  async function loadJourneys() {
    if (!selected || routeLoading) return;
    journeyAbort.current?.abort();
    const controller = new AbortController();
    journeyAbort.current = controller;
    setJourneyPending(journeyKey);
    try {
      const body = await request("/api/exploration", controller.signal, {
        profileId: profile.id,
        revision: profile.revision,
        areaId: selected.id,
        radius,
        includeRoutes: true,
      });
      const detail = validateDetails(
        body.exploration,
        profile,
        selected.id,
        radius,
      );
      if (!detail.journeys)
        throw new Error(
          "No complete journey response was returned. Please retry.",
        );
      if (!controller.signal.aborted)
        setJourneyResponse({
          key: journeyKey,
          data: detail.journeys,
          error: "",
        });
    } catch (error) {
      if (!controller.signal.aborted)
        setJourneyResponse({
          key: journeyKey,
          data: null,
          error: safeMessage(error),
        });
    } finally {
      if (journeyAbort.current === controller) setJourneyPending(null);
    }
  }
  const mapContext: MapContext = useMemo(
    () => ({
      preference: profile.preference,
      results: (catalogue?.areas ?? []).map((area) => ({
        area,
        routes: area.id === selected?.id ? (journeys?.data?.routes ?? []) : [],
      })),
    }),
    [catalogue, profile, selected?.id, journeys?.data],
  );
  const visible = (catalogue?.areas ?? []).filter((area) =>
    area.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const choose = (id: string) => {
    setSelection(id);
    setPanel("details");
  };
  const toggle = (category: string) =>
    setCategories((values) =>
      values.includes(category)
        ? values.filter((v) => v !== category)
        : [...values, category],
    );
  return (
    <div className={styles.explorer}>
      <header className={styles.toolbar}>
        <button onClick={onBack}>
          <ArrowLeft /> My profiles
        </button>
        <div>
          <h1>Explore areas</h1>
          <p>
            {profile.preference.category} · {profile.preference.name}
          </p>
        </div>
      </header>
      <div className={styles.scope}>
        <strong>Neighbourhood context only</strong>
        <p>
          {catalogue?.areas.length ?? "Imported"} town-level MRT reference
          points, not BTO projects or individual homes. Budget and weights do
          not filter or rank this view. No price, eligibility or availability
          assessment.
        </p>
      </div>
      <form
        className={styles.rankingFilters}
        aria-label="Price ranking filters"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = marketFiltersSchema.safeParse(filters);
          if (!parsed.success) {
            setFilterError("Enter a valid area range before ranking.");
            return;
          }
          setFilterError("");
          onRank(parsed.data);
        }}
      >
        {profile.preference.category === "BTO" ? (
          <>
            <label className={styles.archive}>
              <input
                type="checkbox"
                checked={filters.includeClosedLaunches}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    includeClosedLaunches: e.target.checked,
                  })
                }
              />
              Include closed launches for historical research
            </label>
            <p>
              Source catalogue: June 2026. Applications closed 24 June. Prices
              before grants; town reference points, not project entrances.
            </p>
          </>
        ) : (
          <>
            <label>
              Minimum area (sqm)
              <input
                type="number"
                min="0"
                max="20000"
                value={filters.minAreaSqm}
                onChange={(e) =>
                  setFilters({ ...filters, minAreaSqm: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Maximum area (sqm)
              <input
                type="number"
                min="1"
                max="20000"
                value={filters.maxAreaSqm}
                onChange={(e) =>
                  setFilters({ ...filters, maxAreaSqm: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Area basis
              <select
                  aria-label="Area basis"
                value={filters.areaType}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    areaType: e.target.value as MarketFilters["areaType"],
                  })
                }
              >
                <option value="Any">All reported area types</option>
                <option value="Strata">Strata area</option>
                <option value="Land">Land area</option>
              </select>
            </label>
            <label>
              Sale type
              <select
                  aria-label="Sale type"
                value={filters.saleType}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    saleType: e.target.value as MarketFilters["saleType"],
                  })
                }
              >
                <option value="Any">All sale types</option>
                <option value="1">New sale</option>
                <option value="2">Sub-sale</option>
                <option value="3">Resale</option>
              </select>
            </label>
            <p>
              URA single-unit transactions by postal district. HDB room
              selections are not private bedroom filters. Executive condominiums
              are excluded.
            </p>
          </>
        )}
        <button type="submit">
          <List />
          {profile.preference.category === "BTO"
            ? "Rank BTO launch areas"
            : "Rank private districts"}
        </button>
        {filterError && <p role="alert">{filterError}</p>}
      </form>
      {catalogueError ? (
        <ErrorState title="Areas could not be loaded" body={catalogueError}>
          <button
            onClick={() => {
              setCatalogueError("");
              setCatalogueRetry((n) => n + 1);
            }}
          >
            <RefreshCw /> Retry area catalogue
          </button>
        </ErrorState>
      ) : !catalogue || !selected ? (
        <LoadingState
          title="Loading imported areas..."
          messages={["Placing every town on the map…"]}
        />
      ) : (
        <div className={styles.workspace}>
          <div className={styles.mapCanvas}>
            <AreaMap
              discovery={mapContext}
              selected={selected.id}
              onSelect={choose}
              showRoutes={showRoutes}
              categories={categories}
              showRadii={showRadii}
              theme={theme}
              markerMode="area"
              visibleAreas={visible.map((area) => area.id)}
              browsing={amenities?.data?.facilities ?? null}
              browseRadius={radius}
            />
          </div>
          <aside
            className={styles.areaPane}
            data-active={panel !== "details"}
            aria-label={
              panel === "layers" ? "Exploration layers" : "Explore town list"
            }
          >
            {panel === "layers" ? (
              <>
                <h2>Map layers</h2>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showRadii}
                    onChange={(event) => setShowRadii(event.target.checked)}
                  />
                  <CircleDot /> Geographic radius
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    checked={showRoutes}
                    onChange={(event) => setShowRoutes(event.target.checked)}
                  />
                  <Route /> Journeys
                </label>
                <label className={styles.radius}>
                  Explore radius
                  <select
                    aria-label="Exploration radius"
                    value={radius}
                    onChange={(event) => setRadius(Number(event.target.value))}
                  >
                    {[500, 1000, 2000, 3000, 5000].map((m) => (
                      <option key={m} value={m}>
                        {m.toLocaleString()} m
                      </option>
                    ))}
                  </select>
                </label>
                {lifestyleCategories.map((category) => {
                  const presentation = amenityPresentation[category];
                  const Icon = presentation.icon;
                  const layer = amenities?.data?.facilities.layers.find(
                    (l) => l.category === category,
                  );
                  return (
                    <label className={styles.toggle} key={category}>
                      <input
                        type="checkbox"
                        aria-label={presentation.label}
                        checked={categories.includes(category)}
                        onChange={() => toggle(category)}
                      />
                      <Icon style={{ color: presentation.color }} />
                      <span>{presentation.label}</span>
                      <small>
                        {layer
                          ? layer.available
                            ? layer.count
                            : "Unavailable"
                          : "..."}
                      </small>
                    </label>
                  );
                })}
                <p className={styles.muted}>
                  Distances are geographic, not walking routes. Restricted
                  sports venues and incomplete grocery coverage are included in
                  the imported sources.
                </p>
              </>
            ) : (
              <>
                <h2>{catalogue.areas.length} imported areas</h2>
                <label className={styles.search}>
                  <Search />
                  <input
                    type="search"
                    aria-label="Filter exploration towns"
                    placeholder="Search a town"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <div className={styles.towns}>
                  {visible.map((area) => (
                    <button
                      key={area.id}
                      aria-pressed={selected.id === area.id}
                      onClick={() => choose(area.id)}
                    >
                      <MapPin />
                      <span>
                        {displayName(area.name)}
                        <small>{area.originLabel}</small>
                      </span>
                    </button>
                  ))}
                  {!visible.length && <p>No towns match this search.</p>}
                </div>
              </>
            )}
          </aside>
          <section
            className={styles.detailPane}
            data-active={panel === "details"}
            aria-label="Exploration area details"
          >
            <h2>{displayName(selected.name)}</h2>
            <p className={styles.origin}>
              {selected.originLabel} · representative origin
            </p>
            <div
              className={styles.legend}
              role="region"
              aria-label="Exploration legend"
            >
              <span>
                <i style={{ background: "#448ea5" }} />
                A: town reference points
              </span>
              <span>
                <i style={{ background: destinationColor }} />
                D: your destinations
              </span>
              {showRadii && (
                <span>
                  <i style={{ background: radiusColor }} />
                  Geographic radius
                </span>
              )}
              {showRoutes && journeys?.data && (
                <span>
                  <i style={{ background: routeColors[0] }} />
                  OneMap journeys
                </span>
              )}
              {categories.map((category) => (
                <span key={category}>
                  <i
                    style={{
                      background:
                        amenityPresentation[
                          category as keyof typeof amenityPresentation
                        ].color,
                    }}
                  />
                  {
                    amenityPresentation[
                      category as keyof typeof amenityPresentation
                    ].label
                  }
                </span>
              ))}
            </div>
            <h3>Nearby amenities</h3>
            {!amenities ? (
              <p role="status">Loading nearby amenities...</p>
            ) : amenities.error ? (
              <div role="alert">
                <p>{amenities.error}</p>
                <button onClick={() => setAmenityRetry((n) => n + 1)}>
                  <RefreshCw /> Retry amenities
                </button>
              </div>
            ) : (
              <>
                {amenities.data?.facilities.layers
                  .filter((layer) => categories.includes(layer.category))
                  .map((layer) => (
                    <details key={layer.category} className={styles.amenity}>
                      <summary>
                        <i
                          style={{
                            background:
                              amenityPresentation[layer.category].color,
                          }}
                        />
                        {amenityPresentation[layer.category].label}
                        <small>
                          {layer.available ? layer.count : "Unavailable"}
                        </small>
                      </summary>
                      {layer.facilities.map((facility, index) => (
                        <p key={index}>
                          {facility.name}
                          <small>
                            {Math.round(facility.metres)} m geographic distance
                            {facility.sportType
                              ? ` · ${facility.sportType}`
                              : ""}
                          </small>
                        </p>
                      ))}
                      {layer.available && !layer.count && (
                        <p>
                          No points in the imported layer within this radius.
                        </p>
                      )}
                      {layer.truncated && (
                        <p>
                          Showing the nearest 100 of {layer.count} imported
                          points.
                        </p>
                      )}
                      {layer.source && (
                        <p className={styles.muted}>
                          Source recorded{" "}
                          {new Date(layer.source.updatedAt).toLocaleDateString(
                            "en-SG",
                          )}
                          . {layer.source.coverage}
                        </p>
                      )}
                    </details>
                  ))}
                {!categories.length && <p>No amenity layers selected.</p>}
                <p className={styles.muted}>
                  Imported{" "}
                  {new Date(
                    amenities.data!.facilities.fetchedAt,
                  ).toLocaleDateString("en-SG")}
                  . Source availability is not public access or booking
                  availability.
                </p>
              </>
            )}
            <section
              className={styles.journeys}
              aria-label="Exploration journeys"
            >
              <h3>Your journeys</h3>
              <button disabled={routeLoading} onClick={loadJourneys}>
                <Route />
                {routeLoading
                  ? "Loading journeys..."
                  : journeys?.error
                    ? "Retry journeys"
                    : journeys?.data
                      ? "Refresh journeys"
                      : "Load journeys"}
              </button>
              {journeys?.error && <p role="alert">{journeys.error}</p>}
              {journeys?.data?.routes.map((route, index) => (
                <p key={index}>
                  <strong>{route.destination}</strong>
                  <small>
                    {route.minutes.toFixed(1)} min ·{" "}
                    {(route.metres / 1000).toFixed(1)} km ·{" "}
                    {route.mode === "public" ? "Public transport" : "Driving"} ·{" "}
                    {route.visits} visits/week
                  </small>
                </p>
              ))}
              {journeys?.data ? (
                <p className={styles.muted}>
                  Estimate for {journeys.data.departure.slice(0, 10)} at 08:00
                  Singapore time, from this representative origin. No
                  suitability score is calculated.
                </p>
              ) : (
                <p className={styles.muted}>
                  Journeys are requested only when you choose to load them.
                  Destinations are sent to OneMap, not listing sites.
                </p>
              )}
            </section>
            <ListingLinks
              category={profile.preference.category}
              areaName={displayName(selected.name)}
            />
          </section>
          <nav className={styles.controls} aria-label="Exploration panels">
            <button
              aria-pressed={panel === "areas"}
              onClick={() => setPanel("areas")}
            >
              <List /> Areas
            </button>
            <button
              aria-pressed={panel === "details"}
              onClick={() => setPanel("details")}
            >
              <MapPin /> Details
            </button>
            <button
              aria-pressed={panel === "layers"}
              onClick={() => setPanel("layers")}
            >
              <Layers /> Layers
            </button>
          </nav>
        </div>
      )}
    </div>
  );
}
