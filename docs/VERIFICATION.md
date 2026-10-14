# Milestone 1 Verification

## Testing And Gemini Evaluation, 14 October 2026

- 360 unit/database checks pass, plus 40 desktop/mobile regressions and 24 production
  PWA checks (three platform-specific skips). Lint, strict types and production build pass.
- Final real Gemini corpus: eight of eight pass. Earlier runs exposed dropped
  activities and unsupported MRT warnings; both were corrected without weakening
  the assertions. Three bounded runs used 24 synthetic API calls, no account writes.
- Domain coverage: 100% lines/statements/functions, 99.36% branches; scoring is 100%
  on all metrics and interpretation 98.61% branches. This excludes controllers/UI.
- Eight preference/AI WCAG-tag scans show zero violations and zero incomplete items,
  after correcting the progress indicator's semantic role. Manual/whole-app acceptance remains.
- Local production-preview public HTML handled fifty concurrent requests, zero errors,
  sample p95 140 ms. This does not test authenticated recommendations/provider load
  or meet/prove NFR01/NFR02 by itself.
- Zero production dependency advisories; five existing high-severity development
  ESLint/glob advisories remain, without a force-fix/framework downgrade.
- Full evidence and remaining gaps: TESTING_2026-10-14.md. Generated coverage, provider
  outputs, accessibility scans and load results stay in ignored test-result directories.

## Deployment Hardening Increment, 14 October 2026

- Lint, strict types and 343 unit/database checks pass, including 62 new checks for
  shared quotas/slots/RPC permissions, crash expiry/fencing, account/global capacity,
  staged activation, fail-closed admission, body/SDK/provider bounds, cache single-flight,
  controller cleanup, profile revalidation and asynchronous local-guard races.
- Isolated PGlite queues fifty different-owner admissions and verifies six AI slots.
  A separate cache test shares fifty calls through one public snapshot read. These
  are not hosted multi-connection or fifty-user/five-second network benchmarks.
- Production build passes, along with 34 desktop/mobile account/map/AI/explorer
  regressions and 24 production PWA checks (three iOS-prompt-specific skips).
  The first sandbox browser attempt failed before launching Chromium due to macOS
  permissions; permitted reruns passed. Client bundles contain no references to
  the Gemini, service-role or OneMap credential environment keys.
- After explicit approval, hosted migration 20261014085711_operation_limits was
  applied and OPERATION_LIMITS_ENABLED=true enabled in the local private environment.
  The local server was restarted at port 4175. Hosted permission queries verify
  backend-only table/RPC access; a rolled-back service-role transaction verifies
  admission, duplicate blocking, release and old-lease fencing. One opt-in real
  backend-client test also passes, leaving only synthetic limiter telemetry and no
  active slots. No account/profile/research writes or paid-provider calls occurred.
  Existing Auth/security-advisor notices are recorded in DEPLOYMENT_HARDENING.md.
  Production host activation, signed-in acceptance, ingress/Auth abuse controls
  and actual latency remain deployment work.

## Automatic Refresh Increment, 14 October 2026

- Lint, strict types and 281 unit/database tests pass. Sixty new checks cover token
  renewal/expiry/concurrency/backoff, complete controlled source collection, shared
  validation, snapshot immutability, regressions, cancellation, download bounds and locking.
- Production build passes. Thirty-four account/map/AI/explorer browser checks and
  24 production PWA checks pass; three iOS-native-prompt cases are intentionally skipped.
- The client bundle scan finds no ONEMAP_EMAIL, ONEMAP_PASSWORD or service-role key references.
- A real `--once --dry-run` completes collection and validation across official
  HDB data, 26 representative MRT origins and all 13 amenity categories: 337 school
  campuses and 19 known supermarket points. All eight sports categories are included.
  A candidate snapshot is reported separately; the active snapshot remains
  b53b1f6c4178d16c8fb601b156e749f5efa467bc41ded259af201e687c4d208a
  with its original 12 October 2026 retrieval date. No account or snapshot writes occurred.
