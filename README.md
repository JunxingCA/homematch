# HomeMatch

Singapore housing-area research, starting with the places and priorities that matter to you.

**Milestone 1: foundation and manual preferences.** This is application code, not the previous static mockup. Recommendations, ranking, map exploration, GPT extraction, and property evidence are later milestones. No generated ranking is presented here.

## Quick Start

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
- BTO / existing-home pathways, housing categories, budgets, flat types, lookback.
- One to four frequent destinations, transport modes and weekly visits.
- Zero to six lifestyle preferences, radii/priorities and three weights totaling 100%.
- Supabase email/password registration, email confirmation, sign-in, sign-out and session resume.
- Owner-only profile create/read/update/delete, maximum four profiles, optimistic revision checks.
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
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}
```

Set `SiteURL` to the current application origin. The application validates this email token, registers the verified session, and redirects to a fixed internal path. Configure SMTP before real user testing; email delivery limits still apply. 6. Restart the application after environment changes. Register/sign in through this application, not a separately generated JWT: a verified login must register the application's idle-session record.

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

The address adapter uses the [official Search API](https://www.onemap.gov.sg/apidocs/search). Obtain a token through OneMap and keep it server-side. An expired/missing token produces an explicit retryable error, not an empty result or an invented coordinate. Token auto-renewal, map tiles, routing and broader dataset integration are not implemented in this milestone.

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
```

Playwright starts its own preview server on port 4317 and saves screenshots under `test-results/`. Unit and integration tests use no paid API calls. PGlite executes the actual migration and RLS inside PostgreSQL with test-only stand-ins for Supabase's `auth.uid()`, `auth.jwt()` and user table; it does not simulate hosted Auth or prove multi-connection concurrency.

The GitHub Actions configuration is provided as `docs/ci.example.yml`, not enabled. The current GitHub login allows repository uploads but not workflow creation. Once an authorized maintainer is ready to enable Actions, place this template at `.github/workflows/ci.yml`. All listed checks already run locally without Actions.

For a production-mode preview, explicitly set `APP_MODE=preview` and `APP_ORIGIN` before `npm start`. Missing production configuration fails closed. `npm run build` alone does not prove that live credentials or migrations are correct.

## Security Model

Supabase stores and hashes passwords. Tokens are managed by `@supabase/ssr` in HttpOnly cookies; no browser Supabase client or localStorage token is used. The backend validates identity with `getUser()` and uses the user's scoped database client for profiles. The service-role key is restricted to fresh-session registration and canonical location ingestion.

Every profile RLS policy requires both ownership and an active application session matching the JWT's session ID. Expired sessions cannot be revived by the activity function or token refresh. Explicit user interaction is throttled to at most one activity request per minute; there is no unattended heartbeat. Logout revokes the database guard before ending the Auth session.

Mutating application routes require the configured same Origin. Browser input is strictly validated; SQL triggers independently validate payloads, known locations, bounds, revisions, and the four-profile limit. Preferences are JSON value objects under one RLS-protected profile row to make atomic edits straightforward. See [decisions](docs/DECISIONS.md).

Before internet deployment, complete provider configuration, hosted Auth smoke tests, SMTP/recovery, operational rate limits/request size enforcement, and independent security review. This milestone is not a claim of production readiness or PDPA certification.

## Scope and Next Steps

See [traceability](docs/TRACEABILITY.md), [verification](docs/VERIFICATION.md), and [decisions](docs/DECISIONS.md).

- Milestone 2: deterministic scoring, immutable request snapshots and evidence-backed results/map.
- Milestone 3: transaction ingestion, routes, facilities and freshness handling.
- Milestone 4: GPT draft extraction, Google/Apple SSO, password recovery, account deletion, shortlist and comparisons.
- Milestone 5: installation/PWA behavior, accessibility audit, load testing and deployment hardening.

The submitted documents remain in the team's private [school repository](https://github.com/softwarelab3/2006-SCSI-E4/tree/main/HomeMatch), reviewed at commit `d2a26ef1c3cad9b5b80ed1d7f12e34a644938da4`. They are not duplicated or modified by this repository. The application follows the accompanying `HomeMatch/CODING_PROMPT.md` in that working copy.
