# BTO and Private-Housing Area Exploration

Update, 14 October: the explorer is retained, and now also offers explicit separate
BTO/private ranking requests. See MARKET_RANKING.md for the implemented formulas,
archived BTO catalogue, URA setup gate and source limitations. The original
exploration-only behaviour documented below is not itself a price ranking.

Implemented 13 October 2026. Select a confirmed BTO, Condominium or Private / landed
profile under My profiles, then choose Explore areas. Resale HDB profiles continue
to use the existing deterministic recommendation search.

## Scope

The catalogue reuses the imported 26 HDB-town representative MRT origins. It is not
a complete private-neighbourhood catalogue, a BTO-project map, a listing inventory,
or a town-boundary dataset. Towns are alphabetical, not ranked. Named markers show
no scores or prices. Budget, flat types, lookback and weights remain in the stored
profile but do not filter this exploratory view.

Users can select any imported town, browse the 13 amenity categories independently
of their saved priorities, change the 500-5,000m browsing radius and request OneMap
journeys to their saved destinations. Facilities use geographic distance from the
representative origin, not walking routes or a particular home's entrance. Imported
venue coordinates/access restrictions, school admission and incomplete grocery
coverage have the same limitations documented in AMENITIES.md.

No HDB resale price is repurposed as BTO or private-property affordability. No
eligibility, current price, available project, available unit or booking claim is
made. Complete category-specific rankings need approved project/private-market
evidence and separately documented formulas.

## Interfaces and Security

- GET /api/exploration: authenticated catalogue read, returning validated public
  origins and import metadata only, with no-store response headers.
- POST /api/exploration: same-origin JSON with profileId, revision, areaId, radius
  and includeRoutes. Strict validation rejects extra owner IDs/coordinates/scores.
- The server verifies the active session, resolves an owner-scoped confirmed profile
  at exactly that revision, and resolves the requested area from the trusted public
  snapshot. An unknown area, stale profile, missing owner or stale snapshot fails.
- Without includeRoutes, no routing-provider request occurs. With it, at most the
  profile's four destinations are calculated, sequentially, with a 65-second bound
  and one in-flight routing request per owner per process. Distributed limits remain
  deployment work; this in-memory guard is not claimed as a global rate limit.
- Routing derives coordinates/modes/visit counts from the verified saved profile.
  Departure is tomorrow at 08:00 Singapore time, recorded with fetch time. A required
  route failure returns no partial journey result. The independent amenity request
  remains usable and retryable.
- Before returning private details, the server rechecks session identity and the
  profile revision. Expiry, account switch, deletion or a changed profile withholds
  results. All successful/error responses use the existing safe no-store envelope.
- Client responses are schema-validated and matched to area, radius, profile,
  revision and category. Changing areas/unmounting aborts old requests; a late
  response cannot populate the new selected area's evidence.
- No new table, migration, grant, account or persistent discovery is created.
  Exploration and its journeys are ephemeral; no unscored shortlist/comparison is
  advertised. Existing saved rankings retain their original evidence. Logout or
  account deletion clears the explorer through the parent workspace state.

## Listing Links

PropertyGuru links use its verified public search URL with listingType=sale,
isCommercial=false, keyword=<selected town>, and propertyTypeGroup H/N/L for
resale HDB/apartments-and-condos/landed respectively. The keyword is URL-encoded.
Only the town and property type are shared, never a user ID, budget, destinations,
coordinates or profile name. The hostname/path is fixed rather than browser input.

This is a keyword search, not a geographic boundary filter. Listings mentioning an
area can be outside it; users must confirm their locations and asking prices on the
provider's site. In particular, combining a private type with PropertyGuru's
hdbEstate filter produced an empty result during verification, so that filter is
not used for the explorer.

Official HDB links open https://homes.hdb.gov.sg/home/finding-a-flat. Its own town
selection was verified through the public UI but produced no portable town-filter
URL. HomeMatch therefore explicitly asks users to choose the town and BTO/resale on
that portal. It does not invent a query parameter or imply that this generic
official link is already filtered. Current BTO-project deep links are not hardcoded
because availability changes with launches.

All links open a new tab with noopener/noreferrer and no-referrer. The selected
HomeMatch area, layers, theme and journeys remain in the original tab. External
pages are not scraped, embedded or used as authoritative pricing evidence.

## Verification

Controller/domain/route tests cover the three pathways, absence of prices/scores,
strict inputs, missing ownership, stale revision/snapshot, trusted origins, explicit
routing, concurrency, provider failures and final session/profile revalidation.
Browser tests use isolated mocked profiles and APIs with real OneMap tiles; they
cover all pathways in both themes at 1440px desktop and 360px mobile, independent
layers, geographic radius, external-tab preservation, retries and cancellation.

Two opt-in live checks passed: latest public snapshot/catalogue/facilities validation
and a real OneMap transit route between the Bedok reference origin and a public NTU
landmark. They read no personal profiles and create no stored searches. These checks
do not prove a hosted authenticated BTO/private-profile journey end to end.

Run the explicitly opted-in read-only checks with:

```bash
node --env-file=.env.local node_modules/vitest/vitest.mjs run --config vitest.live.config.ts tests/live/exploration.test.ts
```

Public browser verification on 13 October 2026 confirmed PropertyGuru's category
and keyword parameters by submitting its actual filters, and HDB's official
navigation through its town dropdown/search. Automated tests validate generated
URLs and popup state, not the listing providers' future filter stability or stock.

## Source References

- [PropertyGuru verified Bedok condo keyword search](https://www.propertyguru.com.sg/property-for-sale?listingType=sale&page=1&isCommercial=false&keyword=Bedok&propertyTypeGroup=N)
- [Official HDB Find a Flat](https://homes.hdb.gov.sg/home/finding-a-flat)
- [Supabase owner-scoped Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

See IMPLEMENTATION_CHECKLIST.md for implementation, verification and deferred work.
