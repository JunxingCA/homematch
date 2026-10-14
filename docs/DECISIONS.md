# Implementation Decisions

## Deployment Hardening Increment, 14 October 2026

Expensive authenticated operations gain database-backed admission shared across app
instances, with account/global quotas and expiring concurrency slots. Backend-only
SECURITY INVOKER RPCs and pseudonymous counters avoid trusting browser IDs or
forwarded IPs. Existing local guards remain for staged rollout; shared protection
was activated locally after approval and hosted permission/RPC checks. Production cannot use
the development exemption. Bounded JSON/SDK/provider handling and shared public
snapshot loads reduce unbounded work without replaying uncertain mutations. This
does not claim the 50-user/five-second target, edge protection or deployed acceptance.
See DEPLOYMENT_HARDENING.md for policies and residual limits.

## Automatic Refresh Increment, 14 October 2026

The existing research importer is now a collector behind a separate, single-host
worker rather than a long-running web request. It shares the app's actual snapshot
schema, validates every source plus conservative count/date regression guards,
then publishes one new immutable snapshot. Retrieval time is included in the new
identity; old evidence is never relabelled as fresh. A no-write candidate is separate
from the active dataset and confirmed last success. Retention is not automated.

OneMap search/routing/ingestion share a server-side credential exchange implementation
with token-only compatibility, renewal single-flight, failure backoff and one auth
retry. The core is an ES module usable by Node workers; the Next facade remains
server-only. Tokens are in process memory, never browser/local cache files. The
schema module's declaration is generated with TypeScript from its runtime JavaScript
so Node and Next do not maintain diverging validation models.

The single-filesystem lock is deliberately not advertised as distributed coordination.
Choose one worker host. A hard-killed job's orphan lock needs operator review; no
unsafe time-only takeover is implemented. Linux templates are supplied, not enabled.
The live dry-run succeeds without database writes. A separate forced credential
exchange and public NTU landmark search pass after private configuration. Scheduled
hosted publication remains unverified. See AUTOMATIC_REFRESH.md.

## PWA Increment, 13 October 2026

Installation reuses the web application; no native client, app-store release or new
Auth/database model is introduced. Next's manifest convention and existing vector
logo supply metadata/icons. Browser-native installation is offered only when its
event is available; Safari receives manual instructions. Installed/standalone state
does not replace server-side session verification.

The worker uses a narrow explicit allowlist of four credential-free public reconnect
assets. No automatic runtime caching, offline preferences, background synchronisation
or request replay is implemented. This deliberately keeps profile/Auth/AI/map data out
of Cache Storage. Updates wait for user-approved reload, preserving unsaved work until
that decision. Production registration is separate from development. Native phone
installation and deployed update acceptance remain unverified; see PWA.md.

## Milestone 1 Boundary

The user requested Milestone 1 only: foundation, managed sign-in, inactivity, profile CRUD and manual confirmation. This repository does not implement the full coding brief yet. The source documents and prompt are in the separate school repository. Next.js/TypeScript/Supabase follow Lab 2's submitted stack, not the earlier FastAPI suggestion.

## Authentication

- Implemented email/password authentication first, preserving FR01/FR02. Google and Apple SSO, recovery and account deletion belong to Milestone 4 in the brief and are not advertised as working.
- FR01 calls for explicit duplicate-email rejection. Supabase prevents duplicates but may deliberately return a generic result with confirmation enabled. Preserve provider anti-enumeration behavior; team approval/document alignment is needed for the message difference.
- Credentials are managed by Supabase, not a duplicate `passwordHash` field. The logical HomeSeeker identity maps to `auth.users.id`; no redundant application user table is needed until separate profile metadata is used.
- Cookies are HttpOnly and same-site. `getUser()` verifies server-side identity. Only a fresh verified login/confirmation can register the idle guard using a server credential.
- Private session rows reference Auth users; direct data access requires the same JWT session ID and last activity less than 30 minutes old. A token refresh cannot revive expired application access. A revoked token may otherwise stay cryptographically valid, so RLS checks the separate guard.
- Automatic background activity does not count. A UI interaction can send an activity request once per minute; authenticated profile/search actions also count. Session status checks do not extend activity. All tabs use the same database-backed clock.

## Data Modeling

`PreferenceProfile` stores destinations, lifestyles, weights and lookback as JSON value objects. They have no independent identity/lifecycle in this milestone and are replaced atomically. All nested personal data inherits the parent row's owner/session RLS. Domain types and SQL enforce their constraints. This is a physical mapping of the submitted entities, not a claim that the class diagram mandated JSON.

