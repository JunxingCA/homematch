# BTO and Private-Housing Price Ranking

Implemented as a separate market-evidence path. Resale HDB continues to
use `hdb-town-v1`; its evidence and historical saved results are not relabelled.

## Scope and Status

- BTO ranks launch areas associated with named projects using verified published
  ranges. The bundled catalogue contains seven June 2026 projects, not the full
  history of every BTO launch. Applications closed 24 June 2026. Closed launches
  are excluded unless the user explicitly selects historical research.
- Project routing/amenities currently use the existing verified town MRT proxies.
  These are labelled as town proxies, not project entrances. This is a limitation
  for comparing projects in the same town, not a completed project-level map.
- Private ranking is implemented for URA postal districts, with separate
  apartments/condominiums and landed-type samples. The first real four-batch URA
  snapshot was validated, published and read back on 31 October 2026. No fixture
  prices are substituted into the application when a provider is missing.
- No asking-price feed, available-unit inventory, property valuation, grant amount,
  eligibility assessment, financial advice or application success prediction.

## BTO Evidence and Formula

`data/bto-2026-06.json` transcribes HDB Annex A, Table A(1)(a). Ranges are before
grants and use the stated 99-year leases. Two-room Flexi size variants are combined
into the published overall type range. Short-lease senior variants and 3Gen flats
are not included in the existing supported type selections. Sembawang source
prices include the stated finishes/fittings. Do not silently substitute the lower
excluding-fittings prices from the annex footnote.

For a selected quoted interval [L,U] and budget [Bmin,Bmax], range coverage is
`100 * max(0, min(U,Bmax)-max(L,Bmin)) / (U-L)`. A fixed-price quote scores 100 only
if in budget. Multiple selected flat-type ranges receive equal weights. This is
coverage of price intervals, NOT the percentage/probability of affordable units;
the within-range distribution of unit prices is not available. Missing selected
types are excluded with reasons, not replaced by resale evidence.

The journey and lifestyle formulas remain the disclosed distance/time formulas.
The profile's three weights combine them with range coverage. Version:
`bto-launch-area-v1`. BTO ignores the historical transaction lookback because this
is a specific published launch. Source dates, launch/application dates and the
source URL are frozen in every discovery. The shared legacy `median/p25/p75` numeric
slots contain upper/lower display bounds for BTO compatibility; all UI surfaces
branch on `priceEvidence.kind` and label ranges/upper bounds, not fabricated medians
or quartiles. `transactions` and `withinBudget` are zero, never synthetic samples.

To update the catalogue, verify the actual official launch annex, dates, lease
basis and all selected-type ranges, change the immutable source ID, and rerun the
schema/domain/browser tests. Do not update only the date to make an old launch seem
open or fresh. A future expanded catalogue needs multi-launch source management
and verified project coordinates; it is not already an automated HDB listing feed.

## URA Registration and Import

