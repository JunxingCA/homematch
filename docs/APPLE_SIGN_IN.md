# Sign in with Apple: Prepared, Not Activated

The application implements Apple OAuth through Supabase's managed PKCE flow. The
provider is intentionally disabled because the team currently has no Apple
Developer Program account/provider credentials. Unit tests of the orchestration
do not establish a working Apple account connection.

## Implemented

- Same-origin POST `/api/auth/apple`; disabled requests fail before provider access.
- `APPLE_SIGN_IN_ENABLED=false` by default. Only when enabled does the UI show
  Continue with Apple; Google and email remain unchanged.
- Server-side `signInWithOAuth({ provider: 'apple' })` with a fixed configured
  `/auth/callback`. No Apple private key or client secret is sent to the browser.
- Provider-neutral callback exchanges the one-time code, verifies the identity
  through Supabase Auth and registers the existing active application session.
- Cancellation/error responses never echo provider diagnostics, arbitrary `next`
  destinations or tokens. Local cookies/session checks follow the Google path.
- Identity uses the verified Supabase user ID, not an editable email/name. Apple
  users can choose a private relay address; do not merge accounts just because
  names match or require Apple to return a full name.

## Configuration Checklist

The account owner should perform the following setup. Do not buy a membership,
accept agreements or enter new signing credentials through an agent without the
appropriate approval/handoff. Existing Google sign-in is enough for the current
team demo until Apple is ready.

1. Obtain access to an appropriate Apple Developer Program team. Record the Team
   ID and responsible team member without putting credentials in GitHub.
2. Create/choose a primary App ID and enable Sign in with Apple.
3. Create a web Services ID associated with that App ID. Record the exact ID used;
   suggested names are not pre-created registrations.
4. Configure the web authentication domain as `bxxcbcntnaojvepcqrcg.supabase.co`
   and the exact Apple return URL as
   `https://bxxcbcntnaojvepcqrcg.supabase.co/auth/v1/callback`.
   This is the Apple-to-Supabase callback, not HomeMatch's `/auth/callback`.
5. Create the Apple signing key. Keep the `.p8` file in secure storage, never in
   this repo, its documentation, screenshots or chat. Generate the Apple client
   secret using the official/Supabase flow and keep it in Supabase Auth's Apple
   provider settings, not in public Next.js variables.
6. In Supabase Auth > Sign In / Providers > Apple, enter the Services ID first in
   Client IDs, add the generated secret and enable Apple. Native bundle IDs must
   not precede the Services ID for this website flow.
7. Preserve Google and email settings. Ensure Supabase's application Redirect URLs
   include the exact local and `https://homematch.unify-x.com/auth/callback` URLs.
8. Set `APPLE_SIGN_IN_ENABLED=true` locally and restart the local app. Test sign-in
   from the local website through Supabase. The return from Apple itself uses the
   registered HTTPS Supabase URL, not a localhost URL.
9. Verify first sign-in, repeat sign-in, cancellation, private relay email, missing
   name, logout, old session rejection and a separate account's profile isolation.
10. Only after acceptance, set the same flag in Vercel Production and redeploy.
    Configure the actual SMTP sender as an approved Apple email source if private
    relay users are to receive account emails; test delivery to a relay address.

## Maintenance

Apple web OAuth client secrets expire and must be regenerated before their
maximum six-month lifetime. Assign an owner and record the actual issue/expiry
dates. No automatic rotation schedule or reminder has been created. Keep the
signing key secure and rotate/revoke it if exposed.

If the provider has not been configured, leave the flag false. A visible button
or successful mocked test is not evidence of live Apple sign-in.

References: [Supabase's current Apple setup](https://supabase.com/docs/guides/auth/social-login/auth-apple),
[Apple web configuration](https://developer.apple.com/documentation/signinwithapple/configuring-your-webpage-for-sign-in-with-apple).
