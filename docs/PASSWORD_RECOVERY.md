# Password Recovery

Implemented locally on 13 October 2026 for FR03 and UC01.AC.3. Recovery is disabled
by default until the database helper, email template and delivery are configured.
Google sign-in and existing manual workflows do not require recovery setup.

## Behaviour

- Sign in > Forgot password requests a recovery email, without asking for the old
  password. The acknowledgement does not identify whether an account exists.
  Email failures preserve the email and current preference form for a later retry.
- Supabase owns recovery tokens, password hashing and email delivery. HomeMatch
  does not store passwords, send a password in email, or implement its own token.
- The email link opens `/auth/recovery?token_hash=...`. GET only moves the token
  into a ten-minute HttpOnly, SameSite=Lax, host-only cookie and redirects to the
  clean `/reset-password` URL. HTTPS origins use Secure cookies. An email scanner
  opening the URL cannot consume the single-use provider token.
- The token is not exposed to page JavaScript, localStorage or client props.
  Reset pages are private/no-store with no-referrer and no search indexing.
  Production access logs must redact the original token query string; the URL
  is necessarily received by the server and must not be retained in analytics.
- The user enters a new password (12-128 characters) and matching confirmation.
  Client and server validation run before token consumption. Validation failures
  keep the link usable; a submitted provider reset attempt clears the cookie.
- The same-origin reset endpoint reads proof only from its HttpOnly cookie.
  It verifies Supabase OTP with the fixed `recovery` type and verifies the returned
  identity with `getUser`. A normal logged-in session cannot bypass recovery proof.
- A separate in-memory Supabase client performs recovery. It cannot overwrite
  the browser's current Auth cookies and is never registered for HomeMatch access.
- Before updating the password, the trusted backend revokes every HomeMatch idle
  session of that verified owner. Old JWTs are denied by existing RLS immediately.
  Another account's sessions and all saved profiles/discoveries/areas are untouched.
  Missing/unavailable revocation support fails closed without changing the password.
- After update, global provider sign-out is attempted and the temporary session is
  locally cleared. The user must sign in again. Global sign-out failure is disclosed
  without misreporting a successful password change as a failed change.
- A rejected password, consumed/expired link or unavailable service requires a new
  email link. The email is not consumed merely to display a form. A network error
  after submission can leave the change uncertain; try signing in or request a new
  link rather than assuming the password is unchanged.

## Enable In Supabase

1. Apply `supabase/migrations/202610130002_password_recovery.sql` after the existing
   migrations. Its `revoke_user_sessions(uuid)` function is executable only by
   `service_role`; it is not an unrestricted user-facing RPC.
2. Configure the separate registration confirmation template as documented in the
   README; it must match `/auth/confirm` and is not a recovery template. Set the separate
   **Reset Password** template to the following (subject: `Reset your HomeMatch password`):

```html
<h2>Reset your HomeMatch password</h2>
<p>Follow the link below to choose a new password. If you did not request this, ignore this email.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Reset password</a></p>
```

3. In Auth URL configuration, allow the exact application recovery callback:
   `http://127.0.0.1:4175/auth/recovery` for the current local app; add the HTTPS
   deployed callback when hosting is ready. The backend constructs the callback
   from `APP_ORIGIN`, not from request-supplied redirect/next URLs.
4. Set email OTP expiration to 600 seconds. This Supabase setting also affects
   other email OTP links, including registration; check the team's intended policy
   before changing it. The application cookie expires ten minutes after opening,
   and the provider token must still be valid from its original send time.
5. Configure a transactional SMTP provider for team-wide testing. Supabase's
   built-in SMTP is for development, restricted to project-team addresses and
   currently limited to two emails per hour. Adding an Auth test user alone does
   not make its email an authorised recipient. SMTP credentials belong in the
   Supabase dashboard, never frontend code or source control.
6. Only after those steps, set `PASSWORD_RECOVERY_ENABLED=true` in `.env.local`
   (and hosting secrets later), restart, and test with a disposable account you own.

Never test a real reset against another team member's account without consent.
Google-only users can continue using Google; the recovery flow sets a Supabase
password when supported and does not change the user's Google password.

## Abuse And Deployment

Email request guards allow one request/minute and five/hour per normalised email.
Only SHA-256 email digests and timestamps are kept in the bounded in-process map,
with hourly expiry and a 1,000-email ceiling. Failed attempts count. This is a
prototype guard, not distributed protection. A public deployment still requires
durable rate limiting, edge/bot controls and provider quotas. Raw provider errors,
passwords, email addresses and recovery tokens are not logged by application code.

