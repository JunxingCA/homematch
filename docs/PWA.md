# HomeMatch Installation and Offline Behaviour

Implemented 13 October 2026. This is the existing website packaged as a progressive
web app, not a separate native app or an app-store release. No paid service or new
database table is required.

## Installation

- The header's download icon opens installation options. Chrome/Edge can use a
  deferred native prompt when the browser supplies one. Cancellation and failures
  leave the website usable; acceptance is not falsely reported as completed installation.
- On iPhone/iPad, the dialog gives Safari's Share > Add to Home Screen flow, including
  the Open as Web App switch when present. iPad desktop-style user agents are recognised.
- Other browsers receive browser-menu guidance. Standalone launches and browsers
  reporting installation hide the installation control.
- `src/app/manifest.ts` supplies a stable `/` identity/start URL, root scope,
  standalone display and 192/512px icons. The Apple icon is 180px. The maskable icon
  preserves the logo inside its safe zone; icons derive from the existing vector,
  using `node scripts/generate-pwa-icons.mjs`.
- Manifest/start URLs never contain account IDs, preferences or OAuth/recovery tokens.

The web app still uses existing server-verified sessions, profiles and APIs. Some
browser/OS combinations may require a fresh sign-in after installation. Installation
does not bypass session expiry or grant extra access. Phone installation needs a
public HTTPS deployment; `127.0.0.1` on a phone refers to that phone, not this Mac.

## Offline Privacy

The worker registers **only in production builds**, on a secure origin. Local
loopback origins are trusted for automated tests. Development does not register a
new worker or remove another app's registrations. An existing worker from a prior
production test on the same origin can remain; use a separate origin/port for tests.

Exactly four public, credential-free files are cached under `homematch-offline-v3` (v3: "Lights On" offline page and logo, October 2026):

1. `/pwa/offline.html`
2. `/pwa/offline.css`
3. `/pwa/offline.js`
4. `/homematch-logo.svg`

APIs, mutations, RSC payloads, app bundles, maps, tiles and external providers are
not intercepted or stored by this worker. Navigation is network-first and never
cached; a network failure returns the generic reconnect document. HTTP errors
remain HTTP errors, not offline successes. Failed API requests are not replaced
with HTML and are not queued or retried automatically. Evicted offline storage
falls back to a plain reconnect message if the worker is still installed.

This is not an offline private workspace. Existing in-memory edits may remain in
an already open tab, with an offline notice, but are neither written to browser
storage nor marked saved. Leaving/reloading the tab can lose unsaved edits; the
existing unsaved-change warning remains. Successful saves require a fresh server
response. Reconnection does not silently replay profile writes, AI calls or deletion.

The offline document contains no user data and links only to `/`. It never reads,
prints or replays the current URL's login/recovery tokens. It reports connectivity
without automatically navigating. Only the existing non-sensitive light/dark
preference is read from localStorage. Static icon/font HTTP caching is distinct
from caching private account data; existing authentication cookies remain governed
by the application's Auth/session protections.

## Updates

`/sw.js` has no-store response headers and registration uses `updateViaCache: none`.
The first worker claims pages after installation. A later worker waits; the UI asks
for explicit Update now approval, warns about unsaved edits and disables updating
offline. Only the approving tab reloads on controller change. Unrelated tabs are
not forcibly reloaded. Cache cleanup removes only older `homematch-offline-*` caches.

When changing cached assets, **bump CACHE_NAME's version in `public/sw.js`** so a
waiting update cannot overwrite the currently active worker's public asset set.
Never extend this cache to authenticated responses. After deployment, verify that
the host preserves worker headers and does not cache account/Auth responses at its CDN.

## Verification

- Lint/types and 221 unit/database tests pass, including 25 new PWA checks.
- Production build passes with `/manifest.webmanifest` and generated icon assets.
- `npx playwright test --config=playwright.pwa.config.ts` exercises a temporary
  production preview server on port 4318: 24 checks pass, three intentional skips
  for native-prompt tests on the iOS-guidance profile.
- Chromium desktop, Android viewport emulation and iPhone user-agent/viewport
  emulation cover metadata, actual worker control/cache, both themes, dialog focus,
  offline navigation, token-bearing URL safety, reconnect and no request replay.
- Native prompt events, standalone state and waiting updates are controlled fixtures;
  they test UI handling, not an actual OS install or a real deployed worker upgrade.
- Mobile/desktop installation and offline screenshots were visually inspected.
- No hosted account was created, altered or deleted for these tests.

Before claiming device acceptance, deploy the real application over HTTPS and check:

- [ ] Android Chrome install, app icon/launch, Google sign-in, offline launch and removal.
- [ ] iPhone Safari Add to Home Screen, app icon/launch, Google sign-in and offline launch.
- [ ] Desktop Chrome/Edge installation and installed-app navigation.
- [ ] Real worker upgrade: waiting notice, cancellation, approved update, multiple tabs.
- [ ] Deployed Cache Storage contains only the four public files; API/Auth CDN headers remain private/no-store.

## References Checked

- [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps), plus bundled Next 16.4 manifest/icon/viewport documentation.
- [MDN installation prompts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
- [WebKit Safari 26 features](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/).
- [Supabase SSR caching precautions](https://supabase.com/docs/guides/auth/server-side/advanced-guide); no Auth or database configuration was changed.
