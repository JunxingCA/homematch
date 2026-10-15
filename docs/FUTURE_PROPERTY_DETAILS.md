# Future Feature: Property Listing Detail Overlay

Requested 14 October 2026 from the user's reference screenshot. **Planned only;
not implemented, not live and not part of the current area-ranking evidence.**

## Intended Experience

Selecting an authorised property marker opens a responsive overlay / mobile sheet:

- Photo gallery with previous/next buttons, position indicators, image count,
  keyboard support and useful alternative text; a clear no-photo state.
- Asking price, floor area (sqm and/or sqft), derived price per square foot,
  remaining lease, block/street, storey band, property/flat type, bedrooms and
  bathrooms, with units and unknown values clearly represented.
- Source listing date, last verified/source-updated time and outbound More details.
- Details, Show/hide nearby distances and Routes controls. Selecting a listing
  must not silently substitute its location into a saved area's score.
- Close, save/unsave and compare where permitted, with original map position,
  selected area, filters and route state preserved on dismissal.

The reference's photos, asking price, layout, dates and orange styling must not be
copied as HomeMatch data or branding. Historical transaction prices are not asking
prices; lease information needs a legitimate source, not a guess from a screenshot.

## Gates Before Implementation

- [ ] Confirm an authorised/licensed feed or explicit permission for listing
  metadata, photos, floor plans and geographic locations. Public page visibility
  does not itself authorise scraping/rehosting. HDB resale transactions alone do
  not supply live listings, room photos, bedroom/bathroom facts or availability.
- [ ] Review provider terms: permitted caching, attribution, refresh, image rights,
  expiry/removal, API quotas and outbound links. No restricted scraping workaround.
- [ ] Update scope, use cases, data dictionary and design models: current product
  is area-first research and explicitly does not aggregate live listings.
- [ ] Introduce a separate Listing model/adapter with source ID, permitted photo
  references, exact/approximate location, asking price, units, known attributes,
  source timestamps, status and refresh policy. Keep it separate from AreaResult.
- [ ] Validate derived psf only with a positive, known area and explicit conversion;
  do not calculate missing lease, rooms, update dates or occupancy/eligibility.
- [ ] Use verified property coordinates for property-specific routes. Disclose
  geographic distance versus routed walking/travel estimates and any approximation.
- [ ] Build desktop overlay/mobile sheet with accessible gallery, focus trap,
  Escape/close, loading, unavailable/deleted/expired listing and no-image states.
- [ ] Decide whether saves apply to areas or listings; implement separate stable
  IDs, owner access rules and deletion/retention policies if listing saves are added.
- [ ] Test source outage, stale/removal behaviour, safe external/image URLs,
  missing values, photo failures, conversion, keyboard/touch and both themes.
- [ ] Verify actual source permission and real data end to end before presenting
  this as a functioning feature. Do not merge synthetic listing cards into rankings.

## Current Alternative

Until an authorised feed is obtained, retain the existing HDB/PropertyGuru outbound
links and area evidence. The reference is a future UX direction, not a claim that
HomeMatch already hosts a property marketplace or computes valuations.
