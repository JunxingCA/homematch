const normalise = (s) =>
  String(s ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

export const sportCategories = {
  "Badminton Court": "Badminton",
  Gymnasium: "Gym",
  "Basketball Court": "Basketball",
  "Football Field": "Football",
  "Futsal / Street Soccer Court": "Football",
  "Swimming Pool": "Swimming",
  "Tennis Court": "Tennis",
  "Fitness Corner": "Fitness corners",
  "Jogging Track": "Running tracks",
  "Athletics Track": "Running tracks",
};

export function sportsFacilities(rows) {
  const points = new Map();
  for (const row of rows) {
    const sportType = String(row.SportsFacility ?? "").trim();
    const key = Object.keys(sportCategories).find(
      (type) => type.toLowerCase() === sportType.toLowerCase(),
    );
    if (!key) continue;
    const category = sportCategories[key];
    const name =
      String(row.VenueName ?? "").trim() ||
      `${category} venue${row.PostalCode ? ` (${row.PostalCode})` : " (unnamed in source)"}`;
    const facility = {
      name,
      category,
      sportType: key,
      ...point(row.Latitude, row.Longitude),
    };
    // Count venues rather than several courts/pools at the same venue.
    const identity = `${category}|${normalise(name)}|${facility.latitude}|${facility.longitude}`;
    if (!points.has(identity)) points.set(identity, facility);
  }
  return [...points.values()];
}

export function point(latitude, longitude) {
  const lat = Number(latitude),
    lon = Number(longitude);
  if (
    !String(latitude ?? "").trim() ||
    !String(longitude ?? "").trim() ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < 1.1 ||
    lat > 1.5 ||
    lon < 103.5 ||
    lon > 104.2
  )
    throw Error("Invalid Singapore amenity coordinates");
  return { latitude: lat, longitude: lon };
}

export function schoolPoint(school, results) {
  const postal = String(school.postal_code).trim().padStart(6, "0");
  if (!/^\d{6}$/.test(postal) || !school.school_name?.trim())
    throw Error("Invalid school directory record");
  const matches = results
    .filter((r) => String(r.POSTAL) === postal)
    .sort((a, b) => String(a.ADDRESS).localeCompare(String(b.ADDRESS)));
  if (!matches.length) throw Error("School postal code could not be resolved");
  const exact = matches.filter(
    (r) => normalise(r.BUILDING) === normalise(school.school_name),
  );
  const office = matches.filter(
    (r) =>
      normalise(r.BUILDING).startsWith(normalise(school.school_name)) &&
      /\((?:ADMINISTRATIVE CENTRE|GENERAL OFFICE|MAIN ENTRANCE)\)/i.test(
        r.BUILDING,
      ),
  );
  const candidates = exact.length
    ? exact
    : office.length === 1
      ? office
      : matches;
  const origin = point(candidates[0].LATITUDE, candidates[0].LONGITUDE);
  // Multiple entrances at one campus are safe; distant matches need manual review.
  for (const r of candidates) {
    const p = point(r.LATITUDE, r.LONGITUDE);
    const metres = Math.hypot(
      (p.latitude - origin.latitude) * 111195,
      (p.longitude - origin.longitude) * 111170,
    );
    if (metres > 150) throw Error("Ambiguous school campus coordinates");
  }
  return { name: school.school_name.trim(), category: "Schools", ...origin };
}

export function supermarketPoint(result) {
  const name = String(result.BUILDING ?? "").trim();
  if (
    /DISTRIBUTION|WAREHOUSE|LOGISTICS|HEAD\s*OFFICE|HEADQUARTERS|PANDA|SUZUE|CONNEXIS/i.test(
      name,
    )
  )
    return null;
  if (
    !/SUPERMARKET|HYPERMARKET|^(?:NTUC\s+)?FAIRPRICE\b|^SHENG\s*SIONG\b|^COLD\s*STORAGE\b|^GIANT(?:\s|$)/i.test(
      name,
    )
  )
    return null;
  return {
    name,
    category: "Groceries",
    ...point(result.LATITUDE, result.LONGITUDE),
  };
}

export function uniquePoints(points) {
  const byPoint = new Map();
  for (const p of [...points].sort((a, b) => a.name.localeCompare(b.name))) {
    // Identical named search hits and entrances at the same point count once.
    const key = `${p.category}|${p.latitude.toFixed(5)}|${p.longitude.toFixed(5)}`;
    if (!byPoint.has(key)) byPoint.set(key, p);
  }
  return [...byPoint.values()];
}

export async function searchPages(getPage) {
  const results = [];
  let pages = 1,
    found;
  for (let page = 1; page <= pages; page++) {
    const data = await getPage(page);
    if (
      !Array.isArray(data.results) ||
      !Number.isInteger(data.totalNumPages) ||
      data.totalNumPages < 0 ||
      data.totalNumPages > 100 ||
      !Number.isInteger(data.found) ||
      data.found < 0
    )
      throw Error("Invalid paginated place search");
    if (page > 1 && (pages !== data.totalNumPages || found !== data.found))
      throw Error("Place search changed during pagination");
    pages = data.totalNumPages;
    found = data.found;
    results.push(...data.results);
  }
  if (results.length !== found) throw Error("Incomplete place search");
  return results;
}
