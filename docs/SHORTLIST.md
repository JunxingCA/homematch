# Account Shortlists

Implemented 13 October 2026. Migration `202610130001_shortlist.sql` was applied
to the configured hosted HomeMatch Supabase project after user approval.

## Behaviour

- Save or remove the selected town from recommendation evidence. The workspace's
  Saved areas view loads the owner's bookmarks after sign-in, including on reload.
- Each account can bookmark a town once. Concurrent/repeated saves do not create
  duplicates or silently replace its original source search. Remove and save again
  from a newer search to explicitly replace that evidence.
- A bookmark references an immutable completed discovery and its area ID. It does
  not copy or recompute scores. Profile edits/deletion do not change saved evidence.
  View evidence reopens the original discovery with the correct town selected.
- Compare two or three saved areas. Columns disclose the source profile, date,
  housing type, budget, weights, evidence window and amenity coverage. Overall
  scores across different profiles or dates are not directly comparable; the UI
  warns rather than presenting a new combined ranking.
- Failed reads show retry, not an empty shortlist. Failed writes leave the visible
  bookmarks unchanged. Controls are disabled during a write. Sign-out, session
  expiry and account switching clear private shortlist state; stale requests
  cannot repopulate it. Nothing is stored in browser localStorage.

## Boundaries

`GET /api/shortlist` lists owned items; `POST /api/shortlist` accepts only
`discoveryId` and `areaId`; `DELETE /api/shortlist/:id` removes an owned bookmark.
All routes require an active application session and return private/no-store
responses. Mutations additionally require the configured same-origin header.

The new table grants authenticated users SELECT, INSERT and DELETE, but no UPDATE.
RLS enforces active-session ownership. INSERT also checks that the source search
belongs to the same owner and actually contains that area. A client cannot submit
scores or bookmark an invented town or another user's search. A unique constraint
enforces one town per account, with duplicate saves retaining the first source.
Auth account deletion cascades bookmarks; discovery deletion also cascades them.

## Verification

- Live signed-in app: save a real recommendation, load it after full browser
  reload, reopen the correct area and remove the temporary bookmark. Successful
  Supabase CRUD, with existing profiles/discoveries left unchanged.
- Unit/controller tests cover strict identifier inputs, session denial, owner
  filtering, absent source areas, duplicate behaviour and sanitised storage errors.
- PGlite applies all three migrations and checks owner reads/removal, cross-owner
  denial, forged inputs, no UPDATE, duplicate idempotency, session expiry/revocation,
  anonymous denial, persistence across logins and account/source deletion cascades.
- Desktop/mobile browser checks cover failed saves, persistence after reload,
  reopening, comparison and its two/three-item bounds, retryable read failures,
  empty states, sign-out clearing and layout fit. Original preview checks also
  exercise same-origin protection on the new save/remove endpoints.
- Final checks: lint/typecheck pass, 107 unit/PostgreSQL tests pass, 14 browser
  checks pass (six recommendation/shortlist and eight original preview checks),
  production build succeeds, and `git diff --check` is clean.

Run `npm run check`, the original `npm run test:e2e`, and the Supabase-mode
`npx playwright test --config playwright.research.config.ts` (local port 4175).
Browser tests use isolated fixture accounts; they do not modify live user data.

This is not a public deployment or a GitHub push. GPT extraction, BTO/private
pricing and automatic dataset refresh remain separate work.
