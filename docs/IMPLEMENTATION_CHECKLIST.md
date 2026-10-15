# HomeMatch Implementation Checklist

Updated 15 October 2026. A checked implementation item means working code exists.
A checked verification item means the named checks were actually run, not merely
written. Hosted/provider checks are separate from fixtures and owner-reported
acceptance. See VERCEL_DEPLOYMENT.md for the actual production release.

## Local Increment: Login Landing Page

- [x] Add an optional rose/cranberry palette preview at /welcome?palette=rose,
  retaining emerald at /welcome?palette=emerald. Verify landing/planner colours,
  matching logo, both themes and desktop/mobile layout without new stored data;
  all 14 landing/palette browser checks and 407 unit/database checks pass.
- [x] Add deeper crimson at /welcome?palette=red with white-text primary actions,
  matching HomeMatch logo and dark/light surfaces. Preserve rose/emerald options;
  all 16 desktop/mobile landing/palette checks pass. No Singpass integration or
  government affiliation is implied; these previews remain local only.

- [x] Add a HomeMatch-branded, photo-led signed-out entrance with working paths to
  existing sign-in/registration/recovery and the non-persistent manual planner.
- [x] Preserve direct workspace access for signed-in users; add /welcome to inspect
  the entrance without signing out. No auth, callback or database policy is widened.
- [x] Verify desktop/mobile, dark/light, login/recovery errors, returning sessions,
  image loading, keyboard behaviour and no horizontal overflow. Fix the modal opener
  losing focus after a failed provider request; test the non-persistent planner.
- [x] Pass 407 unit/database checks, lint/types, 12 new landing checks, 46 existing
  account/AI/map/market checks, eight recovery checks and a production build.
  Browser authentication/email responses use fixtures, not real account changes.
- [ ] Deploy this increment only after local checks and review. Current live release
  remains separately recorded in VERCEL_DEPLOYMENT.md.

## Future Feature: Property Listing Detail Overlay

- [x] Record the user's photo-gallery/property-facts reference as future work in
  FUTURE_PROPERTY_DETAILS.md, with source/permission and scope gates.
- [ ] Obtain authorised listing/photo/lease/room data before building a live feed;
  historical HDB transactions are not listing inventory or photo permission.
- [ ] Build/test the gallery, asking-price/area/psf/lease/unit facts, More details,
  distance toggles and property-specific routes, including mobile and missing data.
- [ ] Revise SRS/use cases/data model for listing integration and distinguish area
  saves/scores from property saves/evidence; do not present this as implemented.

## Previous Increment: Custom Domain, History and Market Ranking

- [x] Configure and verify DNS-only Cloudflare CNAME for homematch.unify-x.com; remove the accidental homemate project attachment.
- [x] Implement account-scoped Clear recent searches with explicit confirmation, failure/retry, reload persistence and cross-tab refresh.
- [x] Keep saved profiles, bookmarks and immutable result evidence intact; test RLS, anonymous/expired sessions, ownership and new searches after clearing.
- [x] Pass desktop/mobile history cancellation, clear, retry, reload and preservation checks.
- [x] Apply additive history settings/RPC and backend-only private snapshot migrations after local PostgreSQL tests; existing account data is unchanged.
- [x] Implement separately versioned BTO launch-area range scoring and private-district transaction scoring; preserve the resale formula.
- [x] Add all seven June 2026 HDB launch price ranges with explicit closed-launch opt-in, pre-grant pricing and town-proxy limitations.
- [x] Prepare the four-batch URA importer, projection conversion, private size/area/sale filters and missing-source errors; never substitute HDB or fixture prices.
- [x] Integrate source-appropriate prices, budget measures and labels into map/list, comparison and saved areas.
- [x] Prepare disabled-by-default Apple OAuth, shared verified callback, UI flag and APPLE_SIGN_IN.md setup instructions.
- [x] Pass 407 unit/database checks, strict types and lint; pass all 46 desktop/mobile account/AI/map/history/market regression checks after fixes.
- [x] Pass domain coverage gates (over 97% branch coverage) and a production build; inspect dark/light desktop/mobile screenshots.
- [x] Pass a read-only real-data check of all seven archived BTO projects using the public research snapshot and real OneMap journeys; zero user writes.
- [x] Record owner-reported manual success for account deletion, password reset and installation, without claiming independently repeated device tests.
- [x] Prepare TEAM_HANDOVER_LAB3.md with design boundaries, testing/setup steps, demo order, task ownership and exact Lab 3 deliverables.
- [x] Complete private GitHub source push, canonical domain release and hosted smoke checks; application commit `68c03d8`, deployment `dpl_G6C5hLqmm6GvXPXeXn6vKvgjo1By`. Authenticated end-to-end acceptance on the new hostname remains separate.
- [ ] Obtain URA_ACCESS_KEY, import real private prices and verify district/type/size samples against URA; this external connection is not complete.
- [ ] Configure Apple Developer/Supabase provider and validate real Apple sign-in; currently deliberately disabled.
- [ ] Expand BTO beyond the archived June catalogue, verify individual project coordinates and automate launch-source maintenance; not a complete live BTO inventory.

