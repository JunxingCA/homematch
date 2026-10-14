# Vercel Deployment

## Project

- Account workspace: `home-match1` (HomeMatch), confirmed Hobby plan.
- Project: `homematch`, ID `prj_l9mkn8ccRsueCoCm9C53azHmDRiF`.
- Canonical production target: `https://homematch.unify-x.com`.
- Original alias: `https://homematch-sandy.vercel.app` (verified 307 redirect to the canonical address).
- Runtime: Node.js 22.x, Next.js, Fluid Compute, one Singapore (`sin1`) region.
- Existing Cloudflare mockup is unchanged. One DNS-only CNAME was added for the canonical app hostname; unrelated DNS records are untouched.

## Custom Domain and Market Increment, 14 October 2026

Local acceptance completed before upload:

- 407 unit/database tests; lint/types and final production build pass.
- All 46 desktop/mobile account/AI/map/exploration/history/market regressions pass.
- Production PWA suite: 24 passed, three intentional platform-specific skips.
- Domain coverage gates pass; over 97% domain branch coverage.
- Read-only real-data BTO check: seven archived projects scored with the actual
  public research snapshot and OneMap journeys to a public MRT landmark; no user writes.
- A mobile error overlay that intercepted Retry was found and fixed before release.
- Source scan: 208 text files, zero matches against actual configured private
  credential values; local environment/cache/test results remain ignored.

Cloudflare has a DNS-only CNAME `homematch` pointing at Vercel's recommended
`421231b36c3a9621.vercel-dns-017.com`. Vercel verifies the corrected domain. The
temporary `homemate` hostname is not retained. No domain purchase, Cloudflare
Workers upgrade or Vercel paid plan was enabled.

Supabase retains the six original exact local/Vercel callbacks and adds three
exact custom-domain callbacks for `/auth/callback`, `/auth/confirm` and
`/auth/recovery`. The additive history/private-snapshot migrations are applied.
Post-migration metadata verifies RLS on both tables, no anonymous table access,
no authenticated access to private snapshots, and invoker-only history functions
with no anonymous EXECUTE. Zero history settings or private-price snapshots were
created by the migration checks; no account data was deleted.

Apple remains disabled pending an Apple Developer/provider setup. The URA key and
real private snapshot are not connected. The BTO catalogue is explicitly the
archived June 2026 exercise, with town proxies rather than project entrances.
These are not a complete live BTO/private listing feed.

### Verified Release

- Private repository: `JunxingCA/homematch`; application commit
  `68c03d860d7cb5ec24b5e30c0895a28fa9672e6a` pushed without rewriting history.
- Deployment `dpl_G6C5hLqmm6GvXPXeXn6vKvgjo1By` is READY and promoted.
  Immutable URL: `https://homematch-f8pua8xxi-home-match1.vercel.app`.
- Deployment metadata confirms the clean application commit, Node 22.x, Singapore
  `sin1`, Hobby plan and source public=false. Upload contained 109 files, 551.4 KB;
  credentials, caches, tests, SQL, scripts and documentation were excluded.
- Canonical HTTPS home, manifest and service worker return 200. The old stable
  alias returns 307 to the custom domain; `.env.local` returns 404.
- Anonymous session/profile/history/shortlist/exploration reads and protected
  history-delete/market-ranking requests return 401. A foreign-origin mutation
  returns 403. These checks did not alter any account data.
- Google initiation returns the exact custom-domain callback, S256 PKCE and
  Secure/HttpOnly cookies. Apple returns the expected disabled-provider response.
- Supabase Site URL is saved as `https://homematch.unify-x.com`; reloading the
  dashboard confirms all nine exact redirect URLs remain configured.
- Public HTML/JavaScript credential scan: zero configured private-key matches.
- The custom-domain page is visually verified. Users must sign in once on the new
  hostname because cookies do not transfer. Fresh authenticated end-to-end
  acceptance on that hostname remains pending; earlier signed-in checks below
  were on the original Vercel alias.

