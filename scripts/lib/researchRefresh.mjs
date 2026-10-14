import { createHash } from "node:crypto";
import {
  snapshotSchema,
  lifestyleCategories,
} from "../../src/domain/researchSnapshot.mjs";

export const TOWNS = [
  "ANG MO KIO",
  "BEDOK",
  "BISHAN",
  "BUKIT BATOK",
  "BUKIT MERAH",
  "BUKIT PANJANG",
  "BUKIT TIMAH",
  "CENTRAL AREA",
  "CHOA CHU KANG",
  "CLEMENTI",
  "GEYLANG",
  "HOUGANG",
  "JURONG EAST",
  "JURONG WEST",
  "KALLANG/WHAMPOA",
  "MARINE PARADE",
  "PASIR RIS",
  "PUNGGOL",
  "QUEENSTOWN",
  "SEMBAWANG",
  "SENGKANG",
  "SERANGOON",
  "TAMPINES",
  "TOA PAYOH",
  "WOODLANDS",
  "YISHUN",
];
export class RefreshError extends Error {
  constructor(code) {
    super(
      `Research refresh could not complete (${code}). Previous snapshots are retained.`,
    );
    this.code = code;
  }
}
const check = (condition, code) => {
  if (!condition) throw new RefreshError(code);
};
const months = (value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
const count = (snapshot, category) =>
  snapshot.facilities.filter((f) => f.category === category).length;

export function validateResearch(candidate, previous, now = new Date()) {
  const parsed = snapshotSchema.safeParse(candidate);
  check(parsed.success, "INVALID_SNAPSHOT");
  const snapshot = parsed.data;
  const time = now.getTime();
  check(
    Date.parse(snapshot.fetchedAt) <= time + 60000 &&
      time - Date.parse(snapshot.fetchedAt) < 30 * 60000,
    "INVALID_RETRIEVAL_TIME",
  );
  check(
    snapshot.areas.length === TOWNS.length &&
      new Set(snapshot.areas.map((a) => a.name)).size === TOWNS.length &&
      TOWNS.every((town) => snapshot.areas.some((a) => a.name === town)),
    "INCOMPLETE_TOWNS",
  );
  check(
    new Set(snapshot.areas.map((a) => a.id)).size === TOWNS.length &&
      snapshot.areas.every((a) => a.id && a.originLabel),
    "INVALID_ORIGINS",
  );
  check(
    snapshot.importedRows >= 100000 &&
      snapshot.prices.reduce((n, g) => n + g.values.length, 0) ===
        snapshot.importedRows,
    "INCOMPLETE_PRICES",
  );
  const groups = new Set();
  for (const group of snapshot.prices) {
    const key = `${group.town}|${group.month}|${group.flatType}`;
    check(
      !groups.has(key) &&
        TOWNS.includes(group.town) &&
        months(group.month) &&
        ["2-room", "3-room", "4-room", "5-room", "Executive"].includes(
          group.flatType,
        ) &&
        group.values.length > 0 &&
        group.values.every(
          (value, i) => i === 0 || value >= group.values[i - 1],
        ),
      "INVALID_PRICE_GROUP",
    );
    groups.add(key);
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year").value),
    month = Number(parts.find((p) => p.type === "month").value);
  const current = `${year}-${String(month).padStart(2, "0")}`;
  const minimum = new Date(Date.UTC(year, month - 3, 1))
    .toISOString()
    .slice(0, 7);
  check(
    months(snapshot.latestMonth) &&
      snapshot.latestMonth >= minimum &&
      snapshot.latestMonth <= current &&
      snapshot.latestMonth ===
        [...snapshot.prices]
          .map((g) => g.month)
          .sort()
          .at(-1),
    "STALE_OR_INVALID_PRICES",
  );
  check(
    snapshot.sourceUpdatedAt &&
      Date.parse(snapshot.sourceUpdatedAt) <= time + 60000,
    "INVALID_SOURCE_DATE",
  );
  check(
    snapshot.supportedFacilities.length === lifestyleCategories.length &&
      new Set(snapshot.supportedFacilities).size ===
        lifestyleCategories.length &&
      lifestyleCategories.every(
        (category) =>
          snapshot.supportedFacilities.includes(category) &&
          count(snapshot, category) > 0,
      ),
    "INCOMPLETE_FACILITIES",
  );
  check(
    snapshot.facilitySources.length === lifestyleCategories.length &&
      new Set(snapshot.facilitySources.map((s) => s.category)).size ===
        lifestyleCategories.length,
    "INCOMPLETE_SOURCES",
  );
  for (const source of snapshot.facilitySources) {
    check(
      lifestyleCategories.includes(source.category) &&
        Date.parse(source.updatedAt) <= time + 60000 &&
        time - Date.parse(source.updatedAt) <=
          (source.maxAgeDays ?? 30) * 86400000,
      "STALE_SOURCE",
    );
  }
  if (previous) {
    check(
      snapshot.latestMonth >= previous.latestMonth &&
        snapshot.importedRows >= previous.importedRows * 0.95,
      "PRICE_REGRESSION",
    );
    check(
      !previous.sourceUpdatedAt ||
        Date.parse(snapshot.sourceUpdatedAt) >=
          Date.parse(previous.sourceUpdatedAt),
      "SOURCE_REGRESSION",
    );
    for (const source of snapshot.facilitySources) {
      const old = previous.facilitySources.find(
        (s) => s.category === source.category,
      );
      check(
        count(snapshot, source.category) >=
          count(previous, source.category) * 0.8,
        "FACILITY_REGRESSION",
      );
      check(
        !old || Date.parse(source.updatedAt) >= Date.parse(old.updatedAt),
        "SOURCE_REGRESSION",
      );
    }
  }
  // Retrieval time is part of a new immutable identity; old discoveries keep their dates.
  snapshot.id = createHash("sha256")
    .update(JSON.stringify({ ...snapshot, id: undefined }))
    .digest("hex");
  return snapshot;
}

export async function refreshResearch({
  repository,
  collect,
  now = () => new Date(),
  signal,
  dryRun = false,
  force = false,
  intervalHours = 24,
}) {
  let previous;
  try {
    const raw = await repository.latest();
    previous = raw ? snapshotSchema.parse(raw) : null;
  } catch {
    throw new RefreshError("BASELINE_UNAVAILABLE");
  }
  if (
    !force &&
    !dryRun &&
    previous &&
    now().getTime() >= Date.parse(previous.fetchedAt) &&
    now().getTime() - Date.parse(previous.fetchedAt) < intervalHours * 3600000
  )
    return {
      state: "not-due",
      snapshotId: previous.id,
      fetchedAt: previous.fetchedAt,
    };
  let collected;
  try {
    collected = await collect({ signal });
  } catch {
    throw new RefreshError(signal?.aborted ? "CANCELLED" : "COLLECTION_FAILED");
  }
  if (signal?.aborted) throw new RefreshError("CANCELLED");
  const snapshot = validateResearch(collected.payload, previous, now());
  if (!dryRun) {
    try {
      await repository.publish(snapshot);
    } catch {
      throw new RefreshError("PUBLICATION_UNCONFIRMED");
    }
  }
  if (dryRun)
    return {
      state: "validated-only",
      candidateSnapshotId: snapshot.id,
      candidateFetchedAt: snapshot.fetchedAt,
      activeSnapshotId: previous?.id ?? null,
      activeFetchedAt: previous?.fetchedAt ?? null,
    };
  return {
    state: "published",
    snapshotId: snapshot.id,
    fetchedAt: snapshot.fetchedAt,
    importedRows: snapshot.importedRows,
    facilities: snapshot.facilities.length,
    latestMonth: snapshot.latestMonth,
  };
}
