# Milestone 1 Traceability

## Testing Increment, 14 October 2026

AI review (FR15), failure handling (NFR16), usability/responsiveness (NFR10/NFR11)
and deterministic scoring/coverage (NFR12-NFR14) gain eight real synthetic Gemini
cases, expanded validation/scoring tests, per-file coverage gates and eight scoped
accessibility scans. Two actual extraction problems and a progress-role issue were
corrected. All 360 unit/database and 64 browser checks pass; final live corpus passes
eight of eight. NFR01/NFR02 remains open: fifty public HTML responses and eight model
latencies are not a full authenticated fifty-user/five-second benchmark. Manual,
whole-app, deployed and physical-device acceptance remain separate.
See TESTING_2026-10-14.md for exact test boundaries and retained results.

"Implemented" means code exists, not that cloud credentials were available. Hosted integration verification is separately recorded in VERIFICATION.md. All requirement identifiers refer to the updated Lab 2 SRS.

## Later Deployment Hardening Increment

On 14 October 2026, NFR15/NFR16 provider isolation/failure handling and NFR07/NFR18
server-secret/private-data protection gain backend-only shared expensive-operation
limits, bounded HTTP/body reads and public-snapshot single-flight. Local guards
remain as additional guards; the approved hosted migration is applied, locally
enabled and verified by role queries plus a synthetic real-backend-client check.
NFR01/NFR02's five-second/fifty-user target remains unverified. Database
admission/cache concurrency tests are not a network load benchmark. See
DEPLOYMENT_HARDENING.md and VERIFICATION.md.

## Later Automatic Refresh Increment

On 14 October 2026, OneMap provider isolation (NFR15), failure handling (NFR16),
server-secret protection (NFR07/NFR18) and source freshness gained a separate
validated refresh worker and server-only credential renewal. The worker preserves
old snapshots/evidence and never rewrites saved scores; it is not live listing
inventory or a new pricing formula. Sixty new unit checks and a complete real-source
no-write dry-run pass, alongside 34 account/map/AI/explorer and 24 PWA browser checks.
Live credential renewal and one public landmark search pass after private setup;
hosted publication and worker scheduling remain pending.
See AUTOMATIC_REFRESH.md for the single-host lock and deployment limitations.

## Later PWA Increment

On 13 October 2026, the mobile/installable website design gained PwaProvider,
PwaInstallButton, Next's manifest metadata, existing-logo icons and a production
public-only reconnect worker. This contributes to NFR10/NFR11 usability/responsiveness,
NFR16 failure handling and NFR18 personal-data protection without changing Auth or RLS.
Installation metadata and offline handling are not a new native app or a claim that
searches work offline. Twenty-five unit checks and 24 production-preview browser
checks pass. iPhone guidance is emulated in Chromium; real installed Google sign-in,
physical-device installation and deployed upgrade verification remain pending.
See PWA.md and IMPLEMENTATION_CHECKLIST.md.

## Later Area-Exploration Increment

On 13 October 2026, the broader housing pathways gained unscored BTO/condo/landed
exploration through AreaExplorer and AreaExplorationController. FR14/FR18/FR24/FR26
related location/amenity/map evidence is reused for context, not claimed as BTO/private
FR20-FR23 price scoring. External housing navigation uses ListingLinks: PropertyGuru
keyword/type search, or official HDB navigation with explicit manual town selection.
Tests cover ownership, profile revision, source failure, routes only on request,
both themes/viewports and preserving the original tab. See AREA_EXPLORATION.md and
IMPLEMENTATION_CHECKLIST.md; the historical Milestone 1 table below is not current
whole-product completion status.

