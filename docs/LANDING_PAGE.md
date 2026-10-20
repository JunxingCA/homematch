# Signed-Out HomeMatch Entrance

## "Lights On" Entrance (UI redesign, October 2026)

The signed-out entrance now uses the "Lights On" identity: night-blue, window-light
amber and HDB-facade mint, Bricolage Grotesque headings and Schibsted Grotesk body
text (bundled locally, see `src/app/fonts/README.md`). The red, rose and emerald
`?palette=` previews and the Unsplash hero photo were retired with the old layout.

- Launch intro: a gate ("Turn the lights on" / "Enter without sound") is needed so
  browsers allow sound; the city then lights up window by window, the logo window
  lights and the curtain lifts. Sound is synthesised with Web Audio (no audio
  files). It plays once per session (`homematch-intro-seen` and the sound choice
  `homematch-sound` are sessionStorage flags; nothing personal is stored) and is
  skipped entirely for `prefers-reduced-motion`. "↺ Intro" replays it.
- Hero: a 24-second day-to-night "living window" with parallax, a magnifier lens
  on the headline (mouse only), a trust strip, "Three floors" steps drawn as lit
  facades, and "Pick a life" presets. Presets only pre-fill lifestyle categories,
  weights and flat types in the planner; nothing is saved or sent.
- Theme: Auto (dark 7pm–7am), day or night. Auto stores nothing; an explicit
  choice is the existing `homematch-theme` localStorage key.

### Workspace, results and states

The signed-in workspace and preview planner use the same design:

- Planner: "Build your ideal block." Six questions (housing type, budget, layouts,
  weekly places, Must/Nice/Skip for each lifestyle, priorities) drive a block
  illustration. Must maps to priority 5, Nice to 3, Skip removes the lifestyle.
- Results: matches light up across the island from each area's real coordinates
  (once per session via the `homematch-reveal-seen` sessionStorage flag; Replay and
  Skip; reduced motion skips it). List cards show the overall match as lit windows
  plus the three component scores. "A weekday in ..." is told only from the search
  evidence: the routed 08:00 trip, the nearest imported facilities (straight-line
  walking estimates, labelled as such) and weekly travel time. Comparison opens with
  one block per area (a floor per score) above the unchanged evidence table.
- States: loading, empty, no-matches and error screens use a night block whose
  windows wave, stay dark or flicker; unknown routes show "This unit doesn't
  exist." with a 404 status; the offline fallback matches (cache `v3`).

E2E checks set `homematch-intro-seen` and `homematch-reveal-seen` in sessionStorage
so they start after the intro and reveal; dedicated tests cover both.

Started locally 14 October 2026. Not a new identity provider, account model or
property-listing product. Anonymous production visitors see LandingPage; returning
signed-in users still open the existing workspace directly. `/welcome` also shows
the entrance and offers Open workspace for existing sessions. Preview mode keeps
the existing planner unless `/welcome` is selected.

Start matching opens the existing registration dialog; header Sign in
opens the existing login. Google, email, recovery and configured-only Apple reuse
the original handlers. No key, personal profile or draft is passed through a new
URL. Preview planner is a transient manual form, not anonymous authenticated data
access or persistent guest storage. Its existing save/search gates remain in force.

An earlier version took layout inspiration from https://riilestate.com (full-width
photography, emerald actions, a cursive accent); that layout was replaced by the
"Lights On" redesign above. HomeMatch does not copy any listing site's brand,
property facts, imagery, pricing claims or proprietary service.

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
