# HomeMatch Team Handover: Lab 3 Meeting

14 October 2026, 9 pm Singapore time. This document distinguishes implemented
code, automated checks, user-reported acceptance, and provider setup still needed.

## Two-Minute Explanation

HomeMatch is an area-recommendation application, not a property-listing marketplace.
The usable prototype now has accounts, saved preference profiles, verified OneMap
destinations, AI-assisted preference extraction, resale HDB area ranking, a map
with independently selectable amenity layers, area comparisons and saved areas.
Users can enter frequent destinations and visit frequency, lifestyle priorities,
budget and relative journey/lifestyle/budget weights. They review any AI-produced
interpretation before saving; the AI does not invent locations or calculate scores.

The frontend and backend are one Next.js/TypeScript application. Supabase handles
identity and PostgreSQL persistence. OneMap provides address search, maps and
journeys. Government datasets provide price and amenity evidence. Gemini converts
natural-language descriptions into a draft of structured preferences. A deterministic,
versioned formula produces the recommendation scores and explanations.

The new increment, tested locally before deployment, adds clearable search history, BTO launch-area price-range
ranking, URA-based private-district price ranking, and an Apple OAuth integration.
Apple is intentionally disabled until the developer account/provider is configured.
Private ranking cannot return verified prices until the separate URA key/import is
connected. Do not present either provider connection as already tested live.

## What Is Already Available

| Area | Current capability | Important boundary |
| --- | --- | --- |
| Accounts | Google/email sign-in, managed sessions, logout, recovery, deletion | Owner/session checks also run on the server/database |
| Preferences | Up to four profiles; confirmation and revision tracking | Up to four destinations and six lifestyle priorities |
| OneMap | Location candidates, verified selections, transport/driving journeys | Estimates use disclosed representative origins and departure assumptions |
| AI | Gemini interpretation with consent and an editable review | Drafts are not automatically saved; manual entry remains available |
| Resale HDB | 26 town-reference candidates with historical price, commute and amenity scoring | At least five matching transactions; not live asking prices |
| Map | Dark/light modes, routes, radius, labelled amenity markers and independent layers | Geographic radius is not walking distance; source coverage varies |
| Sports | Badminton, gyms, basketball, football, swimming, tennis, fitness corners, running tracks | Imported venues are not proof of public access or booking availability |
| Everyday facilities | Parks, hawkers, groceries, schools and hospital-based healthcare | Groceries are incomplete; schools do not establish admission eligibility |
| Research | Stored results, two/three-area comparison and persistent saved areas | Each result retains its original preferences, data and formula version |
| PWA | Installable website, offline/reconnect screen and controlled updates | No private API responses are cached for offline use |

The project owner reports that password reset, account deletion and installation
have been manually tested. Device/browser/date details were not supplied; this is
recorded as user acceptance, not an independently repeated automated result.

## Latest Increment

- Clear recent searches: confirmation, retry, account-scoped persistence, empty
  state and cross-tab refresh. Original result evidence remains available to saved
  areas; profiles/bookmarks are not deleted.
- BTO: separate launch ranges from HDB's June 2026 Annex A. All seven projects in
  that imported exercise are historical; applications closed on 24 June. Range
  coverage is not a count/probability of affordable flats. Grants, HFE eligibility,
  application success and current unit availability are not predicted. Town MRT
  proxy locations are explicitly labelled, not advertised as project entrances.
- Private: a four-batch URA importer, SVY21 conversion through proj4, size/area-basis/
  sale-type filters, postal-district ranking and immutable source evidence. Single-
  unit caveats only; five matching transactions minimum. Apartments/condominiums
  and landed types are separate; executive condominiums are not silently mixed in.
- Apple: managed Supabase OAuth with the same verified session registration and
  fixed callback as Google. Activation requires Apple Developer configuration.