The subsequent verification-record update changes documentation only. It does not
require a new application deployment; production code remains commit `68c03d8`.

### Advisor Review

Before/after security-advisor checks show no new warning category from these
changes. Backend-only market snapshots add the expected informational
[RLS-without-policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy):
direct anonymous/authenticated access is intentionally denied. Existing
[SECURITY DEFINER execute warnings](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
for session helpers and the dashboard-created `rls_auto_enable` function still need
a focused review; do not revoke required session-helper permissions blindly.
[Leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
remains disabled. No paid feature or broader Auth permission was enabled during
this feature release. This is not a claim that a full security audit is complete.

## Verified Initial Release, 14 October 2026

The first deployment is live in **read-only preview mode**, not the real backend.
No Supabase, Gemini or OneMap credentials were uploaded with that initial release.
The later approved Production configuration is recorded separately below.

- Deployment: `dpl_3NEuDUSSbZJoEd4vo83PMsUqHxRE`, state `READY`.
- Immutable URL: `https://homematch-3nulyi7e8-home-match1.vercel.app`.
- Stable URL: `https://homematch-sandy.vercel.app`.
- Verified through deployment metadata: Hobby plan, `sin1`, source public=false.
- Remote `npm ci`, TypeScript and Next.js production compilation passed.
- Local lint, strict types and 362 unit/database tests passed (two deployment checks added).
- CLI dry run: 102 entries, 716,410 bytes; `.env.local`, cache, test results,
  research scripts, SQL, `.git` and `.vercel` excluded. Empty ignored-directory
  entries may appear in the manifest but no contained files are uploaded.
- Anonymous HTTPS home and session endpoint return 200; session is explicitly
  `{user:null, mode:"preview"}`.
- Manifest, service worker and offline document return 200. Worker is no-store;
  home HTML is private/no-store. `.env.local` returns 404.
- Google-start action returns 503 `PREVIEW_ONLY`; foreign-origin POST returns
  403 `INVALID_ORIGIN`. Neither invokes an API provider.
- Source route redirects to Vercel's source inspector; unauthenticated inspector
  access redirects to login. The source is not publicly browsable.
- Desktop 1280px and mobile 390px screenshots inspected: no horizontal overflow.
  Captures are under `test-results/vercel-deployment/` (Git/upload excluded).

Google sign-in, real area searches/maps, AI, account writes, recovery and installed
device acceptance are **not verified by this release**. Hosting compatibility is
confirmed; the existing local Supabase app remains unchanged.

## Approved Production Configuration

The user approved server credential transfer and exact callback additions on
14 October 2026. All 13 Production settings below are now present: six Config
settings and seven Secrets. Values were passed directly from the existing private
environment to Vercel through stdin, not printed, placed in command arguments,
committed, or copied into a Preview environment. Local application settings were
not replaced, and no account/profile/research data was changed.

Supabase now has all six exact redirect URLs: the original three local callbacks
and the three HTTPS callbacks listed below. The signup confirmation template was
found to use the default ConfirmationURL rather than the token-hash callback
expected by HomeMatch. It now uses `{{ .RedirectTo }}?token_hash={{ .TokenHash }}`;
the saved value was verified after reopening the page. The recovery template
already used that format and was left unchanged. No email was sent or password
changed. After the real-backend release passed its initial hosted checks, Site URL
was changed to the production origin and verified by reopening URL Configuration;
all six local/production callbacks remain saved.

The real-backend deployment `dpl_9SATYbtaTxRCX4QJSEFTyL4uV8QS` was **BLOCKED**, not
built or promoted: Vercel rejected the latest commit's local-only author email.
The read-only release still serves the stable URL. GitHub CLI confirms account
`JunxingCA`, public ID `228671637`; private-email access was unavailable and no
extra account scope was requested. After approval, deployment-only commit `45319bd`
was created with the GitHub no-reply identity. It contains only `vercel.json` and
`.vercelignore`; no Git push or changes to older commits occurred. Vercel attempts
`dpl_kGV2hGcbASgUvunsYnhjyMcA47f5` and `dpl_ADNxqWo9VWdQ2qwyt6gjFAtiJ1Z1`
remain BLOCKED, not built/promoted: Vercel cannot match the no-reply author.

The user supplied their actual GitHub email, now configured repository-locally for
future commits, and completed linking `JunxingCA` in Vercel's Authentication page.
With separate explicit approval, only the new unpublished deployment commit was
corrected to the user-supplied email, producing `6458ac0`. A diff against `45319bd`
is empty: the two file contents are identical. No older commit, unrelated app
change or GitHub content was changed. Vercel then accepted the author normally;
no author-check bypass or spoofed deployment metadata was used.

Vercel also detected that the old broad Node engine range selected Node 24 over
the project setting. The package and lockfile now pin Node 22.x, matching local
testing. The latest attempted deployment metadata confirms 22.x and `sin1`, but
successful build/runtime checks remain required. Latest local lint/types and all
362 unit/database checks pass.

## Verified Real-Backend Release, 14 October 2026

- Stable origin: `https://homematch-sandy.vercel.app`.
- Deployment: `dpl_28LfZU7777hKrqEYU7JbMEysBj2h`, state `READY`.
- Immutable URL: `https://homematch-9c60c4yj0-home-match1.vercel.app`.
- Inspector: `https://vercel.com/home-match1/homematch/28LfZU7777hKrqEYU7JbMEysBj2h`.
- Metadata verifies Hobby, Node.js 22.x, Singapore `sin1`, source public=false and
  commit `6458ac0c254ad6c97229dd61fc2ddad4df9e14e5`.
- Deployment includes the current uncommitted application working tree (`gitDirty=1`),
  not just the deployment commit. It is **not** reproducible by checking out that
  commit alone. No GitHub push was authorised or performed.
- Remote lockfile install, production compilation and TypeScript checks pass.
- HTTPS home returns 200, no preview banner, and private/no-store HTML headers.
- Anonymous session/profiles/discoveries/shortlist/explorer/AI status/location
  requests return 401 `SIGN_IN_REQUIRED`, private/no-store; no account/provider
  data is returned. A foreign-origin profile POST returns 403 `INVALID_ORIGIN`.
- Google start returns 200 with the exact production callback, `s256` PKCE and
  Secure/HttpOnly cookies. The check does not complete Google authentication.
- Cancelled Google, missing signup token and missing recovery token redirect only
  to the configured HTTPS app, with no-referrer and private/no-store headers.
- Manifest and service worker return 200; worker is no-store. `.env.local` is 404.
- Public HTML and ten public JavaScript assets were compared locally against five
  actual private credential values: zero matches. Values were not printed or sent
  in the scan's requests. This is a scoped leak check, not a full security audit.
- The current hosted app was inspected at the in-app browser's actual 468px
  viewport with no horizontal overflow; screenshot `app-production-468px.jpg` is
  retained under `test-results/vercel-deployment/`. Requested browser viewport
  overrides did not resize that tab, so these captures do not establish separate
  hosted 1440px/390px acceptance. Prior local desktop/mobile checks remain separate.
- The signed-in acceptance check is pending the user's first hosted login.
  No real profile, discovery, saved-area, research, password or account writes were
  performed by these deployment checks.

No paid plan, custom domain/DNS change or scheduled research worker was enabled.
Do not infer passing live Gemini, OneMap routing, profile writes, email delivery,
account deletion or physical-device installation from anonymous deployment checks.

## Environment

Configure only Production for the initial real backend. Do not copy credentials to
untrusted preview branches. Upload values through private environment settings,
never source files, public variables, command arguments or documentation.

| Variable | Production value or source |
| --- | --- |
| APP_MODE | `supabase` |
| APP_ORIGIN | `https://homematch-sandy.vercel.app` |
| LOCATION_MODE | `onemap` |
| SUPABASE_URL | Existing project URL |
| SUPABASE_PUBLISHABLE_KEY | Existing publishable key |
| SUPABASE_SERVICE_ROLE_KEY | Existing backend-only secret |
| GEMINI_API_KEY | Existing private key |
| GEMINI_MODEL | `gemini-3.1-flash-lite` |
| ONEMAP_TOKEN | Existing token, optional with account renewal |
| ONEMAP_EMAIL / ONEMAP_PASSWORD | Existing private renewal credentials |
| OPERATION_LIMITS_ENABLED | `true`; hosted migration already applied |
| PASSWORD_RECOVERY_ENABLED | `true` after hosted recovery callback verification |

Do not upload Vercel's local OIDC token or research-worker settings. Local
`APP_ORIGIN` remains `http://127.0.0.1:4175`; do not overwrite `.env.local` with
downloaded production values. Vercel CLI linking may append a local OIDC token.
The complete `.env*` family is excluded from deployment uploads and Git.

## Authentication

Preserve existing local redirect entries. Add these exact production URLs to
Supabase Auth URL Configuration:

- `https://homematch-sandy.vercel.app/auth/callback`
- `https://homematch-sandy.vercel.app/auth/confirm`
- `https://homematch-sandy.vercel.app/auth/recovery`

Set the Auth Site URL to the production origin once the release is verified.
Do not add wildcard deployment domains or accept a callback URL from client input.
Google continues to use the same Supabase provider callback; do not replace it
with the website callback in Google Cloud Console.

The signup email body now uses this link (the server supplies the full callback
path, so do not append `/auth/confirm` a second time):

```html
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}">Confirm email address</a></p>
```

## Release

1. Confirm `vercel teams ls` still reports Hobby; do not enable a Pro trial.
2. Run `npm run check` and `npm run build`.
3. Inspect `.vercelignore`; credentials, cache, evidence and test artifacts are not
   build inputs. Keep `public/` and `src/` included.
4. Configure the approved production environment and exact Auth callbacks.
5. Deploy the current checkout with `vercel deploy --prod --scope home-match1`.
   CLI deployments include local application edits; no Git commit or push is
   implied. Never pass `--public`, which exposes source browsing.
   The initial preview used deployment-specific APP_MODE/APP_ORIGIN/LOCATION_MODE
   overrides. Do not reuse those preview flags for the real backend release;
   deploy afresh from the approved project Production environment.
6. Verify HTTPS, headers, manifest/worker/offline assets, anonymous access denial,
   wrong-origin denial, provider callback generation and desktop/mobile rendering.
7. Complete real Google sign-in and approved-account search/AI/saved-area acceptance.
   Do not create, delete or reset a real account as an automatic smoke test.

Production protection, ingress rules and provider/Auth abuse settings require a
separate review. App-level quotas are not a full internet-facing security audit.
Hobby has usage caps and no paid team-collaboration features; do not claim unlimited
service or a five-second search SLA.

## Data Refresh

The standalone refresh worker can run up to 25 minutes and requires its own host.
It is not a Vercel function or Vercel Cron task. Run manually on the designated
trusted host initially; keep immutable hosted snapshots in Supabase. Do not start
watch mode inside a web request, use the ephemeral function filesystem as durable
storage, or publish a snapshot as part of deployment testing without approval.

## Rollback

Record the verified deployment URL after each release. In Vercel's deployment
history, promote the last verified production deployment if a new release fails.
Roll back code without reverting database data, deleting profiles or changing
OAuth credentials. Environment changes may need separate restoration and a new
deployment. With no previous release, restrict access/pause the project while
repairing it instead of claiming a rollback exists.

References: [Vercel CLI](https://vercel.com/docs/cli/deploy),
[function limits](https://vercel.com/docs/functions/limitations),
[Supabase redirects](https://supabase.com/docs/guides/auth/redirect-urls).
