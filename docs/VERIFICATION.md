# Milestone 1 Verification

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