- Custom address: `homematch.unify-x.com`, with DNS in Cloudflare and hosting on
  Vercel. Deployment status is recorded separately in VERCEL_DEPLOYMENT.md.

## Architecture and Code Ownership

| Layer | Files/folders | Responsibility |
| --- | --- | --- |
| Startup/configuration | `src/app/page.tsx`, `src/server/config.ts` | Validate configuration and construct the initial screen |
| UI boundaries | `src/components/` | Forms, interpretation review, map, results, shortlist, account/install dialogs |
| HTTP boundaries | `src/app/api/`, `src/app/auth/` | Request validation, same-origin protection, private/no-store responses |
| Application controls | `src/server/controllers/` | Authenticate, load owned profiles, coordinate providers, revalidate before publication |
| Domain/entity logic | `src/domain/` | Schemas, scoring formulas, evidence types, ranking and validation |
| Persistence | `src/server/repositories/`, `supabase/migrations/` | Owned profiles, immutable discoveries, bookmarks, history settings and RLS |
| External adapters | `src/server/adapters/`, `src/server/providers/` | OneMap, Gemini and government research/pricing data |
| Background/import work | `scripts/`, `ops/` | Import/validate public data and refresh snapshots independently of browser requests |

The layered structure, repository and adapter boundaries are the useful design
patterns to discuss. Do not claim every React function is a UML class. Model
controllers/repositories/adapters as design classes and components as boundary
elements. Document their public operations, dependencies and important attributes.

## Suggested Team Allocation

Assign actual names during the meeting; these are responsibilities, not claims that
any member has already accepted them.

| Owner slot | Work package | Starting points | Definition of done |
| --- | --- | --- | --- |
| A | Accounts/security testing and Apple setup | AuthenticationController, AccountDialog, PASSWORD_RECOVERY.md, APPLE_SIGN_IN.md | Reproducible test evidence; Apple configured only when credentials exist |
| B | BTO source maintenance and source review | data/bto-2026-06.json, marketRecommendations.ts, MARKET_RANKING.md | Check every range/date; add a verified new launch without marking closed data open |
| C | URA connection and private-market validation | scripts/import-private.mjs, marketEvidence.mjs, MarketPriceAdapter | All four batches validate; real key stays private; check district/type/size samples |
| D | Map/UI and accessibility | AreaExplorer, AreaMap, RecommendationResults, Shortlist | Desktop/mobile and both themes; keyboard/tooltip/overflow checks; no ambiguous evidence labels |
| E | Architecture/design model and integration | Controllers/repositories/domain, docs/TRACEABILITY.md | Class diagram and dialog map match actual boundaries, persistence and errors |
| F | QA/CI/data operations and Lab 3 report | tests/, scripts/, docs/IMPLEMENTATION_CHECKLIST.md | Reproducible checks, evidence of failures/retests, refresh schedule and report artefacts |

For a smaller group, combine B+C and E+F. Agree ownership before touching the large
shared HomeMatch.tsx component. Prefer small feature branches and reviewed PRs;
avoid simultaneous edits to the same screen/controller without coordination.

## Teammate Setup

1. Obtain access from the repository owner to the private `JunxingCA/homematch`
   repository. Do not add collaborators without the owner's approval.
2. Clone the repository and use Node.js 22, then run `npm ci`.
3. Start with `.env.example`. Preview mode lets teammates inspect the UI without
   production credentials. Do not share `.env.local` or screenshots containing keys.
4. For authenticated local testing, use a separate Supabase development project
   where practical, apply the reviewed migrations in order and configure exact
   local callbacks. A shared production database is not disposable test storage.
   If the Google OAuth consent app remains in Testing status, the owner must add
   each tester's Google address to its test-user list. Google login can otherwise
   be refused even when HomeMatch works. Email registration is a separate route.
5. Start with `npm run dev -- --hostname 127.0.0.1 --port 4175`, using a matching
   APP_ORIGIN. Then run `npm run check`.