Four-profile enforcement uses a per-owner transaction advisory lock and a database trigger. Updates increment a database-owned revision; stale updates/deletes match no row. Changing payload invalidates confirmation. Inserts cannot be pre-confirmed, even through direct REST. Confirmation is a separate update after review. Creating a profile and confirming it are two calls: a failed second call keeps the created draft ID/revision so retry does not duplicate it.

Location coordinates are not trusted just because the client says `source=onemap`. The trusted adapter populates a canonical catalog; SQL verifies selected label, coordinates and source against it. Local test seed entries explicitly use `source=fixture`. No map routing or distances are fabricated.

Future discovery snapshots, transactions, facilities, formula versions and shortlist tables are deferred to their respective milestones, rather than shipping untested empty schemas for the entire app.

## Provisional Input Bounds

Not fully specified by the submissions: profile name 1-60 characters; budget SGD 0-20 million with maximum at least 1; lookback 1-60 complete months; visits 1-21/week; lifestyle radius 100-5,000 metres; priority 1-5. Weights are whole percentages, nonnegative, totaling 100. Flat types and lifestyle categories are unique. The no-lifestyle rule requires explicit zero lifestyle weight, with no automatic redistribution. These defaults need team agreement.

## Preview and Product Scope

- Development without credentials defaults to an explicitly labeled, non-persistent preview. Production has no implicit mode fallback.
- Preview editing/review is not authenticated profile CRUD and does not produce a recommendation. Sign-in clearly says it is not connected rather than accepting fake credentials.
- BTO versus existing homes and private categories remain selectable. HDB resale evidence is not BTO pricing or private-market affordability; UI discloses this. No scoring is available yet for any category.
- The existing HomeMatch vector logo is reused unchanged. Google Fonts are loaded with system-font fallbacks. Offline font packaging and installable PWA behavior are deferred.

## Official References Checked

### Area Exploration Increment 13 October 2026

Confirmed BTO/private profiles now support unscored area exploration. The original
Resale HDB formula and snapshots are unchanged. Imported town-level MRT origins,
facilities and explicitly requested journeys provide context, not project/home
prices, eligibility or available listings. Budgets and weights are not silently
renormalised into a new scoring formula. Full category-specific ranking remains
deferred pending separate evidence. The view is ephemeral, with no new schema or
pretend persisted discovery. AreaMap now accepts a score-optional map context so an
unscored explorer does not need fabricated Discovery/AreaResult values.

PropertyGuru's actual public filters verified keyword and H/N/L property groups.
Keyword searches are explicitly not boundary searches. HDB's actual town search
produced no portable filter URL, so official links require manual town selection.
No unsupported query parameters or static current-project availability are claimed.
See AREA_EXPLORATION.md and IMPLEMENTATION_CHECKLIST.md for verification and scope.

### Account Recovery Increment 13 October 2026

Password recovery is now implemented locally, superseding its Milestone 1 deferred
status above. Google SSO and Gemini extraction were also added in earlier increments.
The reset token is consumed only with explicit submission of validated passwords,
not on GET. Recovery uses an isolated ephemeral Auth client and never registers a
data-access session. All of the verified owner's application sessions are revoked
before update, so old JWTs cannot retain RLS access. The backend-only migration is
required; missing support fails closed. Email OTP expiry and transactional delivery
must be configured before enabling the feature. See PASSWORD_RECOVERY.md for the
exact setup and residual limitations. Account deletion was implemented in the
increment below; Apple SSO remains later work. No production readiness claim is made.

### Account Deletion Increment 13 October 2026

Self-service deletion supersedes the Milestone 1 deferred status. The server derives
the owner from a verified, active session and accepts no client-supplied account ID.
A typed DELETE confirmation and signature-verified AMR sign-in timestamp less than
600 seconds old are required. This ten-minute window is a provisional security
policy for team agreement; JWT issuance/token refresh is not fresh authentication.
Recovery and anonymous methods are not sufficient proof.

The existing service-role-only revoke_user_sessions function runs before Auth hard
deletion. Existing cascading foreign keys remove personal data; shared source data
is retained. No new migration, widened grant or client admin credential is needed.
Unconfirmed writes are not automatically retried. Best-effort cookie cleanup cannot
override a known deletion outcome: revoked sessions and removed ownership enforce
access denial even if browser cookie cleanup fails. Cross-tab notifications only
clear UI state and are never authorization evidence. See ACCOUNT_DELETION.md.

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase server-side client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OneMap search](https://www.onemap.gov.sg/apidocs/search)

Dependency versions are locked in `package-lock.json`. Current npm audit findings in the lint-only dependency chain are recorded in verification, not automatically "fixed" by downgrading the application framework.