| Requirement                                        | Status and implementation                                                                                  | Evidence                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| FR01-FR02 / UC01 registration and sign-in          | AuthenticationController; Supabase Auth; confirmation callback. Duplicate response discrepancy documented. | Typecheck/build; hosted smoke test pending.                                        |
| FR03 / UC01.AC.3 recovery; UC01.EX.2 email failure | PasswordRecoveryController, recovery callback, PasswordReset UI, backend-only old-session revocation. Configuration-gated. | Recovery unit/route/client tests, PostgreSQL revocation/RLS tests and six mocked browser tests. Live migration applied and execution permissions verified 13 October 2026. SMTP/reset pending; see PASSWORD_RECOVERY.md. |
| FR04 / UC01 account deletion | AuthenticationController, DELETE /api/account, AccountDialog; recent verified sign-in and typed confirmation, backend-only session revocation then owner hard deletion. | Domain/controller/cookie/route tests, PostgreSQL cross-owner cascade and revoked-access tests, ten mocked desktop/mobile browser checks. Existing live FK cascades verified read-only; hosted Auth deletion is not exercised. See ACCOUNT_DELETION.md. |
| FR05-FR06 / UC02 profile CRUD/max four             | ProfileRepository; PreferenceController; preference_profiles RLS and trigger.                              | PostgreSQL tests for CRUD, limit and revision protection.                          |
| FR07-FR11 / UC02 structured preferences            | Domain Zod schemas; form; independent SQL validation.                                                      | Boundary tests, SQL validation tests, browser edit/review.                         |
| FR12-FR13 / UC03 natural language                  | Deferred to Milestone 4. No fake AI UI.                                                                    | Not implemented.                                                                   |
| FR14 location resolution                           | OneMapAdapter/canonical catalog plus explicit fixture preview.                                             | Fixture browser search; forged coordinates SQL rejection. Live token test pending. |
| FR15 / UC03.1 AI draft review                      | Manual review foundation implemented; no AI extraction yet.                                                | Manual browser review; unresolved-location validation.                             |
| FR16-FR23 / UC04 and subcases                      | Scoring, routes, facilities, transactions, snapshots deferred.                                             | Not implemented; no scoring coverage claim.                                        |
| FR24-FR26 / UC04-UC05 results and evidence         | Deferred to Milestones 2-3.                                                                                | No fabricated map or scores.                                                       |
| FR27 / UC06 comparison                             | Deferred to Milestone 4.                                                                                   | Not implemented.                                                                   |
| FR28-FR30 / UC07 shortlist                         | Deferred to Milestone 4.                                                                                   | Not implemented.                                                                   |
| NFR01-NFR02 performance/first results              | Discovery not yet implemented.                                                                             | No five-second/50-user claim.                                                      |
| NFR03-NFR04 research/advice disclosure             | Area-research disclaimer and evidence-scope messages.                                                      | UI/browser check.                                                                  |
| NFR05 managed password hashing                     | Supabase Auth; no application password storage.                                                            | Architecture inspection; hosted Auth verification pending.                         |
| NFR06/NFR17 profile isolation                      | Owner + active-session RLS; user-scoped repository.                                                        | Actual migration tested under authenticated users A/B.                             |
| NFR07 secrets                                      | Server-only configuration, ignored .env files; example has placeholders.                                   | Source/commit scan.                                                                |
| NFR08 HTTPS                                        | Secure cookies when configured HTTPS; hosting not provisioned.                                             | Deployed verification pending.                                                     |
| NFR09 inactivity                                   | Private session guard; controlled registration, touch, revocation; RLS.                                    | Expiry/non-revival/revocation SQL tests; idle helper boundary tests.               |
| NFR10/NFR11 usability/responsive                   | Accessible labels/dialog focus; 360px mobile and 1440px desktop themes.                                    | Playwright flows/screenshots; full accessibility audit deferred.                   |
| NFR12-NFR14 deterministic scoring/logging/coverage | Scoring not implemented.                                                                                   | Domain preference coverage is not scoring coverage.                                |
| NFR15 isolated providers                           | OneMapAdapter; managed Auth/controller boundaries.                                                         | Module separation; adapter test coverage to expand with real integrations.         |
| NFR16 provider failure                             | Search errors retain text; no unresolved confirmation. Ranking failure semantics deferred.                 | Form validation/browser tests; live outage exercise pending.                       |
| NFR18 personal data                                | Private RLS, no preference localStorage, no raw error/payload logging.                                     | Code and SQL checks; retention policy/legal review deferred.                       |
| NFR19 transaction minimum                          | Deferred to scoring/ingestion milestones.                                                                  | Not implemented.                                                                   |

The complete Lab 2 boundary/control and entity diagrams remain design references. This milestone implements AuthenticationUI (dialog in HomeMatch), PreferenceFormUI (manual form), AuthenticationController and PreferenceController. Remaining controller names are reserved for their future use cases, not empty placeholder classes.
