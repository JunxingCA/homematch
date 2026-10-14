# Deployment Hardening

Applied and locally activated 14 October 2026 after explicit approval. Hosted
migration `20261014085711_operation_limits` matches the CLI-generated local file
`20261013174853_operation_limits.sql`; do not reapply it as a second hosted migration.
The local app now uses shared admission alongside its original local guards.
No accounts or research evidence were changed.

## Activation

1. Apply `supabase/migrations/20261013174853_operation_limits.sql` through the
   approved migration workflow. It adds backend-only counters, leases and RPCs,
   without changing profiles, discoveries, saved areas or source snapshots.
2. Set `OPERATION_LIMITS_ENABLED=true` in the private server environment and
   restart the app. Never expose the service-role key through browser variables.
3. Verify hosted permissions, concurrent admission/release and security advisors,
   then smoke-test with a user-approved disposable account.

The current project's migration, private-table/RPC permissions and synthetic backend
smoke check pass. `.env.local` has `OPERATION_LIMITS_ENABLED=true`; the development
server was restarted at port 4175. A future production host must independently set
the same private setting. Real signed-in-user acceptance remains separate from
the synthetic backend-client check.

Disabled shared admission is allowed only in `NODE_ENV=development`, retaining
existing local guards. Production expensive operations fail closed when disabled.
When enabled, missing RPCs, malformed replies and database/timeout failures return
503 with a bounded Retry-After. They never fall back to process-local protection.

## Shared Limits

These are provisional project safety budgets, not provider allowance guarantees:

| Operation | Account attempts | Service attempts | Account/service concurrent slots | Cooldown | Crash expiry |
| --- | --- | --- | --- | --- | --- |
| AI interpretation | 10/hour | 120/hour | 1/6 | 10 seconds | 120 seconds |
| Resale discovery | 12/hour | 100/hour | 1/10 | 15 seconds | 300 seconds |
| Explorer journeys | 60/hour | 300/hour | 1/10 | None | 120 seconds |
| Manual location search | 60/minute | 600/minute | 5/30 | None | 45 seconds |

Windows start at first admission and reset after their duration, rather than at
wall-clock boundaries. Shared rejections do not consume counters. Admitted attempts
remain counted after provider failure; release frees concurrency, not quota.
Existing local guards can conservatively reject earlier, including after failed
shared admission. AI's at-most-four location lookups use its AI admission. Each
discovery may request 26 towns times up to four destinations, with three candidate
workers. Tune budgets against actual OneMap/Gemini quotas before hosting.

Owners come from server-verified Auth, never client IDs or forwarded IP headers.
An HMAC keyed by the private service-role credential stores pseudonyms, not raw
emails or account IDs. Key rotation changes owner pseudonyms but preserves the
operation's global budget. This is security telemetry, not an anonymisation claim.
Counters unused for seven days and expired slots are lazily pruned on the operation's
next admission; no wall-clock purge is guaranteed during inactivity.

Both private tables have RLS, no browser grants and no browser policies. Public
RPCs are SECURITY INVOKER with an empty search path and service-role-only execution.
An operation-specific transaction advisory lock atomically checks capacity and
reserves quota across instances. Its wait is bounded to two seconds, and it is held
only during the short database transaction, never provider calls. A completion
deletes only its matching lease UUID, so an old completion cannot delete a replacement.
Failed release logs only the event/operation and never overwrites the actual result.

## Requests And Providers

- JSON requires an exact JSON media type, uncompressed UTF-8, at most 24,000 actual
  bytes and a total ten-second body deadline. Content-Length is an early hint only.
- Supabase HTTP calls get a fifteen-second fetch deadline combined with caller
  cancellation. The wrapper adds no write retries. This is per HTTP call, not an
  entire multi-step operation's deadline.
- OneMap response caps are two MiB for search/routes, sixteen MiB for themes and
  64 KiB for token renewal. Existing deadlines now cover streamed body reads.
  Quota errors do not trigger automatic retries or credential renewal; only the
  existing one-time authentication retry remains.
- OneMap Retry-After is bounded to 1-300 seconds, with a sixty-second fallback.
  Gemini quota errors get a conservative sixty-second hint, not an asserted reset
  time. API errors remain sanitized, private/no-store, with bounded retry metadata.
- Public snapshots retain their sixty-second cache and now share one concurrent
  load per process. Failures clear the pending load. Expired/invalid reloads fail
  rather than relabelling stale evidence. Auth clients and private profiles are
  never cached here.
- Discovery rechecks owner and profile revision before publication. This is late
  revalidation, not an atomic database revision lock: a profile can still change
  between the final read and insert. Results retain their original confirmed
  preference/revision evidence.

## Verification And Remaining Work

See VERIFICATION.md and IMPLEMENTATION_CHECKLIST.md for executed checks. The isolated
PostgreSQL test queues fifty admissions, and the public-cache test shares fifty
calls. Neither proves hosted multi-connection contention or fifty-user network latency.

Still required before internet deployment:

- Enable shared admission on the chosen production host and complete signed-in
  acceptance there. The existing project and local app are already activated.
- Configure platform ingress/WAF/body/time limits and trusted proxy handling.
  Application limits do not protect bandwidth or all unauthenticated endpoints.
  Auth/recovery retain provider controls and the existing local recovery-email
  guard, not this new distributed limiter. Logout/deletion are not throttled here.
- Benchmark cold/warm response times and provider quotas on the chosen host. Full
  ranking permits a 150-second routing phase; this work does not meet or prove
  the five-second first-results target.
- Choose hosting compatible with route durations, configure HTTPS/Auth callbacks,
  email and server secrets, and run deployed acceptance. Do not replay uncertain writes.
- Complete accessibility/scoring coverage and disposable-account recovery/deletion tests.

## Hosted Verification And Advisor Review

Hosted role checks confirm both private tables have RLS, no anon/authenticated read
grants, and backend DML access. Both RPCs are SECURITY INVOKER and executable only
by service_role. A rolled-back SQL transaction under service_role verifies admission,
duplicate rejection, release and old-lease fencing without retaining test counters.
An opt-in backend-client test uses a random synthetic owner, verifies duplicate
blocking and two releases through the actual REST client, and leaves no active slots.
It creates only synthetic limiter telemetry (two journey attempts), never account,
profile, saved-area, research or paid-provider data. It is not a signed-in-user
end-to-end or load benchmark. Run explicitly with:

```sh
RUN_OPERATION_LIMITS_SMOKE=true node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/operation-limits.test.ts
```

Security advisors show informational no-policy notices for backend-only tables;
these are intentional, with browser access denied rather than added policies.
Existing warnings remain for authenticated session SECURITY DEFINER helpers,
the platform `rls_auto_enable()` event-trigger function, and disabled leaked-password
protection. No unrelated Auth settings or session grants were changed. Review the
[function-execution notices](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
in their session/event-trigger context, and the
[password-protection setting](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
before public deployment. Advisor warnings are not a clean independent security audit.

References: [Supabase database functions](https://supabase.com/docs/guides/database/functions),
[PostgreSQL advisory locks](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-ADVISORY-LOCKS).
