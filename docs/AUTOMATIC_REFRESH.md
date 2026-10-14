# Automatic Research Refresh and OneMap Renewal

Implemented 14 October 2026. The refresh worker is separate from web requests. It
uses the existing backend-only research table; no new schema, permission, account
or profile changes are required. Implementation is not scheduler activation.

## OneMap Credentials

Existing token-only setup continues to work until its token expires. For automatic
renewal, add the registered OneMap account credentials to the private server environment:

```dotenv
ONEMAP_EMAIL=your_registered_email
ONEMAP_PASSWORD="your_private_OneMap_password"
RESEARCH_REFRESH_INTERVAL_HOURS=24
```

Do not paste secrets into chat, commit them or expose them through NEXT_PUBLIC variables.
Restart the app/worker after environment changes. Credentials are sent only to
OneMap's fixed HTTPS authentication endpoint. The returned expiry is validated;
renewed tokens remain in server-process memory, not browser storage or files.
Each process shares one in-flight renewal, renews within five minutes of expiry,
and retries an explicitly rejected token once. Failed renewal backs off for 30
seconds; a still-valid token can be retained, but a rejected/expired token cannot.
No stored `.env.local` token is overwritten. A cold process may renew again.

Only the three existing search/theme/routing endpoints can receive a token. Redirects
are rejected. Provider errors and logs never include authentication response bodies
or passwords. JWT expiry decoding is a scheduling hint, not authorization verification.

## Refresh Commands

Run from the repository on one designated worker host:

```bash
npm run research:refresh
npm run research:status
node --env-file=.env.local scripts/refresh-research.mjs --once --dry-run
node --env-file=.env.local scripts/refresh-research.mjs --once --force
npm run research:watch
```

The original `node --env-file=.env.local scripts/import-research.mjs` command now
uses the same validated runner. A recent snapshot skips collection until its
configured 6-168-hour interval elapses. Force bypasses that timing check, **not**
validation. Watch checks hourly, awaits each job and gracefully cancels on SIGINT/SIGTERM.
The default interval is 24 hours; hourly checks mean the next success is usually
24-25 hours after the previous retrieval, not a promised exact wall-clock schedule.
Dry-run fetches and validates real sources but never publishes a snapshot. Its
candidate ID/date is recorded separately from the active dataset and last success.

## Publication Safety

The worker reads the previous public snapshot, collects the complete source set,
validates it using the same Zod schema as the application, then makes one insert.
There are no per-layer partial database publications, updates or deletes.

Validation requires:

- All 26 existing representative town origins, distinct IDs and Singapore coordinates.
- At least 100,000 supported HDB rows; totals, sorted prices and unique known groups must agree.
- Latest transaction month must be plausible and no more than two months behind Singapore's current month.
- All 13 supported facility categories, nonempty evidence and distinct source metadata.
- Fresh source timestamps under the existing 30/400/730-day source rules, not merely a new retrieval label.
- No transaction/month regression, more than 5% loss of price rows or more than 20% loss in any facility category compared with the previous snapshot.

These conservative loss thresholds require manual review when official sources
genuinely restructure their data. They are not new recommendation formulas. The
collector verifies each theme's declared feature count, downloads official CSVs
from bounded HTTPS S3 origins without redirects, and fails on unresolved schools.
Sports/HDB update dates come from current government metadata instead of hardcoded
publication dates. Grocery evidence remains partial and healthcare remains hospital-only.

Each successful retrieval has a new immutable ID including its retrieval date.
Older snapshots and discoveries are retained with their original IDs, dates and scores.
The web app's existing 60-second research cache may briefly retain the previous
snapshot. A failed refresh cannot rewrite that snapshot's date to make it appear fresh.
If an insert response is lost, the runner verifies the exact ID before declaring
success; an unconfirmed write remains a failed/unconfirmed job, not a false success.

## Worker Status and Locking