6. Browser fixtures: `npx playwright test --config playwright.research.config.ts`.
   This suite expects the local development server on port 4175. Fixture/provider
   tests are not substitutes for testing a real authenticated hosted search.
7. Before changing a use case, identify the UI boundary, controller, domain
   function, persistence/provider impact and tests. Keep requirements/design/code
   and test identifiers aligned.

## Meeting Demo Order

1. Google sign-in, My profiles and a confirmed example profile.
2. Frequent destination selection and editable Gemini interpretation using public
   landmarks, not a teammate's personal address.
3. Existing resale search: map, score explanation, layers added after onboarding,
   comparison and saved areas. A stored result is not a fresh routing benchmark.
4. Clear-history confirmation: explain that saved-area evidence is retained.
5. Local BTO historical-launch ranking and its source/date/origin limitations.
6. Show private-price import and Apple setup checklists as pending external setup,
   rather than demonstrating mocked results as live provider success.
7. Assign owners, test cases, review process and dates for Lab 3 artefacts.

## Lab 3 Submission Checklist

Based on the supplied Lab 3 manual, submit under the school repository's `lab3`
folder before the start of Lab 4, according to your own lab slot:

- [ ] Complete use-case diagram and descriptions, including alternate/error flows.
- [ ] Detailed design class diagram with attributes, operations and dependencies.
- [ ] Refined UI dialog map consistent with the implemented journeys.
- [ ] System architecture and justification of stack/design decisions.
- [ ] Application skeleton or in-progress prototype with clear overall structure.
- [ ] Short AI report: prompts/responses for updated stack advice, comparison with
  Lab 2, skeleton-generation prompts/responses and critical evaluation.
- [ ] Separate ZIP of the AI-generated TODO-only skeleton, distinguishable from
  the hand-modified/full prototype. Do not misrepresent implemented source as the
  original TODO-only output or invent an earlier AI transcript.

Sequence diagrams are explicitly no longer required in this manual. An implemented
prototype is permitted, but does not by itself satisfy the report/design items.

## Release and Acceptance Record

- Source is pushed to the private `JunxingCA/homematch` repository. Application
  commit: `68c03d8`; live app: https://homematch.unify-x.com.
- 407 unit/database checks, lint, strict types and the final production build pass.
- 46 desktop/mobile research/account/AI/map/history regressions pass. Production
  PWA checks: 24 pass, three intentional platform-specific skips.
- A read-only real-data BTO/OneMap check passes for the seven archived projects.
- Hosted anonymous/security/OAuth-initiation checks pass at the custom domain.
  Sign in once there; fresh authenticated end-to-end checks on that hostname
  remain pending. Earlier signed-in checks used the previous Vercel alias.
- Password reset, account deletion and installation: owner reports manual success.
- Additional market/Apple checks and final release details: see the completed
  increment in IMPLEMENTATION_CHECKLIST.md, MARKET_RANKING.md and VERCEL_DEPLOYMENT.md.
- Remaining provider gates: URA access key/import and Apple Developer configuration.
- Remaining BTO work: expand beyond the archived June exercise and replace town
  MRT proxies with verified project locations before claiming project-level routes.
- Before teammates test: grant the intended teammates access to the private
  GitHub repository and, while Google OAuth is in testing mode, add their Google
  accounts to the OAuth test-user list. Neither access change was made automatically.

## Source References

- [URA API documentation and access-key registration](https://eservice.ura.gov.sg/maps/api/)
- [HDB June 2026 price annex](https://www.hdb.gov.sg/-/media/hdb-pulse/news/2026/20260617-HDB-Launches-6952-Flats-Across-7-Projects-in-June-2026-BTO-Sales-Exercise/Annex-A.pdf)
- [Supabase Apple OAuth configuration](https://supabase.com/docs/guides/auth/social-login/auth-apple)
- Local course reference: `SC2006/Lab 3 Manual.pdf`, sections 3.3, 3.4 and 4.
