# Expanded amenities and independent map exploration

Implemented 13 October 2026 with approval to update the hosted profile validator and publish a new public research snapshot. No existing profiles, discoveries or saved areas were rewritten.

## Catalogue and limits

Thirteen categories: Badminton, Parks, Groceries, Hawker centres, Schools, Healthcare (shown as Hospitals), Gym, Basketball, Football, Swimming, Tennis, Fitness corners and Running tracks. Manual preferences and Gemini's structured extraction share this catalogue. The submitted limit of six selected lifestyle priorities remains enforced in TypeScript and PostgreSQL; expanding the catalogue does not increase that limit.

## Sports data

[Sport Singapore's 2024 Sports Facilities National Census](https://data.gov.sg/datasets/d_2cfb0867cdeb2b7303068995699dc33b/view), published 12 March 2026, supplies explicit facility types and approximate coordinates. No sport is guessed from venue names. Football includes Football Field and Futsal / Street Soccer Court; Running tracks includes Jogging Track (case variants) and Athletics Track. Duplicate courts/pools at the same named venue and point count once per category, not once per court. Category grouping retains the first source sport type for its point.

Imported venue points: Badminton 1,101; Gym 2,179; Basketball 837; Football 539; Swimming 2,093; Tennis 789; Fitness corners 2,503; Running tracks 445. Together with unchanged non-sports sources, the new snapshot contains 11,464 facility points. Sports can be private, condominium or school facilities; public access, fees, memberships and booking availability are not verified. This warning appears before searching and in map exploration.

`scripts/import-research.mjs` now includes the complete sports catalogue for future imports. `scripts/expand-sports.mjs` was used for the approved incremental update: it replaces sports points in a new immutable public snapshot while preserving price arrays, their source hash/date and all non-sports layers. It reads a downloaded public CSV from ignored `.cache/`, uses server credentials and reports only public dataset counts. The published snapshot is `b53b1f6c4178d16c8fb601b156e749f5efa467bc41ded259af201e687c4d208a`.

## Independent exploration

`GET /api/discoveries/:id/facilities?areaId=...&radius=1000` first loads the caller's owned discovery using the existing active-session and RLS path. It accepts an area ID present in that discovery, never client coordinates. It reads the latest validated public snapshot and returns nearby facilities for every category, regardless of the original scoring preferences. The response includes source coverage, counts, radius, origin and snapshot identity, but no new scores. Responses are private/no-store.

The UI exposes all categories in a compact icon toolbar and a labelled layer panel. Users can change the exploration radius from 1 to 5 km. Geographic distances are from the representative MRT origin, not a property or walking-route catchment. At most the nearest 100 points per category are drawn; the full count and any truncation are disclosed. A missing imported category is distinct from an available layer with zero nearby points. Provider failures retain saved research and offer Retry amenities. Aborted/mismatched responses cannot populate another selected area's map.

Exploration uses current imported data; saved scores, comparisons and bookmarks keep their original snapshot. To change scoring priorities, edit/review/confirm the profile and run a new search. Partial grocery coverage, hospitals-only healthcare and non-admission school proximity remain explicitly limited.

## Security and verification

The migration replaces only the existing private profile validation function's category whitelist, retaining its six-preference cap, four-profile cap, coordinate validation, revision guards and ownership/session rules. Anon/authenticated execution remains revoked; no new table grants or policies were added. Hosted catalog checks confirmed the whitelist and privileges. The security advisor returned the existing findings documented in PASSWORD_RECOVERY.md; unrelated platform/session grants were not changed.

Tests cover explicit sport classification, malformed coordinates, venue deduplication, all-category scoring, profile limits in actual PostgreSQL/PGlite, independent map counts/caps, unavailable versus empty layers, ownership before public data reads, stale snapshots, retry and unchanged score evidence. Browser checks use fixture accounts/data and real OneMap tiles; the separate opt-in live research test reads the government snapshot without account writes. Automated tests do not prove public venue access or completeness of partial sources.

Final verification: lint/typecheck and 159 unit/database tests passed; production build passed; 14 research/AI browser checks, eight preference/preview browser checks and eight recovery browser checks passed. The separate read-only live research test passed with all 13 categories. Dark/light desktop/mobile screenshots were visually inspected. The existing map instance is preserved when themes change; the tile layer alone is replaced to avoid old cached tiles masking a new-theme outage. `git diff --check` is clean. The local server is running at http://127.0.0.1:4175/; this increment has not been deployed or pushed.
