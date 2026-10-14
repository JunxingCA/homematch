# Account Deletion

Implemented 13 October 2026. Local app: http://127.0.0.1:4175/.

## User Flow

Open the person icon (Account settings), choose Delete account, read the deletion
scope and type DELETE exactly. Cancel, Close and Escape perform no deletion. While
the request is pending, submission and dismissal are disabled. Keyboard focus stays
in the dialog and returns to the trigger on cancellation. Both themes and a 360px
mobile layout are supported.

A sign-in within the last ten minutes is required. If stale, the user chooses Sign
in again, completes Google or password authentication, reopens Account settings and
confirms again. Signing in never automatically repeats a deletion request.

## Server Contract

DELETE /api/account accepts only the JSON object `{ "confirmation": "DELETE" }`.
Same-origin checks, a 24KB body bound, strict validation and private/no-store responses
apply. GET/POST are not deletion endpoints. User IDs, access tokens and timestamps
are not accepted from the browser.

1. requireSession(false) verifies identity with Supabase getUser and requires a valid
   database-backed application session without extending its idle clock.
2. getClaims verifies the session token's signature. Its sub must match that owner;
   session_id must be a UUID, role authenticated and is_anonymous false.
3. A recognised AMR authentication event must be less than 600 seconds old. Up to
   thirty seconds of forward clock skew is tolerated. Refresh, recovery, anonymous
   and unknown methods do not qualify; iat and user metadata are not used as proof.
4. The server-only admin client invokes revoke_user_sessions for this verified owner.
   Revocation must succeed before any Auth deletion is attempted.
5. admin.auth.admin.deleteUser(owner.id, false) hard-deletes that Auth user. Success
   requires a successful provider response identifying the same owner.
6. Existing ON DELETE CASCADE foreign keys remove preference_profiles, discoveries,
   saved_areas and private.app_sessions for that owner. Other accounts and shared
   research_snapshots/location data remain unchanged.
7. Local sign-out and explicit expiry of this project's auth-cookie chunks, PKCE
   verifier and recovery cookie are attempted. Other projects' cookies and the
   light/dark preference are not removed. Cookie cleanup errors log only an event
   name and cannot turn a confirmed deletion into an incorrect failure report.

The recovery migration already supplies the backend-only revocation function. No
additional migration is required on the existing project. A fresh installation
must apply all migrations in filename order before using deletion.

## Failure Handling

- Invalid input or stale proof: no privileged deletion or revocation. Correct the
  input or explicitly sign in again. A verification transport outage performs no
  deletion and can be retried after service recovery.
- Unconfirmed revocation: no Auth deletion is attempted; cookies are cleared where
  possible. The UI clears private research and asks the user to sign in and check.
- Revocation succeeds but Auth deletion fails or its response is lost: old app
  sessions remain revoked. The UI does not claim the account was deleted. Sign in
  and check before making another explicitly confirmed request.
- Browser response loss: the backend outcome may be unknown. No destructive request
  is retried automatically. Private UI state is cleared and an uncertainty warning
  replaces success messaging.
- Confirmed success: private workspace state is cleared. A BroadcastChannel message
  clears other open tabs for the same owner only. The sender does not overwrite its
  success notice; the channel is not an authentication or authorization mechanism.

Deleting HomeMatch does not delete the Google account or revoke unrelated Google
permissions. The app currently has no user file storage. Future private tables or
uploads must extend deletion scope and tests. Database backups, provider logs and
retention policies are outside this application's immediate cascade; this is not
a guarantee of instantaneous physical erasure from every provider backup.

## Verification

- Pure validation: exact confirmation, account-ID rejection, 600-second boundary,
  wrong owner, missing AMR, fresh refresh after stale OAuth, anonymous/service roles.
- Mocked SDK/controller: identity verification before admin access, revocation before
  hard deletion, provider error/transport failures, owner mismatch, cookie failures.
- Route/cookie tests: cross-origin/JSON/body bounds, no-store, scoped expiry with
  local HTTP versus deployed HTTPS cookie settings.
- Actual PostgreSQL migrations in PGlite: all four owner cascades, revoked RLS access,
  intact second account and shared research snapshot, service-role-only revocation.
- Ten Playwright checks (five flows on desktop and mobile) with every account API
  mocked: cancellation, focus, both themes, explicit confirmation, stale sign-in,
  pending duplicate prevention, failure notices and same-owner cross-tab cleanup.
- Read-only hosted catalog inspection confirmed the existing owner FK cascades.

No real user's Auth account was deleted. Mocked SDK tests and PostgreSQL fixture
cascades do not prove the hosted Auth service's complete deletion behaviour.

### Remaining Hosted Smoke Test

Use a disposable account and obtain explicit approval before deleting it. Sign in
through HomeMatch, create a profile, discovery and bookmark; keep a second account
for isolation checking. Confirm cancellation makes no writes. Delete the disposable
account using recent sign-in, then verify Auth removal and empty owner-linked tables,
denial of its old JWT through API/direct REST, and intact second account/public data.
Confirm another tab clears and signing in with the deleted identity cannot restore
old data. Google may allow a new account with that identity; it must be a new empty
HomeMatch account, not restored research. Test provider outages separately in an
isolated environment, not by deleting a real user's profile.

## References

- [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims)
- [Supabase JWT AMR fields](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