`.cache/research-refresh/status.json` records running/not-due/published/validated-only/
failed state, candidate or active snapshot IDs, timestamps and sanitized error codes.
Only a confirmed publication advances `lastSuccessAt`. Files are ignored by Git;
status and lock files use owner-only permissions. School geocode caches contain
public campus points only; tokens/passwords never enter these files.

An atomic owner-checked lock prevents overlapping commands on **one filesystem**.
This is not a distributed lock: designate exactly one refresh host and do not enable
both watch and the timer. Graceful termination releases the lock. A power loss or
SIGKILL can leave it behind; jobs then fail closed instead of guessing that another
worker is dead. If a lock is over 30 minutes old, an operator must confirm its PID
is not running before removing only `.cache/research-refresh/lock.json`. Do not
delete a live lock. Monitor failures and the age of the last successful snapshot.

## Hosting

No background schedule was installed on this Mac, the school VM or a cloud account.
The templates in `ops/` can run on a selected Linux worker host with Node 22 and
dependencies already installed. Adjust `/opt/homematch`, `/usr/bin/node` and the
unprivileged `homematch` account to that host. Create its writable `.cache` directory
before starting the service and keep `.env.local` readable only by its intended owner.

Enable the timer only after a successful dry-run and publication acceptance. It
checks hourly and respects the configured refresh interval. Use systemd's timer
listing and service journal for monitoring. Watch is an alternative for an existing
process manager, not an additional timer. A serverless web host needs an external
worker; don't launch a 25-minute import inside a user-facing Next.js request.

Retaining a complete immutable dataset each day grows database usage. Monitor quota
and agree a retention policy before continuous deployment; no old snapshots are
automatically deleted in this increment. Hosted multi-worker coordination, alerts
and paid-provider quotas belong to deployment hardening.

## Verification and Pending Activation

Verified on 14 October 2026: lint/types, 281 unit/database checks, 34 account/map/AI/
explorer browser checks, 24 PWA browser checks and production build pass. The real
no-write dry-run completes: all 26 towns, all 13 categories, 337 schools and 19
known supermarket points. The active dataset's ID/date stays unchanged. Client
bundles contain no new OneMap credential or backend-key references.

- Shared-schema, renewal/concurrency, source validation, download limits, lock and failure tests are automated.
- The full collector is tested with controlled HTTP, all 26 towns and all 13 categories, before any publication.
- Real sources can be verified using the no-write dry-run. A successful dry-run is not a live publication test.
- Private credentials are now configured locally. The opt-in live renewal check passes a fresh credential exchange (no seed token) and a public NTU landmark search, without database writes. It does not wait three days to observe expiry; that boundary is covered by controlled tests.
- Linux service/timer activation and a confirmed hosted publication remain acceptance tasks unless explicitly recorded below.

To repeat the optional live renewal check without printing tokens:

```bash
node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/onemap-renewal.test.ts
```

`src/domain/researchSnapshot.d.mts` is generated from the shared runtime schema. If
that schema changes, regenerate the declaration with the repository's TypeScript
compiler (`--ignoreConfig --allowJs --declaration --emitDeclarationOnly`, target
ES2022/module NodeNext), then rerun type checking and the collector checks. Do not
edit the declaration to imply behaviour that the runtime validator does not have.

## References Checked

- [OneMap authentication](https://www.onemap.gov.sg/apidocs/authentication): registered credentials, expiry timestamp and token lifetime.
- [OneMap token management](https://www.onemap.gov.sg/apidocs/docs/tokenmanagement).
- [data.gov.sg metadata](https://guide.data.gov.sg/developer-guide/dataset-apis/get-dataset-metadata).
- [data.gov.sg rate limits](https://guide.data.gov.sg/developer-guide/api-overview/api-rate-limits): the collector deliberately uses slower single-worker pacing.
- [Supabase server API keys](https://supabase.com/docs/guides/getting-started/api-keys): backend credentials never ship to the browser.