1. Open the [official URA API documentation](https://eservice.ura.gov.sg/maps/api/)
   and use its **Sign Up for an Access Key** link.
2. Register/activate the account and obtain the access key sent by URA. This is
   separate from the OneMap token/account. Do not paste it into chat or GitHub.
3. Add `URA_ACCESS_KEY=...` to the existing ignored `.env.local` file. No other
   teammate needs the owner's production service-role key just to edit code.
4. Run `node --env-file=.env.local scripts/import-private.mjs` from the app root.
   This obtains a daily token server-side and fetches all four official transaction
   batches, validates them and writes only `.cache/market/private.json` locally.
   The development adapter reads that ignored local file; production never does.
5. Test size bounds, property categories, dates, districts and sample counts using
   public provider examples. Check at least one actual district/type against URA.
6. Only for a reviewed production release, apply the market snapshot migration and
   run the same import with `--publish`. That inserts one complete immutable public
   price snapshot through backend credentials. Failure publishes no partial data.

No URA key is passed to the browser or required by Vercel for ordinary searches:
the separate importer needs it; the deployed app reads validated published data.
The real access key is configured only for the importer; it was not copied to
Vercel. A recurring URA refresh is not configured. Re-run the publish command
within seven days, otherwise the freshness guard deliberately blocks new private
rankings. Existing saved evidence is unchanged.

### First Live Import on 31 October 2026

- Snapshot: `ura-2026-10-31-f62bb245ae1058d3962d`.
- 3,318 project records; 101,966 accepted single-unit transactions through October
  2026. This includes 80,147 apartment/condominium transactions and 10,423 landed
  transactions. The remaining 11,396 Executive Condominium transactions are
  retained as source evidence but excluded from the current ranking categories.
- 29,325 source records without usable project coordinates and 48 bulk-sale
  records were excluded and counted. These exclusions mean coverage is partial;
  an omitted transaction must not be interpreted as no sale in that location.
- The live provider uses `Strata Semi-detached`, while its documentation and our
  internal category use `Strata Semidetached`. The normaliser accepts both and
  preserves one canonical category. Unknown categories still fail validation.
- The full JSON is 13,657,998 bytes. Inline Data API insertion exceeded the
  database statement timeout, so the backend-only publisher stores a lossless
  gzip/base64 envelope (1,246,788 bytes) with the original size and SHA-256 digest.
  The reader checks its checksum, identity, schema and a 32 MB decompression bound
  before using it. Legacy uncompressed snapshots remain readable.
- The import RPC is `SECURITY INVOKER`, executable only by `service_role`, and
  never overwrites an existing snapshot. Its 60-second function timeout does not
  change global or ordinary user-role timeouts. No user table policies changed.
- The published snapshot was retrieved and decoded back to the exact validated
  source object. An optional real-import test verifies district samples for both
  condo and landed categories. OneMap journeys are not fabricated by this test;
  end-to-end hosted ranking still needs a valid signed-in profile and live routes.
- URA data is historical transaction evidence, not current listings or valuations.
  The full result continues to use complete months within the selected lookback.

Run the optional local price-evidence acceptance test after an import:

```sh
npx vitest run --config vitest.live.config.ts tests/live/ura-import.test.ts
```

Source field definitions: https://eservice.ura.gov.sg/maps/api/

## Private Price Formula and Filters

- URA supplies five years in four district batches. All four must succeed.
- SVY21 project coordinates are converted using the pinned proj4 implementation,
  not guessed as latitude/longitude. Invalid locations are excluded and counted.
- Keep each single-unit transaction, including publicly indistinguishable records
  that may correspond to different units. Do not deduplicate by price/date/area.
- Exclude bulk multi-unit caveats rather than treating their total price as one
  home's price. Reject malformed numeric/date/type data and misbatched districts.
- Condo profile: Condominium and Apartment. Landed profile: Detached, Semi-detached,
  Terrace and the three official strata-landed types. Executive Condominium is
  excluded because it needs a separate scope/eligibility treatment.
- Filter by selected area range (sqm), reported area type (Any/Strata/Land), sale
  type (Any/New/Sub-sale/Resale), and the profile's complete-month lookback.
  HDB flat types are not inferred as private bedroom counts and are not used.
- Group prices by URA's recorded postal district, not by nearest HDB town. Each
  district requires at least five matching single-unit transactions BEFORE budget
  is applied. The inclusive in-budget proportion is the affordability score;
  full-sample quantiles are calculated directly, not averaged monthly medians.
- District reference origins are the equal-weight means of distinct matching
  imported project locations, not official boundary centroids or home entrances.
  Changing filters can change that disclosed representative origin.
- Use complete months only; refresh must be within seven days and source latest
  month within two months of the search. Missing/stale/malformed data fails closed.
- Formula version `private-district-v1`, with the same disclosed journey/lifestyle
  measures as resale. Different categories/formulas are not directly comparable.

The shared discovery store freezes profile revision, market filters, source IDs,
price/route evidence and formula version. History, saved areas and same-search
comparison continue to use that immutable evidence. Later imports do not overwrite
old scores. Existing RLS/ownership/session checks apply; only the backend can publish.

## Interfaces and Testing

- `POST /api/market-rankings`: same-origin strict JSON `profileId`, `revision` and
  `filters`. Never accepts client owner IDs, price evidence, coordinates or scores.
- `MarketRecommendationController`: owns orchestration, shared discovery quota,
  bounded three-worker routing, final session/profile revalidation and one insert.
- `MarketPriceAdapter`: validated BTO catalogue and local/published URA snapshot.
- `marketEvidence.mjs`: schemas and raw URA normalisation, shared with the importer.
- `marketRecommendations.ts`: candidate eligibility, category-specific budget
  formula and score construction. Existing resale formula remains regression-tested.

Automated fixtures cover source/type/coordinate/time validation, range arithmetic,
sample thresholds, ownership, races, failure handling, UI labels and persistence.
They are not a claim of live URA provider acceptance or exact BTO-project routing.

Sources: [HDB June 2026 Annex A](https://www.hdb.gov.sg/-/media/hdb-pulse/news/2026/20260617-HDB-Launches-6952-Flats-Across-7-Projects-in-June-2026-BTO-Sales-Exercise/Annex-A.pdf),
[URA API field definitions, batch partitions and registration](https://eservice.ura.gov.sg/maps/api/),
[HDB application-period details](https://www.hdb.gov.sg/-/media/hdb-pulse/news/2026/20260617-HDB-Launches-6952-Flats-Across-7-Projects-in-June-2026-BTO-Sales-Exercise/Annex-B.pdf).
