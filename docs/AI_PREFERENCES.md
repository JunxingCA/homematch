# Reviewed Gemini Preference Drafts

Implemented 13 October 2026. The product owner chose Gemini instead of OpenAI for
free-tier prototype testing; this overrides the provider choice in the original
coding prompt, not its extraction-only requirements. Submitted school files are
unchanged. The unused OpenAI SDK was removed.

## Configure

Create a key in your own authorised Google AI Studio project, then add to the
existing ignored `.env.local`:

```dotenv
GEMINI_API_KEY=your_private_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Restart the dev server. Do not commit or paste keys into chat. The model is
configurable; the current default is a documented stable model with structured
outputs and a published free tier. Google restricts older 2.5 models for new
projects. The cost-focused default is Gemini 3.1 Flash-Lite: standard paid text
pricing is USD $0.25 per million input tokens and $1.50 per million output tokens
(including thinking), with a published free tier. Gemini 2.5 Flash-Lite has lower
published prices, but access is restricted to prior users, so it is not the default
for this new project. No automatic upgrade or model fallback is used.
No billing is enabled by this application, but the project's actual
billing tier and quotas determine whether API calls are free; an Enterprise
chatbot licence does not establish this project's API entitlement.

Google's free-tier inputs may be used for product improvement. Test with synthetic
preferences/public landmarks, not real personal addresses or confidential school
information. A personal key does not inherit NTU Enterprise protections.

## Flow And Boundaries

- Signed-in users consent to sending only the description to Gemini and extracted
  destination names to OneMap. Account email, saved profiles and results are not
  included in the model request. No tools, web search or model database access.
- The Gemini adapter requests JSON constrained by the Zod-derived schema, then
  validates it again locally. Nullable fields remain null when not stated.
  Extra IDs, coordinates, commands or scoring fields are rejected. Every populated
  top-level field requires a verbatim quote from the description. Quote checks
  constrain grounding but do not prove semantic correctness; human review remains
  required. Unsupported requests and ambiguities are displayed, not converted
  into invented amenities or filters.
- Read the complete unsaved draft and its disclosed proposed defaults/retained
  values. Unsupported requests require acknowledgement. Apply changes only the
  editable current form, with no profile save/confirmation. Unspecified fields keep
  current form values; missing visits/mode/priority/radius have explicitly disclosed
  proposals. Conflicting budgets/weights are not silently repaired.
- OneMap candidates are loaded but never automatically selected. Explicit choice
  is required, and editing location text invalidates that choice. Normal review,
  strict profile validation and explicit confirmation remain the only save path.
- Gemini never scores/ranks areas or writes area explanations. Existing
  deterministic recommendation logic is unchanged. Failed/refused/incomplete or
  malformed responses preserve description text and manual preferences. OneMap
  failures preserve the extracted draft with unresolved destinations.

`GET /api/preferences/interpret` exposes only availability/provider/model to an
active owner. `POST` requires active authentication, same Origin, explicit consent
and 10-4000 characters. Output is capped at 4096 tokens, generation timeout at
30 seconds, with one attempt and no automatic retries or model switching.
Limits are 10 attempts/hour per account, 10 seconds between attempts and one
running extraction. Shared Supabase admission is now applied and enabled locally,
alongside conservative local guards, with service-wide budgets and expiring slots.
The chosen production host must also enable it. Failed admitted calls count as
attempts. See DEPLOYMENT_HARDENING.md.

HomeMatch does not persist raw text/AI drafts or put them in localStorage. Only
model/token counts are logged, not prompts, provider errors, account identity or
credentials. Canonical OneMap locations can be cached in the existing public
location catalogue; no user profile/discovery is created during interpretation.
Provider retention policies still apply. New profiles and profile switches reset
the draft view; in-flight responses cannot update an unmounted view. Session
failure opens sign-in and prevents draft application.

## Verification

On 14 October 2026, a new eight-case live corpus exposed dropped partial sports
and false unsupported MRT warnings. Instructions/examples and schema descriptions
were corrected; the final complete run passed all eight cases. Twenty-four real
synthetic calls were made across three controlled runs, with no account writes.
Final model/validation times were 2.232-4.252 seconds (median 2.861), excluding
OneMap/authentication/rendering. All 360 unit/database and 64 browser checks pass;
domain interpretation coverage is 100% lines and 98.61% branches. Eight automated
preference/AI accessibility scans pass after a progress-role fix. This is a small
regression corpus, not guaranteed semantic accuracy or a full signed-in live flow.
See TESTING_2026-10-14.md for retained failures, exact scope and repeat commands.

Lint/typecheck and unit tests cover consent, bounds, null fields, schema validation,
grounding, fabricated fields/quotes, duplicate values, incomplete/refused output,
quota errors, sanitised logs, rate limiting and session revalidation. Desktop/mobile
browser tests cover consent, defaults, unsupported requests, manual editing,
explicit location selection, no implicit writes, failure recovery, themes and
layout fit. Provider responses are mocked: no AI charges or live account writes.

Live verification passed on 13 October 2026 using `gemini-3.1-flash-lite` and
synthetic preferences. The real adapter returned schema-valid, grounded extraction
with the expected resale category, budget, flat type, public-transport destination
and badminton preference. Unspecified minimum budget and weights remained null.
No account/profile/database writes were performed. This checks the provider adapter,
not the complete signed-in browser flow, which is covered with mocked responses.
One earlier live check returned a valid draft but failed an incorrect test category
expectation; the assertion was corrected and the opt-in live test then passed.
The actual project's billing tier was not inspected or changed.

To repeat the opt-in provider check (makes one real API call):

```sh
node --env-file=.env.local ./node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/interpretation.test.ts
```

Sources: [structured outputs](https://ai.google.dev/gemini-api/docs/structured-output),
[model](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite),
[pricing](https://ai.google.dev/gemini-api/docs/pricing),
[data terms](https://ai.google.dev/gemini-api/terms).