## Previous Increment: Free Vercel Deployment

- [x] Create and link HomeMatch in the confirmed Vercel Hobby workspace; no paid plan enabled.
- [x] Configure Next.js, Node.js 22, Fluid Compute, Singapore region and private source browsing.
- [x] Exclude local credentials/data, research worker and test artifacts; verify actual CLI upload manifest.
- [x] Pass local lint/types/362 unit/database tests and local/remote production builds.
- [x] Publish a no-credentials read-only preview at https://homematch-sandy.vercel.app; verify HTTPS/PWA assets, preview-only actions, foreign-origin denial and source/secret-file protection.
- [x] Inspect desktop/mobile hosted screenshots with no horizontal overflow; document release and rollback steps in VERCEL_DEPLOYMENT.md.
- [x] Transfer approved server-only Production credentials, preserve local callbacks and add exact hosted callbacks; verify saved signup/recovery template compatibility.
- [x] Create an approved deployment-only commit without pushing or including unrelated changes; configure the user's supplied GitHub email locally and verify JunxingCA is linked in Vercel.
- [x] Correct only that unpublished commit's email after separate approval (6458ac0, identical file contents) and pass Vercel's author gate normally; verify Node 22.x, sin1 and Hobby.
- [x] Deploy the real backend at https://homematch-sandy.vercel.app; verify non-preview mode, protected endpoints, exact Google callback/secure cookies, HTTPS callback headers, PWA assets and public-bundle secret scan.
- [x] Save/verify the production Supabase Site URL while preserving all three local and three hosted callbacks; retain deployment and rollback instructions.
- [x] Verify owner-completed hosted Google login, stored search/map/independent layers and one synthetic Gemini interpretation with live OneMap candidate resolution; no saved profile changes.
- [ ] Complete fresh hosted recommendation/publication and saved-area acceptance; opening a stored search is not a cold provider benchmark.

## Previous Increment: Testing And Gemini Evaluation

- [x] Add an opt-in eight-case real Gemini evaluation with synthetic inputs, bounded requests, retained results and no account writes.
- [x] Fix missing-numeric sports being dropped and MRT travel being misclassified as an unsupported station-proximity request; final live run passes eight of eight.
- [x] Expand interpretation/scoring tests and enforce per-file coverage gates; 360 unit/database checks pass, with 100% scoring coverage and 99.36% overall domain branch coverage.
- [x] Pass 40 desktop/mobile browser regressions, including keyboard, pending request, failure and expired-session AI checks.
- [x] Complete eight preference/AI accessibility scans across both themes/viewports; fix progress group semantics, with zero final violations/incomplete findings.
- [x] Pass 24 production PWA regressions, lint, types and production build; three platform-specific PWA skips remain intentional.
- [x] Measure a bounded 50-request loopback public-HTML batch with zero errors; explicitly not a full authenticated search benchmark.
- [x] Record findings, actual Gemini latency, domain coverage and remaining gaps in TESTING_2026-10-14.md.
- [ ] Complete deployed authenticated search load/latency tests, whole-app/manual accessibility and physical-device acceptance.

