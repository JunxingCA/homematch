"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import { LocateFixed, Maximize, Minus, Plus, RefreshCw } from "lucide-react";
import type { Area, RouteEvidence } from "@/domain/recommendations";
import type { Preference } from "@/domain/preferences";
import "leaflet/dist/leaflet.css";
import styles from "./AreaMap.module.css";
import type { MapFacilities } from "@/domain/mapFacilities";
import {
  amenityPresentation,
  radiusColor,
  routeColors,
} from "./amenityPresentation";

export type MapContext = {
  results: {
    area: Area;
    routes: RouteEvidence[];
    overall?: number;
    median?: number;
    priceEvidence?: { kind: string };
  }[];
  preference: Pick<Preference, "destinations">;
};
const escapeMarkup = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

function View({
  discovery,
  selected,
  wideMarkers,
}: {
  discovery: MapContext;
  selected: string;
  wideMarkers: boolean;
}) {
  const map = useMap();
  const previous = useRef(selected);
  const fittedAreas = useRef("");
  const fit = useCallback(() => {
    const size = map.getSize();
    map.fitBounds(
      discovery.results.map((r) => [r.area.latitude, r.area.longitude]),
      {
        paddingTopLeft:
          size.x > 1050 ? [wideMarkers ? 370 : 340, 50] : [40, 35],
        paddingBottomRight:
          size.x > 1050 ? [wideMarkers ? 470 : 350, 100] : [40, size.y * 0.48],
        maxZoom: 13,
        animate: false,
      },
    );
  }, [discovery, map, wideMarkers]);
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const container = map.getContainer();
      if (container.clientWidth && container.clientHeight)
        map.invalidateSize({ animate: false });
    });
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    const key = discovery.results
      .map((r) => `${r.area.id}:${r.area.latitude}:${r.area.longitude}`)
      .join("|");
    if (key && key !== fittedAreas.current) {
      fittedAreas.current = key;
      fit();
    }
  }, [discovery, fit]);
  const centre = useCallback(() => {
    const area = discovery.results.find((r) => r.area.id === selected)?.area;
    if (!area) return;
    const zoom = Math.max(map.getZoom(), 15);
    const point = map.project([area.latitude, area.longitude], zoom);
    // Keep the selected origin above the mobile evidence sheet.
    if (map.getSize().x <= 1050) point.y += map.getSize().y * 0.22;
    map.setView(map.unproject(point, zoom), zoom, { animate: false });
  }, [discovery, map, selected]);
  useEffect(() => {
    if (previous.current === selected) return;
    previous.current = selected;
    centre();
  }, [selected, centre]);
  return (
    <div className={styles.navigation} data-exploring={wideMarkers}>
      <button title="Zoom in" aria-label="Zoom in" onClick={() => map.zoomIn()}>
        <Plus />
      </button>
      <button
        title="Zoom out"
        aria-label="Zoom out"
        onClick={() => map.zoomOut()}
      >
        <Minus />
      </button>
      <button
        title="Centre on selected area"
        aria-label="Centre on selected area"
        onClick={centre}
      >
        <LocateFixed />
      </button>
      <button
        title={
          wideMarkers ? "Show all imported areas" : "Show all matching areas"
        }
        aria-label={
          wideMarkers ? "Show all imported areas" : "Show all matching areas"
        }
        onClick={fit}
      >
        <Maximize />
      </button>
    </div>
  );
}

