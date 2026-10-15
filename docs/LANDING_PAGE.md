# Signed-Out HomeMatch Entrance

## Alternative Palette Preview

`/welcome?palette=red` adds a deeper crimson option with charcoal/white surfaces,
matching HomeMatch logo and cyan/olive supporting tones. It is a visual direction
inspired by the user's HDB/Singpass reference, not government branding, affiliation
or a Singpass integration. Rose and emerald remain separate comparison options.

Open `/welcome?palette=rose` for a rose/cranberry accent with charcoal dark surfaces,
soft white light surfaces, cyan and olive supporting tones. It applies to the
landing, existing dialogs and planner without changing scores or user data.
Use `/welcome?palette=emerald` to restore the original. The palette selector is a
preview URL, not a persistent user setting; no new localStorage record is created.
Deployment status is recorded in VERCEL_DEPLOYMENT.md; preview URLs do not enable
additional account or provider permissions.

Started locally 14 October 2026. Not a new identity provider, account model or
property-listing product. Anonymous production visitors see LandingPage; returning
signed-in users still open the existing workspace directly. `/welcome` also shows
the entrance and offers Open workspace for existing sessions. Preview mode keeps
the existing planner unless `/welcome` is selected.

Find my area/Get started opens the existing registration dialog; header Sign in
opens the existing login. Google, email, recovery and configured-only Apple reuse
the original handlers. No key, personal profile or draft is passed through a new
URL. Preview planner is a transient manual form, not anonymous authenticated data
access or persistent guest storage. Its existing save/search gates remain in force.

The hero uses a self-hosted Singapore HDB photo by S M (iridescentstars), published
25 November 2022: https://unsplash.com/photos/a-group-of-tall-buildings-m6WvddK353k
under the Unsplash License: https://unsplash.com/license . Original delivery:
https://images.unsplash.com/photo-1669339173801-b4c4d3c277ee . Attribution links are
in the footer. It illustrates housing, not an advertised unit or current listing.

The user supplied https://riilestate.com as layout inspiration. HomeMatch does not
copy its brand, property facts, imagery, pricing claims or proprietary service.
Full-width photography, emerald actions, a restrained cursive accent and two
housing pathways adapt that direction to the actual area-research application.

Future property-card request is recorded separately in FUTURE_PROPERTY_DETAILS.md.
The dated group PDF is unchanged. Current release status is recorded here and in
VERCEL_DEPLOYMENT.md; the implementation checklist separates current/future work.

## Local Verification, 15 October 2026

- Lint, strict types and all 407 unit/database checks pass; production build passes.
- Twelve new desktop/mobile landing checks cover the actual locally served photo,
  themes, layout, existing email/Google failure flows, recovery entry, focus trap
  and restoration, returning sessions, preview and /welcome. Account APIs are mocked.
- Forty-six existing account/AI/map/history/market browser checks and eight recovery
  checks pass. Logout now returns to the entrance; the test enters Preview planner
  before inspecting the signed-out empty shortlist. No ownership check is relaxed.
- The opener-focus regression after a pending/failed OAuth request was fixed.
  Mobile line-break whitespace was also corrected after screenshot review.
- Dark/light desktop/mobile screenshots are inspected. Anonymous planner text is
  never written to localStorage; only the existing optional theme setting is allowed.
- Use playwright.local-recovery.config.ts when the configured local server already
  owns Next's dev lock. The independent recovery config cannot start another Next
  dev instance in the same checkout at the same time.
- No production upload, provider configuration, account mutation, migration or
  scheduled data import was performed for this increment. Physical installation
  and real hosted login are not re-certified by these mocked checks.

## Crimson Default Release, 15 October 2026

The owner approved publishing the crimson palette and landing page. Crimson is now
the server-rendered default, including the managed-auth recovery logo, favicon,
PWA icons and public offline reconnect page. The offline cache version advances to
v2 so updated public assets are installed through the existing approved-reload flow.
No private response caching, automatic worker takeover or new auth method is added.
The default source SVG is crimson; an explicit emerald SVG preserves comparison.

Release checks: 407 unit/database tests, lint/types and production build; 16
desktop/mobile landing/palette checks and 46 account/AI/map/history/market checks.
Source scan covers 219 candidate text files with zero configured secret matches.
Hosted verification and the production PWA suite are recorded in the release log.

Published and verified at https://homematch.unify-x.com from commit ecf06cc,
deployment dpl_ARFApzH8gCw6D2Mge1kDLQwABeRh. The PWA suite passes 24 checks with
three intentional platform skips. Hosted page/assets, anonymous access denial,
Google initiation and secret scans pass. Real authenticated/device acceptance is
not inferred from the fixture tests or opening the hosted sign-in dialog.