- The dry run uses the existing manual OneMap token. After credentials were supplied
  privately, a separate live check passes a forced fresh credential exchange plus one
  public NTU landmark search, without a seed token or database writes. Hosted
  publication and scheduler activation remain acceptance checks. No Linux service,
  school VM or cloud schedule was installed.
- No new database schema/permissions or dependencies are introduced. Public school
  geocode caches and a sanitized local worker status file are the only live-test file writes.

See AUTOMATIC_REFRESH.md and IMPLEMENTATION_CHECKLIST.md.

## PWA Increment, 13 October 2026

- Lint, strict types and 221 unit/database checks pass, including 25 new manifest,
  icon, worker allowlist, navigation, Auth-token safety and update lifecycle checks.
- The production build passes, including the manifest and icon assets.
- 24 production-preview PWA browser checks pass; three native-prompt checks are
  intentionally skipped on the iOS-guidance profile. Actual worker registration,
  offline navigation/cache contents and reconnect are exercised in Chromium.
  Prompt events, standalone detection and waiting updates use controlled fixtures.
- Tests cover desktop, 360px Android emulation and 390px iPhone user-agent emulation,
  not real Android/iOS installations. Installation/offline light/dark screenshots
  were visually inspected. The header remains usable on narrow mobile screens.
- The existing 34 account/map/AI/explorer, eight preview and eight password-recovery
  regression checks pass: 74 browser checks total including PWA. No hosted account
  changes or database migrations were needed.
- Real device installation, installed Google sign-in, deployed worker updates and
  deployed cache headers remain acceptance checks, documented in PWA.md.

## Area Exploration Increment, 13 October 2026

- Lint and strict type checking passed; 196 unit/database tests passed.
- 34 account/map/AI/exploration browser checks passed, including ten new explorer
  checks. Eight original preview and eight password-recovery checks passed: 50
  browser checks total on 1440px desktop and 360px mobile.
- The production build passed with the new /api/exploration endpoint.
- Desktop/mobile light/dark screenshots were visually inspected. Removed irrelevant
  profile-progress UI, retained supported OneMap zoom levels, made mobile area
  markers compact and moved controls clear of them. Both tile themes render.
- Two read-only opt-in live checks passed: public catalogue/amenity validation and
  OneMap public-transport routing from the Bedok reference point to a public NTU
  landmark. No personal profile reads, saved discoveries or account writes occurred.
- PropertyGuru's keyword and type filters were verified using its actual public
  controls. HDB's town search produced no portable town URL; links disclose that
  users must select town/mode on the official portal.
- Browser account/profile requests remain mocked; a complete hosted explorer flow
  with an approved disposable BTO/private profile remains an acceptance check.
  Current project availability and private-property price scoring are not claimed.

See AREA_EXPLORATION.md and IMPLEMENTATION_CHECKLIST.md for scope and remaining work.

## Account Deletion Increment, 13 October 2026

This section supersedes account-deletion deferral in the historical milestone
report below. Lint and type checking pass; 179 unit/database tests pass. The account,
map and AI regression suite passes 24 Chromium desktop/mobile checks, including ten
account-deletion checks with mocked account APIs. Eight preview checks and eight
password-recovery checks also pass, for 40 browser checks total. The production
build passes, including the new /api/account route.
Both themes of the account confirmation dialog were visually inspected without
clipping or overlap. No real account was deleted. Hosted Auth hard deletion and
email/reset delivery still require disposable-account smoke tests; see
ACCOUNT_DELETION.md and PASSWORD_RECOVERY.md.

Map regression testing also identified cached tiles masking simulated outages and
old loaded tiles clearing a newer tile-error warning. The outage test now requests
an uncached zoom level, and failed layers retain their warning until a fresh layer
loads successfully after retry/theme change.

Verified locally on 12 October 2026 (Singapore), Node.js 22.20.0, macOS arm64.