export default function AreaMap({
  discovery,
  selected,
  onSelect,
  showRoutes,
  categories,
  showRadii,
  theme,
  markerMode,
  visibleAreas,
  browsing,
  browseRadius,
}: {
  discovery: MapContext;
  selected: string;
  onSelect: (id: string) => void;
  showRoutes: boolean;
  categories: string[];
  showRadii: boolean;
  theme: "light" | "dark";
  markerMode: "score" | "median" | "area";
  visibleAreas: string[];
  browsing: MapFacilities | null;
  browseRadius: number;
}) {
  const [tileError, setTileError] = useState(false);
  const [tileRevision, setTileRevision] = useState(0);
  const failedLayers = useRef(new WeakSet<object>());
  const result = discovery.results.find((r) => r.area.id === selected);
  return (
    <div
      className={styles.mapWrap}
      role="region"
      aria-label={
        markerMode === "area" ? "Area exploration map" : "Recommended areas map"
      }
    >
      {tileError && (
        <div role="status" className={styles.tileError}>
          <span>
            OneMap tiles unavailable. Area evidence is still accessible.
          </span>
          <button
            onClick={() => {
              setTileRevision((n) => n + 1);
              setTileError(false);
            }}
          >
            <RefreshCw /> Retry map
          </button>
        </div>
      )}
      <MapContainer
        center={[1.35, 103.82]}
        zoom={11}
        minZoom={11}
        maxZoom={19}
        zoomControl={false}
        className={styles.map}
      >
        <TileLayer
          key={`${theme}:${tileRevision}`}
          bounds={[
            [1.144, 103.535],
            [1.494, 104.502],
          ]}
          noWrap
          url={`https://www.onemap.gov.sg/maps/tiles/${theme === "dark" ? "Night" : "GreyLite"}/{z}/{x}/{y}.png`}
          attribution={
            '<a href="https://www.onemap.gov.sg/" target="_blank" rel="noopener noreferrer">OneMap</a> &copy; contributors | <a href="https://www.sla.gov.sg/" target="_blank" rel="noopener noreferrer">Singapore Land Authority</a>'
          }
          eventHandlers={{
            tileerror: (event) => {
              failedLayers.current.add(event.target);
              setTileError(true);
            },
            load: (event) => {
              const images = event.target
                .getContainer()
                ?.querySelectorAll("img") as
                NodeListOf<HTMLImageElement> | undefined;
              setTileError(
                failedLayers.current.has(event.target) ||
                  !images ||
                  !Array.from(images).some(
                    (img) =>
                      img.src.includes(
                        `/tiles/${theme === "dark" ? "Night" : "GreyLite"}/`,
                      ) &&
                      img.complete &&
                      img.naturalWidth > 0,
                  ),
              );
            },
          }}
        />
        <View
          discovery={discovery}
          selected={selected}
          wideMarkers={markerMode === "area"}
        />
        {showRadii && result && (
          <Circle
            center={[result.area.latitude, result.area.longitude]}
            radius={browseRadius}
            pathOptions={{
              color: radiusColor,
              weight: 1.5,
              fillOpacity: 0.035,
              dashArray: "5 5",
            }}
          >
            <Tooltip>
              {browseRadius.toLocaleString()} m exploration radius ·{" "}
              {result.area.originLabel}
            </Tooltip>
          </Circle>
        )}
        {discovery.results
          .filter((r) => visibleAreas.includes(r.area.id))
          .map((r) => {
            const rank = discovery.results.indexOf(r) + 1;
            const label =
              markerMode === "area"
                ? r.area.name
                : markerMode === "score"
                  ? (r.overall?.toFixed(1) ?? "n/a")
                  : r.median === undefined
                    ? "n/a"
                    : `$${Math.round(r.median / 1000)}k`;
            const active = r.area.id === selected;
            const title =
              markerMode === "area"
                ? `Explore ${r.area.name}`
                : `${r.area.name}: ${markerMode === "score" ? "match score" : r.priceEvidence?.kind === "bto-range" ? "published upper price bound" : "historical median"} ${label}`;
            return (
              <Marker
                key={`${r.area.id}:${markerMode}`}
                position={[r.area.latitude, r.area.longitude]}
                title={title}
                zIndexOffset={active ? 1000 : 0}
                icon={divIcon({
                  className: styles.pinRoot,
                  html:
                    markerMode === "area"
                      ? `<span class="${styles.pin} ${styles.areaPin} ${active ? styles.selected : ""}"><span class="${styles.areaName}">${escapeMarkup(label)}</span><span class="${styles.compactArea}">A</span></span>`
                      : `<span class="${styles.pin} ${active ? styles.selected : ""}"><small>${rank}</small>${escapeMarkup(label)}</span>`,
                  iconSize: [markerMode === "area" ? 36 : 82, 36],
                  iconAnchor: [markerMode === "area" ? 18 : 41, 42],
                })}
                eventHandlers={{
                  click: () => onSelect(r.area.id),
                  keydown: (event) => {
                    const key = event.originalEvent as KeyboardEvent;
                    if (key.key === "Enter" || key.key === " ") {
                      key.preventDefault();
                      key.stopPropagation();
                      onSelect(r.area.id);
                    }
                  },
                  add: (event) => {
                    const element = event.target.getElement();
                    element?.setAttribute("role", "button");
                    element?.setAttribute("aria-label", title);
                  },
                }}
              >
                <Tooltip>
                  {r.area.name} · {r.area.originLabel}
                </Tooltip>
              </Marker>
            );
          })}
        {discovery.preference.destinations.map(
          (d, i) =>
            d.location && (
              <Marker
                key={i}
                position={[d.location.latitude, d.location.longitude]}
                icon={divIcon({
                  className: styles.destination,
                  html: "<span>D</span>",
                  iconSize: [24, 24],
                  iconAnchor: [12, 12],
                })}
                title={`Your destination: ${d.location.label}`}
                keyboard={false}
                eventHandlers={{
                  add: (event) => {
                    const element = event.target.getElement();
                    element?.setAttribute("role", "img");
                    element?.setAttribute(
                      "aria-label",
                      `Your destination: ${d.location!.label}`,
                    );
                  },
                }}
              >
                <Tooltip>{d.location.label} · your destination</Tooltip>
              </Marker>
            ),
        )}
        {showRoutes &&
          result?.routes.flatMap((r, i) =>
            r.geometry.map((line, j) => (
              <Polyline
                key={`${i}-${j}`}
                positions={line}
                pathOptions={{
                  color: routeColors[i % routeColors.length],
                  weight: 4,
                  opacity: 0.85,
                }}
              >
                <Tooltip>
                  {r.destination} · {r.minutes.toFixed(1)} min ·{" "}
                  {r.mode === "public" ? "Public transport" : "Driving"}
                </Tooltip>
              </Polyline>
            )),
          )}
        {browsing?.layers
          .filter((a) => categories.includes(a.category))
          .flatMap((a) =>
            a.facilities.map((f, i) => (
              <CircleMarker
                key={`${a.category}-${i}`}
                center={[f.latitude, f.longitude]}
                radius={5}
                pathOptions={{
                  color: amenityPresentation[a.category].color,
                  fillOpacity: 1,
                  weight: 2,
                }}
              >
                <Tooltip>
                  <strong>{amenityPresentation[a.category].label}</strong>
                  <br />
                  {f.name}
                  {f.sportType && <> · {f.sportType}</>}
                  <br />
                  {Math.round(f.metres)} m geographic distance
                </Tooltip>
              </CircleMarker>
            )),
          )}
      </MapContainer>
    </div>
  );
}