## Previous Increment: Deployment Hardening

- [x] Prepare backend-only shared account/service quotas and expiring request slots for AI, discoveries, explorer journeys and manual location search.
- [x] Fail closed on shared-limiter faults/production-disabled configuration; stage activation without disrupting current local guards.
- [x] Bound JSON bytes/read time, Supabase HTTP duration and OneMap streamed responses; preserve caller cancellation and avoid automatic write replay.
- [x] Preserve quota retry hints and private/no-store Retry-After responses.
- [x] Share concurrent public-snapshot loads without caching private users or altering source freshness.
- [x] Revalidate owner/profile revision before publication; test cleanup/concurrent-admission races.
- [x] Pass final lint/types, 343 unit/database checks (62 new), 34 desktop/mobile regressions, 24 production PWA checks and production build.
- [x] Apply approved hosted operation-limits migration, enable OPERATION_LIMITS_ENABLED locally and verify live backend permissions/admission/release (one opt-in backend-client smoke check passes; no account/provider calls).
- [ ] Configure platform ingress/Auth protections and measure hosted load/provider latency; these code-level limits are not a production-readiness claim.

## Previous Increment: Research Refresh and OneMap Renewal

- [x] Implement server-side token renewal shared by search, routing and research ingestion; single-flight renewal, bounded retry and failure backoff.
- [x] Preserve token-only configuration and keep renewed credentials/tokens out of browser storage and logs.
- [x] Add a separately runnable refresh worker, interval checks, single-host overlap lock, sanitized status and graceful cancellation.
- [x] Share the actual snapshot schema between app and collector; validate complete sources and reject stale/regressed/partial candidates before one insert.
- [x] Keep existing snapshot IDs, dates, discoveries and scores immutable; dry-run candidate dates do not replace active dataset freshness.
- [x] Test renewal, all-source collection, validation, failures, cancellation, unsafe/large downloads and locking (60 new unit checks; 281 total unit/database checks pass).
- [x] Complete real official-source dry-run: 26 towns, all 13 categories, 337 schools and 19 known supermarket points; no snapshot publication or account writes.
- [x] Pass 34 account/map/AI/explorer checks, 24 PWA checks, lint/types and production build; client bundles do not contain the new private environment keys.
- [x] Verify real credential-based OneMap renewal and one public NTU landmark search; private credentials supplied in .env.local, no account/database writes.
- [ ] Confirm a hosted snapshot publication and enable the chosen worker host's schedule; no timer has been activated yet.

## Completed Increment: Installation and Safe Offline Handling

- [x] Implement PWA manifest, existing-logo icons, standalone launch and Apple metadata.
- [x] Add supported browser installation, iPhone instructions and cancellation/error handling.
- [x] Add a production-only worker caching exactly four public reconnect assets, never private responses.
- [x] Preserve in-memory edits offline without automatic request replay; reconnect through a token-free home link.
- [x] Require explicit approval for a waiting update; retain unrelated caches and other tabs' UI.
- [x] Test PWA privacy/lifecycle/metadata (25 new unit checks; 221 unit/database checks total).
- [x] Test production worker, offline/reconnect and installation UI (24 Chromium checks; desktop/Android/iPhone emulation, three platform-specific skips).
- [x] Inspect desktop/mobile installation and offline screenshots in both themes.
- [x] Pass the 50 existing browser regression checks alongside 24 new PWA checks; production build, lint and strict types pass.
- [ ] Verify real device installation, installed Google sign-in and real worker upgrades after HTTPS deployment. Emulated UI checks are not physical-device acceptance.

## Completed Increment: Area Exploration and Listing Links

