# HomeMatch

Production custom address: [homematch.unify-x.com](https://homematch.unify-x.com),
using Cloudflare DNS and Vercel Hobby. The canonical-address release passes hosted
smoke checks; homematch-sandy.vercel.app redirects to this address.
Google login, a stored map and live Gemini/OneMap interpretation were checked on
the previous hosted address. Sign in once on the new hostname; authenticated
end-to-end acceptance there remains to be repeated. Password reset, deletion and installation are owner-tested. See
[VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for release and rollback details.

Latest local increment: 407 unit/database checks and 46 desktop/mobile browser
regressions, plus one real archived-BTO/OneMap read-only check. The earlier eight-case
real Gemini evaluation passed. Live testing exposed and corrected dropped sports and
false MRT warnings. Coverage, scoped accessibility checks, public-page load results
and remaining deployment gaps are in [the testing report](docs/TESTING_2026-10-14.md).

Deployment hardening includes shared AI/map-operation quotas, bounded request/
provider handling and shared public-snapshot loads. The approved hosted migration
is applied and `OPERATION_LIMITS_ENABLED=true` enabled locally and on Vercel;
hosted permissions and the real backend-client smoke check pass. Other production
hosts must set the same private flag. Production expensive operations cannot bypass shared
protection. See [DEPLOYMENT_HARDENING.md](docs/DEPLOYMENT_HARDENING.md).

Singapore housing-area research, starting with the places and priorities that matter to you.

**Resale HDB recommendations, BTO launch-area research, private-district pricing integration, shortlists and reviewed AI drafts.** Resale HDB profiles produce real-data town rankings, maps, explanations, comparisons and saved areas. BTO/condo/landed profiles retain independent area exploration and can request category-specific ranking. BTO currently covers the seven archived June 2026 projects using before-grant published ranges and town MRT proxies, not project entrances or live inventory. The private ranking/importer is implemented but awaits a URA access key and verified data import. Apple OAuth is prepared but disabled pending provider setup. See [MARKET_RANKING.md](docs/MARKET_RANKING.md), [APPLE_SIGN_IN.md](docs/APPLE_SIGN_IN.md) and [the Lab 3 team handover](docs/TEAM_HANDOVER_LAB3.md).

The recommendation implementation and limitations are documented in [SCORING.md](docs/SCORING.md). Apply all SQL migrations in filename order, then run `node --env-file=.env.local scripts/import-research.mjs` to import official HDB transactions, OneMap parks/hawker/hospital layers, MOE school locations and Sport Singapore's sports census. Grocery scores use a very incomplete OneMap supermarket gazetteer and are clearly marked provisional; healthcare covers hospitals only. Refreshes now use a validated worker; its background schedule is not yet activated. Only successfully imported facilities can contribute to a completed discovery. Shortlist behaviour and verification are documented in [SHORTLIST.md](docs/SHORTLIST.md).

Automatic refresh: `npm run research:refresh` runs one due refresh, `npm run research:status` shows sanitized status, and `npm run research:watch` checks hourly on one designated worker host. A full no-write dry-run has passed against the real official sources. The worker never updates/deletes old evidence or relabels failed refreshes as fresh. Configure private `ONEMAP_EMAIL` and `ONEMAP_PASSWORD` for automatic server-side token renewal; the current local setup has passed a live fresh credential exchange. Hosted publication and worker-host activation remain pending; see [AUTOMATIC_REFRESH.md](docs/AUTOMATIC_REFRESH.md).

Google sign-in requires Supabase's Google provider plus an allowed `/auth/callback` URL. The server callback verifies identity and registers the same application session as email login. API keys remain server-side; Google client secrets belong in the Supabase dashboard.

AI setup: add `GEMINI_API_KEY` to `.env.local` and optionally `GEMINI_MODEL` (default `gemini-3.1-flash-lite`), then restart the app. Manual entry works without a key. Free-tier usage has provider quotas and different privacy terms from Gemini Enterprise. See [AI_PREFERENCES.md](docs/AI_PREFERENCES.md) for live verification status.

Password recovery is enabled. The migration, recovery template, exact callback allowlist, Gmail SMTP configuration and 600-second email expiry have been checked. The owner reports a successful manual reset. New projects must complete those setup steps before enabling `PASSWORD_RECOVERY_ENABLED=true`. See [PASSWORD_RECOVERY.md](docs/PASSWORD_RECOVERY.md).

Account settings supports self-service deletion. A sign-in within ten minutes and explicit `DELETE` confirmation are required. The backend revokes sessions before hard-deleting the verified owner's Auth account; owner-linked profiles, discoveries, bookmarks and history settings cascade. The owner reports successful manual testing. See [ACCOUNT_DELETION.md](docs/ACCOUNT_DELETION.md) for failure handling.

BTO, condominium and private/landed profiles now use **Explore areas** instead of an unsupported ranking request. The explorer reuses 26 town-level representative MRT origins, not individual projects or homes. PropertyGuru links pass the selected area as a keyword with the correct property group; official HDB navigation asks users to select town and mode on that portal. See [AREA_EXPLORATION.md](docs/AREA_EXPLORATION.md). Track implementation and testing separately in [IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md).

## Quick Start

HomeMatch now includes installable PWA metadata and icons, browser-specific installation
options and a production-only public reconnect screen. Private profiles, login responses,
search results and map data are never cached by its worker. Phone installation requires
the real application to be deployed over HTTPS. See [PWA.md](docs/PWA.md) for testing,
update behaviour. The owner reports successful installation testing; exact device/browser details were not supplied.

Requires Node.js 22.12+ (22 LTS recommended) and npm. Docker is **not** needed for the preview or automated database tests.

```bash
git clone https://github.com/JunxingCA/homematch.git
cd homematch
npm ci
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. The default is explicitly labeled **preview mode**: you can edit sample preferences, resolve sample places, review, and confirm a preview. No account is impersonated, and nothing is saved. Only the light/dark theme is stored in the browser.

## Implemented

- Next.js App Router, strict TypeScript, CSS Modules, Zod validation, Lucide icons.
- Responsive light/dark preference editor and review/confirmation flow.
- PWA icons/manifest, supported installation controls, iPhone guidance, standalone mode and public-only offline fallback with user-approved updates.
- BTO / existing-home pathways, housing categories, budgets, flat types, lookback.
- One to four frequent destinations, transport modes and weekly visits.
- Zero to six lifestyle preferences, radii/priorities and three weights totaling 100%.
- Supabase email/password registration, email confirmation, sign-in, sign-out and session resume.
- Configurable email recovery, short-lived link handling, reset validation and old-session revocation.
- Explicit account-deletion confirmation, fresh verified authentication, owner-only hard deletion, session revocation and private workspace cleanup across tabs.
- Owner-only profile create/read/update/delete, maximum four profiles, optimistic revision checks.
- Deterministic Resale HDB scoring, full transaction sample quartiles, frequency-weighted routes, facility evidence, owner-only immutable discoveries, map/list views and same-search comparison.
- BTO/condo/landed unscored area exploration, opt-in journeys, independent amenity layers and category/area-specific external keyword searches.
- Separate BTO launch-range and private-district scoring paths with immutable evidence and category-specific price labels; live URA activation is pending.
- Clear recent searches without deleting saved profiles, bookmarked areas or their original evidence.
- Prepared Apple managed OAuth, hidden/disabled until its provider configuration is ready.
- Explicit confirmation; changed preferences become unconfirmed again.
- Database-enforced 30-minute idle timeout that also protects direct Supabase REST access.
- OneMap address search adapter with token authentication, canonical location storage, and retryable errors.
- Real PostgreSQL migration/RLS tests using PGlite, domain tests, and Playwright desktop/mobile tests.

## Connect Supabase

### Hosted project

1. Create a Supabase project in your own account. No project or paid service is provisioned automatically.
2. Apply `supabase/migrations/202610110001_foundation.sql` using the SQL editor or the Supabase CLI migration workflow. Do **not** run the fixture seed in a production project.
3. Set these private server environment variables in `.env.local`:

```dotenv
APP_MODE=supabase
APP_ORIGIN=http://localhost:3000
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
LOCATION_MODE=onemap
ONEMAP_TOKEN=YOUR_CURRENT_ONEMAP_TOKEN
```

4. Enable email/password authentication and set the minimum password length to 12 in Supabase Auth. Add your local/deployed origin to Auth's allowed URLs.
5. For email confirmation, set the confirmation email link template to:

```text
{{ .RedirectTo }}?token_hash={{ .TokenHash }}
```

The server supplies an exact allowlisted `/auth/confirm` callback as `RedirectTo`, so local and deployed registration use their own origin. Set `SiteURL` to the production origin as the provider fallback. The application validates this email token, registers the verified session, and redirects to a fixed internal path. Configure SMTP before real user testing; email delivery limits still apply. 6. Restart the application after environment changes. Register/sign in through this application, not a separately generated JWT: a verified login must register the application's idle-session record.

Supabase's registration response may deliberately hide whether an email already exists. HomeMatch does not create a duplicate, but uses a generic response to preserve the provider's anti-enumeration behavior; see the documented FR01 discrepancy.

### Optional local Supabase

Install Docker and the Supabase CLI separately, then run:

```bash
supabase start
supabase db reset
supabase status
```

Use the local API URL, anon/publishable key and service-role key returned by the CLI. Set `APP_MODE=supabase`, `LOCATION_MODE=fixtures`, and run the development server. Local seed data contains four clearly labeled sample locations; no users or passwords are seeded. Local email confirmation is disabled by `supabase/config.toml` for repeatable development. Never use that setting as an undocumented production default.

## OneMap

The address adapter uses the [official Search API](https://www.onemap.gov.sg/apidocs/search). Keep the token server-side. Search, routing and research ingestion support automatic renewal using the registered OneMap email/password, validated expiry, shared in-flight renewal and a single retry after explicit token rejection. A token-only setup still requires manual replacement after expiry. Missing credentials or provider failure produces a retryable error rather than fabricated results. Map tiles do not require these credentials.

Fixture locations cannot be used by a production Supabase configuration. `LOCATION_MODE=onemap` rejects fixture-backed destinations; search and choose a real location before confirming. A provider outage preserves typed preferences and blocks confirmation of unresolved destinations.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run test:coverage
npx playwright install chromium
npm run test:e2e
npm run build
npx playwright test --config=playwright.pwa.config.ts
```

Playwright starts its own preview server on port 4317 and saves screenshots under `test-results/`. Unit and integration tests use no paid API calls. PGlite executes the actual migration and RLS inside PostgreSQL with test-only stand-ins for Supabase's `auth.uid()`, `auth.jwt()` and user table; it does not simulate hosted Auth or prove multi-connection concurrency.

The GitHub Actions configuration is provided as `docs/ci.example.yml`, not enabled. The current GitHub login allows repository uploads but not workflow creation. Once an authorized maintainer is ready to enable Actions, place this template at `.github/workflows/ci.yml`. All listed checks already run locally without Actions.

For a production-mode preview, explicitly set `APP_MODE=preview` and `APP_ORIGIN` before `npm start`. Missing production configuration fails closed. `npm run build` alone does not prove that live credentials or migrations are correct.

## Security Model

Supabase stores and hashes passwords. Tokens are managed by `@supabase/ssr` in HttpOnly cookies; no browser Supabase client or localStorage token is used. The backend validates identity with `getUser()` and uses the user's scoped database client for profiles and discovery reads. The service-role key handles fresh-session registration, canonical location/research ingestion, public research reads and backend-computed discovery publication after owner/session checks. Clients cannot publish computed scores.

Every profile RLS policy requires both ownership and an active application session matching the JWT's session ID. Expired sessions cannot be revived by the activity function or token refresh. Explicit user interaction is throttled to at most one activity request per minute; there is no unattended heartbeat. Logout revokes the database guard before ending the Auth session.

Mutating application routes require the configured same Origin. Browser input is strictly validated; SQL triggers independently validate payloads, known locations, bounds, revisions, and the four-profile limit. Preferences are JSON value objects under one RLS-protected profile row to make atomic edits straightforward. See [decisions](docs/DECISIONS.md).

Before internet deployment, complete provider configuration, hosted Auth smoke tests, SMTP/recovery, operational rate limits/request size enforcement, and independent security review. This milestone is not a claim of production readiness or PDPA certification.

## Scope and Next Steps

See [traceability](docs/TRACEABILITY.md), [verification](docs/VERIFICATION.md), and [decisions](docs/DECISIONS.md).

- Implemented increment: deterministic Resale HDB scoring, immutable results, transaction imports, driving/transit routes, parks/hawker/badminton/school/hospital data, provisional partial grocery evidence, map, comparisons and persistent owner-only area shortlists.
- Expanded amenities: 13 available categories including gyms, basketball, football/futsal, swimming, tennis, fitness corners and running tracks. Profiles still select at most six scoring priorities. Independent map exploration loads all imported categories without modifying a profile or saved score; see [amenities](docs/AMENITIES.md) and [map workspace](docs/MAP_WORKSPACE.md).
- BTO/private area exploration is implemented without affordability scores. Current BTO project availability, complete private-neighbourhood boundaries and category-specific price evidence remain separate integrations.
- Implemented data/token refresh: validated separate worker, complete-source safeguards, immutable publication, status/overlap protection and server-side renewal. Live official dry-run and fresh credential exchange passed; hosted publication and schedule activation remain pending. Next data integrations: more facilities and town boundaries.
- Implemented optional AI: Gemini structured draft extraction, missing-field disclosures, unsupported-request acknowledgement, editable manual application, explicit OneMap selection, failure recovery and bounded requests. Gemini 3.1 Flash-Lite passed a live synthetic extraction test.
- Implemented recovery: email request/reset pages and session revocation; live migration and dashboard configuration verified, local flow enabled. A disposable-account email/reset smoke test remains pending.
- Further account work: Apple SSO. Google SSO and self-service account deletion are implemented; hosted deletion testing with a disposable account remains pending.
- Milestone 5: PWA implementation and local browser verification completed; deployed device acceptance, accessibility audit, load testing and deployment hardening remain.

The submitted documents remain in the team's private [school repository](https://github.com/softwarelab3/2006-SCSI-E4/tree/main/HomeMatch), reviewed at commit `d2a26ef1c3cad9b5b80ed1d7f12e34a644938da4`. They are not duplicated or modified by this repository. The application follows the accompanying `HomeMatch/CODING_PROMPT.md` in that working copy.
