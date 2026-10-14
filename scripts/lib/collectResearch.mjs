import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { z } from "zod";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
  point,
  schoolPoint,
  supermarketPoint,
  uniquePoints,
  searchPages,
  sportsFacilities,
  sportCategories,
} from "./amenities.mjs";
import { createOneMapClient } from "../../src/server/providers/oneMapClient.mjs";
import { setTimeout as sleep } from "node:timers/promises";
import { boundedText, officialDownloadUrl } from "./providerDownload.mjs";

export async function collectResearch({
  signal,
  cacheDir = ".cache",
  fetcher = (...args) => fetch(...args),
  pause = sleep,
} = {}) {
  const dataset = "d_8b84c4ee58e3cfc0ece0d773c8ca6abc";
  const fetchedAt = new Date().toISOString();
  const oneMapClient = createOneMapClient({ fetcher });
  await oneMapClient.getToken();
  let lastDataRequest = 0;
  const getJson = async (url, oneMap = false) => {
    if (new URL(url).hostname.endsWith(".data.gov.sg")) {
      // Conservative single-worker pacing, below the public download quota.
      await pause(
        Math.max(0, 12500 - (Date.now() - lastDataRequest)),
        undefined,
        { signal },
      );
      lastDataRequest = Date.now();
    }
    if (oneMap) return oneMapClient.json(url, { signal, timeoutMs: 30000 });
    const response = await fetcher(url, {
      cache: "no-store",
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(30000)])
        : AbortSignal.timeout(30000),
    });
    if (!response.ok) throw Error(`Data provider returned ${response.status}`);
    const body = JSON.parse(
      await boundedText(response, 8 * 1024 * 1024, signal),
    );
    if (body.error || body.errorMsg || body.code)
      throw Error("Data provider rejected request");
    return body;
  };
  const metadata = async (id) => {
    const result = (
      await getJson(
        `https://api-production.data.gov.sg/v2/public/api/datasets/${id}/metadata`,
      )
    ).data;
    if (
      !result?.lastUpdatedAt ||
      !Number.isFinite(Date.parse(result.lastUpdatedAt))
    )
      throw Error("Official dataset metadata unavailable");
    return result;
  };
  const downloadCsv = async (id) => {
    const base = `https://api-open.data.gov.sg/v1/public/api/datasets/${id}`;
    await getJson(`${base}/initiate-download`);
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await getJson(`${base}/poll-download`);
      if (response.data?.status !== "DOWNLOAD_SUCCESS") continue;
      const url = officialDownloadUrl(response.data.url);
      const file = await fetcher(url, {
        redirect: "error",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(60000)])
          : AbortSignal.timeout(60000),
      });
      if (!file.ok) throw Error("Official CSV unavailable");
      return await boundedText(file, 128 * 1024 * 1024, signal);
    }
    throw Error("Official dataset download unavailable");
  };
  console.log("Downloading official HDB transaction snapshot...");
  const hdbMetadata = await metadata(dataset);
  const csv = await downloadCsv(dataset);
  const rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
  const rowSchema = z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    town: z.string().min(1),
    flat_type: z.string(),
    resale_price: z.coerce.number().positive(),
    floor_area_sqm: z.coerce.number().positive(),
  });
  const types = {
    "2 ROOM": "2-room",
    "3 ROOM": "3-room",
    "4 ROOM": "4-room",
    "5 ROOM": "5-room",
    EXECUTIVE: "Executive",
  };
  const prices = new Map();
  const towns = new Set();
  let latestMonth = "",
    importedRows = 0,
    unsupportedRows = 0;
  for (const raw of rows) {
    const row = rowSchema.parse(raw);
    if (!types[row.flat_type]) {
      unsupportedRows++;
      continue;
    }
    latestMonth = row.month > latestMonth ? row.month : latestMonth;
    const key = `${row.town}|${row.month}|${types[row.flat_type]}`;
    if (!prices.has(key))
      prices.set(key, {
        town: row.town,
        month: row.month,
        flatType: types[row.flat_type],
        values: [],
      });
    prices.get(key).values.push(row.resale_price);
    towns.add(row.town);
    importedRows++;
  }
  // Explicit, documented representative origins, not inferred town centroids.
  const stations = {
    "ANG MO KIO": "ANG MO KIO",
    BEDOK: "BEDOK",
    BISHAN: "BISHAN",
    "BUKIT BATOK": "BUKIT BATOK",
    "BUKIT MERAH": "TIONG BAHRU",
    "BUKIT PANJANG": "BUKIT PANJANG",
    "BUKIT TIMAH": "BEAUTY WORLD",
    "CENTRAL AREA": "CHINATOWN",
    "CHOA CHU KANG": "CHOA CHU KANG",
    CLEMENTI: "CLEMENTI",
    GEYLANG: "PAYA LEBAR",
    HOUGANG: "HOUGANG",
    "JURONG EAST": "JURONG EAST",
    "JURONG WEST": "BOON LAY",
    "KALLANG/WHAMPOA": "BOON KENG",
    "MARINE PARADE": "MARINE PARADE",
    "PASIR RIS": "PASIR RIS",
    PUNGGOL: "PUNGGOL",
    QUEENSTOWN: "QUEENSTOWN",
    SEMBAWANG: "SEMBAWANG",
    SENGKANG: "SENGKANG",
    SERANGOON: "SERANGOON",
    TAMPINES: "TAMPINES",
    "TOA PAYOH": "TOA PAYOH",
    WOODLANDS: "WOODLANDS",
    YISHUN: "YISHUN",
  };
  const areas = [];
  for (const town of [...towns].sort()) {
    if (!stations[town])
      throw Error(`Missing representative point for ${town}`);
    const query = `${stations[town]} MRT STATION`;
    const response = await getJson(
      `https://www.onemap.gov.sg/api/common/elastic/search?${new URLSearchParams({ searchVal: query, returnGeom: "Y", getAddrDetails: "Y", pageNum: "1" })}`,
      true,
    );
    const matches = response.results.filter((r) =>
      (r.BUILDING ?? "").startsWith(query),
    );
    if (!matches.length) throw Error(`No verified MRT origin for ${town}`);
    matches.sort((a, b) => a.ADDRESS.localeCompare(b.ADDRESS));
    const match = matches[0];
    areas.push({
      id: town.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: town,
      originLabel: match.ADDRESS,
      latitude: Number(match.LATITUDE),
      longitude: Number(match.LONGITUDE),
    });
    console.log(`Verified origin: ${town}`);
  }
  const facilities = [],
    facilitySources = [];
  for (const [category, theme] of [
    ["Parks", "nationalparks"],
    ["Hawker centres", "ssot_hawkercentres"],
    ["Healthcare", "moh_hospitals"],
  ]) {
    const data = await getJson(
      `https://www.onemap.gov.sg/api/public/themesvc/retrieveTheme?queryName=${theme}`,
      true,
    );
    const metadata = data.SrchResults?.[0];
    if (!metadata?.DateTime || !metadata.FeatCount)
      throw Error("Amenity layer unavailable");
    facilitySources.push({
      category,
      theme,
      updatedAt: metadata.DateTime,
      sourceUrl: "https://www.onemap.gov.sg/",
      ...(category === "Healthcare"
        ? {
            coverage:
              "MOH hospital locations only. Does not cover all GP clinics, polyclinics or dental clinics. Services, opening hours and appointment availability are not verified.",
          }
        : {}),
    });
    for (const row of data.SrchResults.slice(1)) {
      if (row.Type !== "Point") throw Error("Unsupported amenity geometry");
      const [latitude, longitude] = row.LatLng.split(",");
      if (!row.NAME) throw Error("Invalid amenity point");
      facilities.push({
        name: row.NAME,
        category,
        ...point(latitude, longitude),
      });
    }
    if (data.SrchResults.length - 1 !== Number(metadata.FeatCount))
      throw Error("Incomplete amenity layer");
    console.log(`Imported ${metadata.FeatCount} ${category}`);
  }
  const sourceHash = createHash("sha256").update(csv).digest("hex");
  console.log(
    "Importing explicitly classified sports facilities from Sport Singapore...",
  );
  const sportsId = "d_2cfb0867cdeb2b7303068995699dc33b";
  const sportsMetadata = await metadata(sportsId);
  const sportsRows = parse(await downloadCsv(sportsId), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
  const sports = sportsFacilities(sportsRows);
  facilities.push(...sports);
  for (const category of new Set(Object.values(sportCategories))) {
    const count = sports.filter((f) => f.category === category).length;
    if (!count) throw Error(`No explicitly classified ${category} venues`);
    facilitySources.push({
      category,
      theme: sportsId,
      updatedAt: sportsMetadata.lastUpdatedAt,
      maxAgeDays: 730,
      sourceUrl: `https://data.gov.sg/datasets/${sportsId}/view`,
      coverage: `Sports Facilities National Census (${String(sportsMetadata.coverageStart ?? "unspecified").slice(0, 10)} to ${String(sportsMetadata.coverageEnd ?? "unspecified").slice(0, 10)}). ${count} distinct ${category.toLowerCase()} venue points. Includes private, condominium and school venues; public access and bookings are not verified. Coordinates are approximate.${category === "Football" ? " Includes football fields and futsal/street-soccer courts." : ""}`,
    });
    console.log(`Imported ${count} ${category} venue points`);
  }
  console.log(
    "Importing MOE school directory and resolving campus postal codes...",
  );
  const schoolsId = "d_688b934f82c1059ed0a6993d2a829089";
  const schoolMetadata = await metadata(schoolsId);
  if (
    !schoolMetadata?.lastUpdatedAt ||
    !schoolMetadata.coverageStart ||
    !schoolMetadata.coverageEnd
  )
    throw Error("School directory metadata unavailable");
  const schools = parse(await downloadCsv(schoolsId), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
  if (!schools.length) throw Error("School directory empty");
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  let schoolCache = {};
  try {
    schoolCache = JSON.parse(
      await readFile(`${cacheDir}/school-geocodes.json`, "utf8"),
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const schoolFacilities = [],
    unresolved = [];
  let nextSchool = 0;
  await Promise.all(
    Array.from({ length: 3 }, async () => {
      while (nextSchool < schools.length) {
        signal?.throwIfAborted();
        const school = schools[nextSchool++];
        const key = `${school.school_name}|${school.postal_code}|${school.address}`;
        const cached = schoolCache[key];
        if (
          cached &&
          Date.parse(cached.at) <= Date.now() &&
          Date.now() - Date.parse(cached.at) < 30 * 86400000
        ) {
          schoolFacilities.push({
            name: school.school_name.trim(),
            category: "Schools",
            ...point(cached.point.latitude, cached.point.longitude),
          });
          continue;
        }
        try {
          let matches;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              matches = await searchPages((page) =>
                getJson(
                  `https://www.onemap.gov.sg/api/common/elastic/search?${new URLSearchParams({ searchVal: school.postal_code, returnGeom: "Y", getAddrDetails: "Y", pageNum: String(page) })}`,
                  true,
                ),
              );
              break;
            } catch (error) {
              if (attempt === 2) throw error;
              await pause(1000 * (attempt + 1), undefined, { signal });
            }
          }
          const facility = schoolPoint(school, matches);
          schoolFacilities.push(facility);
          schoolCache[key] = {
            at: fetchedAt,
            point: {
              latitude: facility.latitude,
              longitude: facility.longitude,
            },
          };
        } catch (error) {
          unresolved.push({ name: school.school_name, reason: error.message });
        }
        if ((schoolFacilities.length + unresolved.length) % 30 === 0)
          console.log(
            `School locations checked: ${schoolFacilities.length + unresolved.length}/${schools.length}`,
          );
      }
    }),
  );
  await writeFile(
    `${cacheDir}/school-geocodes.json`,
    JSON.stringify(schoolCache),
    { mode: 0o600 },
  );
  if (unresolved.length) {
    console.log(
      `School layer incomplete: ${unresolved.length} unresolved public campus points`,
    );
    throw Error(
      "School layer incomplete; last valid snapshot remains unchanged",
    );
  }
  facilities.push(...schoolFacilities);
  facilitySources.push({
    category: "Schools",
    theme: schoolsId,
    updatedAt: schoolMetadata.lastUpdatedAt,
    maxAgeDays: 400,
    sourceUrl: `https://data.gov.sg/datasets/${schoolsId}/view`,
    coverage: `MOE school directory (${schoolMetadata.coverageStart.slice(0, 10)} to ${schoolMetadata.coverageEnd.slice(0, 10)}), ${schoolFacilities.length} schools. Representative campus points resolved from postal codes using OneMap; a named administrative centre is used for large campuses without a single school point. Not a preschool/university directory; proximity does not establish admission eligibility.`,
  });
  console.log(
    `Imported ${schoolFacilities.length} verified school campus points`,
  );
  const supermarkets = [];
  for (const query of [
    "SUPERMARKET",
    "FAIRPRICE",
    "SHENG SIONG",
    "COLD STORAGE",
    "GIANT",
  ]) {
    let pages = 1;
    for (let page = 1; page <= pages; page++) {
      const data = await getJson(
        `https://www.onemap.gov.sg/api/common/elastic/search?${new URLSearchParams({ searchVal: query, returnGeom: "Y", getAddrDetails: "Y", pageNum: String(page) })}`,
        true,
      );
      if (
        !Array.isArray(data.results) ||
        !Number.isInteger(data.totalNumPages) ||
        data.totalNumPages > 100
      )
        throw Error("Invalid supermarket gazetteer response");
      pages = data.totalNumPages;
      for (const row of data.results) {
        const facility = supermarketPoint(row);
        if (facility) supermarkets.push(facility);
      }
    }
  }
  const groceries = uniquePoints(supermarkets);
  if (!groceries.length)
    throw Error("No verified supermarket gazetteer points");
  facilities.push(...groceries);
  facilitySources.push({
    category: "Groceries",
    theme: "supermarket-gazetteer",
    updatedAt: fetchedAt,
    dateKind: "retrieved",
    partial: true,
    sourceUrl: "https://www.onemap.gov.sg/",
    coverage: `Partial OneMap gazetteer: ${groceries.length} known supermarket points, found through supermarket and retailer-name searches. Not an exhaustive store directory. Missing points score zero evidence, not proof of no groceries; grocery-weighted rankings are provisional. Opening status and hours are unverified. Date is retrieval time, not source update time.`,
  });
  console.log(
    `Imported ${groceries.length} known supermarket points (partial coverage)`,
  );
  const payload = {
    id: "",
    fetchedAt: new Date().toISOString(),
    sourceHash,
    sourceUpdatedAt: hdbMetadata.lastUpdatedAt,
    sourceUrl: `https://data.gov.sg/datasets/${dataset}/view`,
    latestMonth,
    importedRows,
    supportedFacilities: facilitySources.map((x) => x.category),
    facilitySources,
    areas,
    facilities: facilities.sort(
      (a, b) =>
        a.category.localeCompare(b.category) ||
        a.name.localeCompare(b.name) ||
        a.latitude - b.latitude ||
        a.longitude - b.longitude,
    ),
    prices: [...prices.values()].map((g) => ({
      ...g,
      values: g.values.sort((a, b) => a - b),
    })),
  };
  payload.id = createHash("sha256")
    .update(JSON.stringify({ ...payload, id: undefined }))
    .digest("hex");
  return { payload, unsupportedRows };
}
