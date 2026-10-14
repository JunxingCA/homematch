# Recommendation Increment Verification

12 October 2026, local development and the configured hosted Supabase project.

## Live Evidence

- Recommendation migration applied successfully to hosted Supabase.
- Government import completed: 242,274 supported resale transactions, 180
  unsupported flat-type rows omitted, 26 verified MRT representative origins,
  462 parks, 129 hawker centres and 1,101 distinct census badminton venue points.
- Source price data includes October 2026; discoveries exclude the incomplete
  current month and use the selected number of complete months.
- The existing confirmed owner profile produced and persisted a complete 26-town
  discovery through the running application. Real OneMap transit routes were
  retrieved; no mock scores or journeys were used in this live check.
- No private profile payload, session cookie, credential or live-user screenshot
  is committed as test evidence.

## Automated Evidence

- Lint and strict typecheck pass.
- 78 unit/PostgreSQL tests pass, including hand-calculated score examples,
  quantile interpolation, Singapore month boundaries, visit weighting, empty
  lifestyle semantics, reproducibility, missing route evidence and route parsing.
- PGlite executes both migrations. Discovery tests establish active-owner reads,
  cross-owner denial, expiry/revocation denial, anonymous denial and inability for
  authenticated clients to publish or edit computed discoveries.
- Two isolated Playwright recommendation tests pass at desktop 1440 x 1000 and
  mobile 360 x 800. They use mocked accounts/discoveries and real OneMap basemap
  tiles, checking rendered tiles/paths, selected-area details, light/dark mode,
  no horizontal overflow, comparison and search-history navigation.
- The original eight preference/preview browser tests also pass. Production
  build succeeds with the new discovery and Google callback routes.
- `npm audit --omit=dev` reports zero production vulnerabilities.
- UI screenshots from the automated fixture runs are under `test-results/`,
  which is ignored by Git. They are layout tests, not government-data rankings.

## Running Checks

```bash
npm run check
```

Start the configured Supabase-mode app at port 4175, then run the isolated UI tests:

```bash
npx playwright test --config playwright.research.config.ts
```

The original eight preference/preview tests use their own port 4317 and require
the existing dev server to stop temporarily because Next permits one dev process
per checkout. They exclude `recommendations.spec.ts`, whose mocks depend on a
Supabase-mode page. No UI test sends account data to a real Auth provider.

## Limits

The formula and proxy origins remain provisional, documented in SCORING.md.
Census sports points include access-restricted venues and approximate coordinates.
Only Resale HDB pricing is covered. Dataset refreshes
and OneMap token renewal are manual. Distributed rate limiting, load testing,
comprehensive grocery/clinic coverage, BTO/private pricing and GPT extraction are pending.
The account shortlist was implemented and verified on 13 October 2026; see SHORTLIST.md.

## Amenity Extension: 13 October 2026

- Published snapshot `06791665a83fbb6513ea806a93c3a82c319b8dba502720055c48c1b572da3bda`
  contains 2,079 facility points: 462 parks, 129 hawker centres, 1,101 badminton
  venues, 337 MOE schools, 31 hospitals and 19 known supermarket points.
- All MOE directory schools were resolved. Raffles Institution's multiple search
  pages are handled explicitly, using its named administrative centre as the
  representative campus point. No unresolved schools were silently dropped.
- Hospital evidence uses OneMap's MOH hospital layer, not a clinic directory.
  School proximity is not admission eligibility. These scopes appear in the UI.
- Grocery data is a very incomplete current gazetteer lookup, not current inventory
  or a complete supermarket directory. Provisional coverage warnings appear both
  before search and above selected-category results. Missing evidence still affects
  scores, so grocery-weighted results should not be treated as comprehensive.
  The old 2016 licence list was not substituted for current stores.
- Lint, typecheck and 91 unit/PostgreSQL tests pass. Added coordinate validation,
  supermarket lookalike exclusions, school ambiguity rejection, pagination checks
  and all-six-category scoring coverage. The eight original preview tests and two
  updated desktop/mobile recommendation tests pass. Production build passes.
- A separate read-only live test validates the stored payload with the application's
  snapshot schema and scores all six categories against real imported facilities
  and prices. It uses a fixed test journey; this is not a new live-routing claim.
  It writes no accounts, profiles or discoveries. Run explicitly with:

```bash
node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.ts
```

Previous saved discoveries retain their original snapshot. Refresh search to use
the newly published evidence. School coordinate caches are public data in ignored
`.cache/`; credentials remain in environment variables.