## Verification

- `npm run check`: lint, typecheck and 143 unit/database tests passed.
- `npm run build`: passed with the recovery callback and reset page.
- `npx playwright test --config playwright.recovery.config.ts`: eight browser tests
  passed at 1440px desktop and 360px mobile. Email and password updates are mocked;
  no real email was sent and no account's password was changed.
- Actual PostgreSQL migration/RLS tests verify backend-only revocation, denial of
  old sessions and preservation of another owner's access and existing profiles.
- Dark/light reset screenshots were inspected for clipping, overlap and logo load.
- Live migration applied with user approval on 13 October 2026 to the HomeMatch
  Supabase project (`bxxcbcntnaojvepcqrcg`) through its SQL editor, in a transaction.
  Preflight confirmed the function was absent. Post-application catalog queries
  verified its exact owner-filtered body, SECURITY DEFINER and empty search path.
  PUBLIC, anon and authenticated execution are denied; service_role execution is
  allowed. Verification did not invoke the function or revoke any live sessions.
- Supabase MCP connected on 13 October 2026. Read-only catalog checks reconfirmed
  the recovery function's backend-only privileges and healthy project status.
  The connected tool set does not expose Auth configuration, so the signed-in
  Dashboard was used to inspect email settings without revealing SMTP credentials.
- Dashboard verification found the correct saved recovery subject/template and
  the exact `http://127.0.0.1:4175/auth/recovery` allowlisted callback. Custom SMTP
  is enabled with `smtp.gmail.com`, port 465, matching Gmail sender/username and
  HomeMatch sender name. The password was not read, altered or included in reports.
  Gmail is a personal-mail provider; Dashboard warns about transactional delivery
  reliability. SMTP configuration does not prove actual delivery.
- With explicit user approval, Email OTP Expiration was changed from 3600 to 600
  seconds, and minimum password length from 6 to 12. Reopening the Email settings
  confirmed the saved values. Other Auth switches were left unchanged. Existing
  passwords were not changed; the shorter OTP lifetime also affects signup links.
- `PASSWORD_RECOVERY_ENABLED=true` is now set in the ignored local environment.
  Actual recovery email delivery and an end-to-end mailbox reset remain unverified.
  No live email was sent and no account's password was changed by these checks.
- On 14 October 2026, approved hosting setup added the exact HTTPS recovery callback
  alongside the existing local callback. The recovery template was rechecked and
  already used `.RedirectTo` with `.TokenHash`; it was not changed. Separately, the
  signup template's default ConfirmationURL was corrected to the token-hash callback
  expected by the existing signup handler. See VERCEL_DEPLOYMENT.md for release status.
- An actual-server smoke check exposed the global referrer header overriding
  callback-specific settings. `next.config.ts` now applies a later, specific
  no-referrer/private-no-store rule to `/auth/:path*`, in addition to the reset
  page. Actual HTTP tests verify recovery, signup confirmation, OAuth callback
  and reset-page headers on desktop/mobile; unit-only handler assertions had not
  covered the framework header override. Lint/typecheck, 143 unit/database tests,
  eight recovery browser tests and the production build passed after the fix.

### Advisor Review

The connected security advisor reports intentionally policy-free backend-only
tables (`private.app_sessions`, `public.research_snapshots`) and authenticated
SECURITY DEFINER session helpers. The helpers were inspected: they constrain
access to `auth.uid()` and the JWT session ID, with an empty search path. The
auto-RLS helper has broad EXECUTE grants flagged by the advisor, but returns
`event_trigger` and is platform DDL-trigger code, not an ordinary callable Auth
helper. No unrelated grants were changed during this recovery check.
Leaked-password protection remains off; Dashboard states this requires Pro or
above. No paid upgrade was requested or made. These checks are not a complete
production security audit.

Advisor references: [policy-free RLS](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[anonymous definer permissions](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated definer permissions](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

References: [password-based Auth](https://supabase.com/docs/guides/auth/passwords),
[email templates](https://supabase.com/docs/guides/auth/auth-email-templates),
[SMTP restrictions](https://supabase.com/docs/guides/auth/auth-smtp),
[session behaviour](https://supabase.com/docs/guides/auth/sessions).