- [x] Implement BTO, condominium and private/landed exploration from confirmed profiles.
- [x] Show imported town origins and amenities without invented price or match scores.
- [x] Add opt-in OneMap journeys for the selected area, with failure/retry handling.
- [x] Add area-keyword/property-type PropertyGuru links and official HDB navigation.
- [x] Verify PropertyGuru's keyword/property-type URL through its actual public controls.
- [x] Verify official HDB navigation; its town selection does not produce a portable URL.
- [x] Test input bounds, profile ownership/revision, stale data and expired sessions (196 unit/database tests pass).
- [x] Test BTO/condo/landed flows, layers, retries and external-link state preservation (ten explorer browser checks pass).
- [x] Inspect desktop/mobile light/dark screenshots; check map rendering and overflow (1440px/360px; compact mobile markers and controls corrected).
- [x] Pass lint, types, 196 unit/database tests, 50 browser regression checks and production build.
- [x] Verify live public catalogue/amenities read-only and one OneMap transit route between public landmarks (two opt-in checks pass; no account writes).
- [ ] Complete hosted exploration acceptance with a user-approved disposable BTO/private profile; this is separate from the passing mocked-browser and live public-data checks.

## Existing Core

- [x] Implement registration, Google sign-in, session expiry and profile storage.
- [x] Implement Gemini draft review and explicit OneMap location confirmation.
- [x] Implement real-data Resale HDB rankings, evidence, comparison and saved areas.
- [x] Implement 13 amenity categories and independent map layers/legend.
- [x] Implement password recovery and secure account deletion.
- [x] Verify existing automated baseline: 179 unit/database and 40 browser checks; build passed.
- [ ] Complete real email delivery and disposable-account password-reset smoke test.
- [ ] Complete explicitly approved disposable-account hosted deletion smoke test.

## Next In Order

- [x] Implement PWA manifest, icons, supported installation and safe offline handling.
- [x] Verify desktop/mobile-emulated PWA behaviour and iPhone installation instructions in automated checks.
- [ ] Complete deployed desktop, Android and iOS installation acceptance, including Google sign-in and real updates.
- [ ] Implement Apple SSO after provider configuration is available.
- [ ] Test Apple success, cancellation and identity handling with configured credentials.
- [x] Implement automatic validated dataset refresh and OneMap token renewal.
- [x] Test failed refresh preserves the last valid snapshot and reports freshness accurately.
- [x] Supply private OneMap credentials and verify live renewal.
- [ ] Activate the selected worker host and confirm its first scheduled publication.
- [x] Implement shared expensive-operation limits, request deadlines, public-cache single-flight and provider retry hints; activation is staged.
- [x] Apply/activate shared limits locally and verify hosted security/admission/release after approval; production-host environment activation remains part of deployment.
- [ ] Configure edge ingress and production Auth abuse protections.
- [ ] Measure the 50-user/five-second target, including cold/warm and real-provider limits.
- [x] Complete domain scoring/interpretation coverage report and update current testing traceability.
- [x] Complete automated preference/AI keyboard and accessibility checks in both themes/viewports.
- [ ] Complete whole-app/manual accessibility and physical-device acceptance; scoped automated scans are not certification.
- [x] Deploy the backend-powered app to Vercel Hobby with HTTPS and production callbacks; retain deployment/rollback instructions.
- [ ] Enable GitHub CI and publish the remaining application changes after explicit approval; only deployment configuration is committed locally so far.
- [ ] Complete signed-in deployed end-to-end acceptance; anonymous deployment smoke checks already pass.

## Separately Scoped Enhancements

- [ ] Approved BTO project dataset, current launch availability and project-origin mapping.
- [ ] Approved condo/landed transaction evidence and category-specific affordability formulas.
- [ ] Comprehensive private-neighbourhood origins/boundaries and grocery/clinic coverage.
- [ ] Persist and compare unscored exploration evidence if added to the assessed scope.

These enhancements are not prerequisites for an honestly labelled area explorer.
