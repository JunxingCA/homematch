# Implementation Decisions

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

- [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- [Supabase server-side client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [OneMap search](https://www.onemap.gov.sg/apidocs/search)

Dependency versions are locked in `package-lock.json`. Current npm audit findings in the lint-only dependency chain are recorded in verification, not automatically "fixed" by downgrading the application framework.
