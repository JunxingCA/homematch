import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { createClient } from "@supabase/supabase-js";
import { sportsFacilities, sportCategories } from "./lib/amenities.mjs";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw Error("Configure the server environment first");
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const { data, error } = await client
  .from("research_snapshots")
  .select("payload")
  .order("created_at", { ascending: false })
  .limit(1)
  .single();
if (error || !data?.payload)
  throw Error("Existing research snapshot unavailable");
const old = data.payload;
const rows = parse(await readFile(".cache/sports-facilities.csv", "utf8"), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
});
const facilities = sportsFacilities(rows);
const categories = [...new Set(Object.values(sportCategories))];
const counts = Object.fromEntries(
  categories.map((category) => [
    category,
    facilities.filter((f) => f.category === category).length,
  ]),
);
if (Object.values(counts).some((count) => !count))
  throw Error("One or more sports categories have no validated points");
const sourceUrl =
  "https://data.gov.sg/datasets/d_2cfb0867cdeb2b7303068995699dc33b/view";
const payload = {
  ...old,
  // Keep transaction retrieval dates and price evidence exactly as originally imported.
  facilities: [
    ...old.facilities.filter((f) => !categories.includes(f.category)),
    ...facilities,
  ].sort(
    (a, b) =>
      a.category.localeCompare(b.category) ||
      a.name.localeCompare(b.name) ||
      a.latitude - b.latitude ||
      a.longitude - b.longitude,
  ),
  supportedFacilities: [
    ...new Set([...old.supportedFacilities, ...categories]),
  ],
  facilitySources: [
    ...old.facilitySources.filter((s) => !categories.includes(s.category)),
    ...categories.map((category) => ({
      category,
      theme: "d_2cfb0867cdeb2b7303068995699dc33b",
      updatedAt: "2026-03-12T00:00:00+08:00",
      maxAgeDays: 730,
      sourceUrl,
      coverage: `2024 Sports Facilities National Census, published March 2026. ${counts[category]} distinct ${category.toLowerCase()} venue points. Includes private, condominium and school venues; public access and bookings are not verified. Coordinates are approximate.${category === "Football" ? " Includes football fields and futsal/street-soccer courts." : ""}`,
    })),
  ],
};
payload.id = createHash("sha256")
  .update(JSON.stringify({ ...payload, id: undefined, fetchedAt: undefined }))
  .digest("hex");
const { error: publicationError } = await client
  .from("research_snapshots")
  .upsert(
    { id: payload.id, payload },
    { onConflict: "id", ignoreDuplicates: true },
  );
if (publicationError)
  throw Error(`Snapshot publication failed (${publicationError.code})`);
console.log(
  JSON.stringify(
    {
      snapshot: payload.id,
      facilities: payload.facilities.length,
      sports: counts,
      priceGroupsUnchanged:
        JSON.stringify(payload.prices) === JSON.stringify(old.prices),
    },
    null,
    2,
  ),
);