| Check actually run | Result |
| --- | --- |
| `npm run lint` | Passed. |
| `npm run typecheck` | Passed. |
| `npm test` | 53 tests passed in four files. |
| `npm run test:coverage` | Passed; preference-domain module has 100% statements, branches, functions and lines. This is **not** scoring-engine coverage; scoring is not implemented. |
| `npm run test:e2e` | Eight tests passed across Chromium desktop (1440px) and mobile (360px). |
| `npm run build` | Passed; page and all seven API/auth route groups compile. |
| `npm audit --omit=dev` | Zero reported production dependency vulnerabilities. |
| `npm audit` | Five high-severity findings in the lint-only chain: eslint-config-next -> @next/eslint-plugin-next -> fast-glob -> micromatch -> braces. No patched braces release was available from the registry when checked. Do not feed untrusted glob patterns into lint tooling. Recheck before deployment; do not use `audit fix --force` to downgrade the framework blindly. |

## What the Tests Establish

- Domain validation: required/resolved destinations, destination/lifestyle limits, unique selections, valid budgets/weights, zero-lifestyle rule, and exact inactivity boundary.
- Actual PostgreSQL SQL/RLS, using PGlite: owned CRUD, cross-user select/update/delete/insert denial, immutable ownership, fifth-profile rejection, stale revision protection, canonical-location validation, confirmation invalidation, expired-session denial, non-revival, logout revocation, service-only session registration, anonymous denial, and deletion cascade.
- Managed-auth orchestration with a mocked SDK: invalid-login handling, server-side identity verification before session registration, registration failure cleanup, email-confirmation pending state, password bounds and logout order.
- OneMap adapter with mocked HTTP/database: canonical parsing, server token use, valid empty result, HTTP-200 provider errors, malformed coordinates/schema, missing token, network failure and catalog failure.
- Browser preview: manual edit -> search/select -> review -> explicit preview confirmation; unresolved-place/weight errors; both themes and persistence; BTO selection; sign-in disclosure; no page-level horizontal overflow; cross-origin mutation denial and preview write denial.

## Visual Inspection

Desktop dark and mobile light full-page screenshots were opened and visually inspected for clipping and overlap. Additional screenshots are produced for both themes and the review step. The Next.js development indicator was disabled after the initial inspection and screenshots regenerated.

Committed examples are in `docs/screenshots/`. These are preview-mode screenshots, not evidence of live accounts or real recommendation results.

## Not Yet Verified

- GitHub Actions is not enabled: the current OAuth credential lacks `workflow` scope. The check configuration is retained as `docs/ci.example.yml`. Local checks, not a remote CI run, are the verification evidence for this milestone.

- A hosted Supabase project, real email delivery/confirmation, or a real OneMap token was not available. No claim is made that cloud migrations, authentication, SMTP or provider access were exercised live.
- Docker was not installed; the full local Supabase stack was not started. PGlite runs the migration with test-only Auth role/functions, not the actual Supabase Auth service.
- The advisory lock protects the concurrent profile-limit path by design, but PGlite tests are serialized. A multi-connection PostgreSQL race test is still required before production.
- Google/Apple OAuth, recovery, account deletion UI, scoring, dataset ingestion, map exploration, shortlist, comparison and PWA installation are later milestones.
- No 50-user performance result, completed accessibility audit, production deployment or PDPA certification is claimed.

## Live Smoke-Test Checklist

1. Apply the migration to an isolated Supabase project and configure real environment values using README.md.
2. Register two different users; complete email confirmation with the configured template; sign in/out and resume a valid session.
3. Search a real place through OneMap. Check canonical coordinates and confirm a profile.
4. Create four profiles and attempt a fifth, including simultaneous requests from two tabs.
5. Read/update/delete a profile from its owner; attempt the same IDs using the other account's JWT and confirm denial.
6. Expire the application's `private.app_sessions.last_activity` in the isolated test project. Confirm API and direct Supabase data access fail even with an otherwise valid token, then reauthenticate.
7. Edit a confirmed profile, check that it becomes a draft, and re-confirm. Race a stale revision to verify conflict handling.
8. Remove/expire the OneMap token and verify entered text survives; restore it and retry.

Use test accounts only. Never commit keys, real profile data, or complete token responses as verification evidence.
