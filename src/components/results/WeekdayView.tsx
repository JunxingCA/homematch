"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  Car,
  House,
  Lightbulb,
  Pause,
  Play,
  Sunrise,
  TrainFront,
  X,
} from "lucide-react";
import type { AreaResult, Discovery } from "@/domain/recommendations";
import { amenityPresentation } from "../amenityPresentation";
import { WindowMeter } from "../lights/WindowMeter";
import { tick } from "../lights/sound";
import {
  litWindows,
  town,
  weekdayMoments,
  type Moment,
  type MomentPlace,
} from "./resultView";
import styles from "./WeekdayView.module.css";

const STEP_MS = 4300;
const PLACES: MomentPlace[] = ["home", "station", "amenity", "destination"];
const WALKER_X: Record<MomentPlace, number> = {
  home: 12,
  station: 38,
  amenity: 63,
  destination: 88,
};
const BUILDINGS: Record<
  MomentPlace,
  { cols: number; rows: number; day: string; night: string }
> = {
  home: { cols: 3, rows: 5, day: "#CFE3D6", night: "#6F8C7E" },
  station: { cols: 4, rows: 1, day: "#9AA6BC", night: "#3A4A6B" },
  amenity: { cols: 3, rows: 1, day: "#E8C48A", night: "#7A6440" },
  destination: { cols: 3, rows: 4, day: "#B9C7DD", night: "#34405E" },
};

/** A fixed pattern of lit windows, the same on every render. */
function litAt(n: number): boolean {
  let seed = 5;
  for (let i = 0; i <= n; i++) seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280 > 0.35;
}

/** Sky colour by the hour on the moment's clock. */
function sky(time: string): string {
  const h = Number(time.slice(0, 2));
  if (h < 8) return "#F9DDB1";
  if (h < 12) return "#D5E4F0";
  if (h < 18) return "#CFE0EA";
  if (h < 19) return "#F1A27A";
  if (h < 20) return "#5B5582";
  if (h < 22) return "#2E3A66";
  return "#101A2E";
}

function MomentIcon({ moment, last }: { moment: Moment; last: boolean }) {
  if (last) return <Lightbulb aria-hidden="true" />;
  if (moment.place === "home")
    return moment.night || moment.short === "Home again" ? (
      <House aria-hidden="true" />
    ) : (
      <Sunrise aria-hidden="true" />
    );
  if (moment.place === "station")
    return moment.placeLabel === "Road" ? (
      <Car aria-hidden="true" />
    ) : (
      <TrainFront aria-hidden="true" />
    );
  if (moment.place === "destination") return <Building2 aria-hidden="true" />;
  const entry = Object.values(amenityPresentation).find(
    (p) => p.label === moment.placeLabel,
  );
  const Icon = entry?.icon ?? Building2;
  return <Icon aria-hidden="true" />;
}

const TINTS: Record<MomentPlace, string> = {
  home: "var(--amber-soft)",
  station: "var(--pastel-blue)",
  amenity: "var(--mint)",
  destination: "var(--pastel-lilac)",
};

/** "Live a weekday here": a day in the area, told only from this search's evidence. */
export function WeekdayView({
  discovery,
  result,
  onClose,
}: {
  discovery: Discovery;
  result: AreaResult;
  onClose: () => void;
}) {
  const moments = weekdayMoments(discovery, result);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(
    () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % moments.length),
      STEP_MS,
    );
    return () => window.clearInterval(id);
  }, [playing, moments.length]);

  const m = moments[index];
  const name = town(result.area.name);
  const labels: Record<MomentPlace, string> = {
    home: "Home",
    station:
      moments.find((x) => x.place === "station")?.placeLabel ?? "Station",
    amenity: moments.find((x) => x.place === "amenity")?.placeLabel ?? "Nearby",
    destination:
      moments.find((x) => x.place === "destination")?.placeLabel ?? "Out",
  };

  return (
    <div
      className={styles.overlay}
      role="region"
      aria-label={`A weekday in ${name}`}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div className={styles.head}>
        <div className={styles.headCopy}>
          <div className={styles.chips}>
            <span className="chip">
              <span className="dot" style={{ background: "var(--coral)" }} />
              {name}
            </span>
            <span className="chip">
              <WindowMeter lit={litWindows(result.overall)} compact />
              {litWindows(result.overall)} of 10 lit
            </span>
          </div>
          <h2 className="h-page">Live a weekday here.</h2>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className="btn"
            aria-pressed={playing}
            onClick={() => {
              tick();
              setPlaying(!playing);
            }}
          >
            {playing ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {playing ? "Pause the day" : "Play the day"}
          </button>
          <button
            type="button"
            className={styles.close}
            aria-label="Close weekday view"
            title="Close weekday view"
            onClick={onClose}
            autoFocus
          >
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <div
          className={styles.scene}
          style={{ background: sky(m.time) }}
          role="img"
          aria-label={`${m.time}: ${m.title}. ${m.detail}.`}
        >
          <div
            className={styles.orb}
            data-night={m.night}
            style={{ left: `${70 + (index % 3) * 8}%` }}
          />
          <div
            key={index}
            className={styles.caption}
            style={{ color: m.night ? "#EEF1EA" : "#14213D" }}
          >
            <span className={styles.clock}>{m.time}</span>
            <span className={styles.title}>{m.title}</span>
            <span className="chip chip--dark">
              <span className="dot" />
              {m.detail}
            </span>
          </div>
          <div className={styles.places}>
            {PLACES.map((p) => {
              const b = BUILDINGS[p];
              return (
                <div
                  key={p}
                  className={styles.place}
                  style={{
                    background: m.night ? b.night : b.day,
                    gridTemplateColumns: `repeat(${b.cols}, 12px)`,
                  }}
                >
                  {Array.from({ length: b.cols * b.rows }, (_, k) => {
                    const mine = p === "home" && k === 7;
                    const lit = m.night && litAt(PLACES.indexOf(p) * 20 + k);
                    return (
                      <span
                        key={k}
                        data-state={mine ? "mine" : lit ? "lit" : "off"}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div className={styles.road} />
          <div className={styles.labels}>
            {PLACES.map((p) => (
              <span key={p} data-here={m.place === p}>
                {labels[p]}
              </span>
            ))}
          </div>
          <div
            className={styles.walker}
            style={{ left: `${WALKER_X[m.place]}%` }}
          />
        </div>

        <div className={styles.timeline}>
          <div className={styles.progress} aria-hidden="true">
            <span
              style={{ width: `${((index + 1) / moments.length) * 100}%` }}
            />
          </div>
          <ol>
            {moments.map((x, k) => (
              <li key={`${x.time}-${k}`}>
                <button
                  type="button"
                  className={styles.moment}
                  aria-current={k === index ? "step" : undefined}
                  onClick={() => {
                    tick();
                    setIndex(k);
                  }}
                >
                  <span
                    className={styles.momentIcon}
                    style={{ background: TINTS[x.place] }}
                  >
                    <MomentIcon moment={x} last={k === moments.length - 1} />
                  </span>
                  <span className={styles.momentText}>
                    <span>
                      <b>{x.time}</b> {x.short}
                    </span>
                    <small>{x.detail}</small>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className={styles.small}>
            Trips use routes searched for an 08:00 departure on{" "}
            {discovery.departure.slice(0, 10)} from {result.area.originLabel}.
            Walks are straight-line estimates to the nearest imported facility,
            not walking routes.
          </p>
        </div>
      </div>
    </div>
  );
}
