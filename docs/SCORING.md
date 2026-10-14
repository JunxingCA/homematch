# Area Research, Formula hdb-town-v1

This is HomeMatch's provisional formula from CODING_PROMPT.md, for team review.
It ranks Resale HDB towns, not properties. Separate BTO/private category formulas,
source activation status and limitations are documented in MARKET_RANKING.md;
the hdb-town-v1 formula below is not applied to their price evidence.

## Frozen Inputs

Each completed discovery stores its owner's confirmed preference revision, an immutable
copy of those preferences, the source snapshot ID, source refresh times, complete-month
window, departure assumption, route geometries, price summaries and score version.
Only the backend can publish discoveries; active owners can read them. Editing or
deleting a profile does not rewrite its earlier results. Failed searches publish no
partial ranking. Authentication expiry preserves the saved profile.

## Evidence

- HDB transactions: https://data.gov.sg/datasets/d_8b84c4ee58e3cfc0ece0d773c8ca6abc/view
- Parks and hawker centres: OneMap `nationalparks` and `ssot_hawkercentres`.
- Badminton: Sport Singapore's 2024 national facilities census,
  https://data.gov.sg/datasets/d_2cfb0867cdeb2b7303068995699dc33b/view (published 12 March 2026).
  Only explicitly classified Badminton Court records are imported. Repeated courts
  at one named venue/point are deduplicated into venue points. Includes private and
  school venues; no verified public access, availability or bookings. Coordinates
  in this census are approximate. This limitation is displayed in the results.
- Schools: MOE's 2026 General information of schools directory,
  https://data.gov.sg/datasets/d_688b934f82c1059ed0a6993d2a829089/view.
  All 337 directory schools are resolved by postal code through OneMap. An exact
  school-name point is preferred; a uniquely named administrative centre is used
  for a large campus. Ambiguous or unresolved locations block publication. This
  is not a preschool/university directory or proof of admission eligibility.
- Healthcare: OneMap `moh_hospitals`, 31 hospital locations. This filter does not
  currently measure GP, polyclinic or dental access. Hospital services, opening
  hours and appointments are not verified.
- Groceries: 19 known supermarket points from paginated OneMap gazetteer searches
  for supermarkets and retailer names. Warehouses, distribution centres and
  obvious non-retail lookalikes are excluded. Coverage is very incomplete, not a
  census of Singapore's supermarkets. This is a provisional known-point score:
  missing points score zero evidence, not proof of no shops. Giving this category
  weight can bias rankings toward places represented in the gazetteer. Prefer
  zero grocery contribution for decisions requiring comprehensive evidence until
  a current store directory is available. The limitation appears in preferences
  and prominently in selected-category results. Retrieval time is explicitly
  distinguished from the unknown source update date. Opening status is unverified.
- Area origins: an explicit MRT representative for each of the 26 HDB towns,
  verified through OneMap search and recorded with its exact source address. This
  is not a centroid or an estimate from every home. Proxy origins for Bukit Merah,
  Bukit Timah, Central Area, Geylang, Jurong West and Kallang/Whampoa are Tiong Bahru,
  Beauty World, Chinatown, Paya Lebar, Boon Lay and Boon Keng respectively.
- Routing: OneMap drive or public-transport itineraries. Seconds become minutes;
  transit distance sums the itinerary legs. Displayed geometry is decoded from
  provider polylines. Public transport uses tomorrow at 08:00 Singapore time,
  stored in the discovery. Driving uses the provider's default estimate.

The import validates CSV records, retains every supported resale price in monthly
town/flat-type buckets, and hashes the complete source file. Identical evidence
does not create another snapshot. Refresh failures leave the last valid snapshot
available. The complete raw CSV is not downloaded during recommendations. Unsupported
1-room/multi-generation flat types are counted and omitted because the profile
does not support those selections. Floor area is validated during import; price
scoring currently needs only transaction prices, months, towns and flat types.

Imported research must be refreshed within 30 days. Frequently updated OneMap
amenity layers must also have source dates within 30 days; the periodic sports
census has a provisional 730-day source-age ceiling with its vintage disclosed.
The annual school directory has a 400-day source-age ceiling; its coverage period
is disclosed. Hospital source dates use the 30-day ceiling. Grocery gazetteer
retrievals use 30 days, not an invented source update date. Old saved discoveries
keep their original data and limitations; refresh creates a new result.

## Formulas

Last N complete calendar months use Singapore time, start inclusive and end
exclusive. For example, on 12 October 2026 a 12-month window is October 2025 through
September 2026. Current-month transactions never contribute. Eligibility requires
at least five matching transactions before applying the inclusive budget range.

Quantiles use continuous interpolation at `(n - 1) * q` over the full sorted sample.
Monthly medians are not averaged.

- Frequency-weighted journey time `T = sum(visits * minutes) / sum(visits)`.
- Journey score `D = 100 * clamp(1 - T / 90, 0, 1)`.
- Each amenity score `s = 100 * clamp(1 - nearest geographic distance / radius, 0, 1)`;
  zero for a successfully imported category with no point inside the radius.
  This is absence of imported evidence, not an exhaustive absence claim, especially
  for the partial grocery layer and hospital-only healthcare layer.
- Lifestyle score `L = sum(priority * s) / sum(priority)`. With no lifestyle
  preferences its weight must be zero; display it as not contributing.
- Budget fit `A = 100 * in-budget transactions / all matching transactions`.
- Overall `O = (wD * D + wL * L + wA * A) / 100`.

No rounding before ranking. Display scores/minutes to one decimal and SGD to whole
dollars. Ties use area ID ascending. Geographic distance is haversine distance in
metres; it is not walking distance. The 90-minute cap and representative origins
are research assumptions, not official housing-quality measures.

## Operations

Apply `202610120001_recommendations.sql`, then run:

```bash
node --env-file=.env.local scripts/import-research.mjs
```

Secrets stay in the local or deployment environment. No import scheduler is enabled.
The importer paces data.gov.sg public requests, checks all school-search pages,
and caches validated public school coordinates for 30 days in ignored `.cache/`.
Only public school names and representative coordinates are cached, not directory
staff contact information. Imports publish only after every required layer passes.
Routing concurrency is three, provider timeout 15 seconds, overall deadline 150
seconds. Route caching lasts one hour and includes exact coordinates, transport mode
and departure date. Per-user in-process guards prevent overlapping searches and
enforce a 15-second interval. Distributed quotas/queues are deployment work.

History retrieves the owner's last ten completed discoveries. The comparison view
uses two or three results from the same immutable discovery. Account-linked saved
areas now retain their original discovery evidence; shortlist comparisons show
profile, weights, budget and dates, and warn against comparing overall scores
across different searches. See SHORTLIST.md. External links currently open portal entry pages, not deep
links or aggregated live inventory.
