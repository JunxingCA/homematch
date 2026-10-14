# Map workspace

The results screen is now a full-viewport OneMap workspace, inspired by the map-first interaction patterns in the supplied riil Estate reference and the original HomeMatch mockup. It does not import another site's listings or reproduce its branding.

## Presentation

- Official OneMap Night tiles for dark mode and GreyLite tiles for light mode, with OneMap/SLA attribution retained.
- Desktop: floating ranked-area tray and independently scrolling evidence panel.
- Mobile/tablet: Matches and Area details panels in a collapsible bottom sheet; a list view provides more room for research.
- Accessible pins show the original rank and either the match score or rounded historical median resale price. These are town-level research results, not asking prices or available properties.
- Town search and sort only change presentation. They do not modify the saved profile, original ranking, scoring or discovery snapshot.
- Routes use the selected area's saved evidence. Amenity browsing independently loads the latest imported public snapshot around that area's trusted MRT origin, including categories not selected in the profile. It never recalculates scores or overwrites saved evidence. This is not a live amenities inventory.
- Geographic circles use a separate exploration radius (1, 2, 3 or 5 km) around the representative MRT origin. They are not profile scoring radii, walkable catchments, property boundaries or BTO project boundaries.
- A visible legend and matching coloured toolbar/layer swatches distinguish amenity dots, exploration rings and routes. Personal destinations use a purple square with D; map tooltips identify facility category, venue and geographic distance.
- Theme, list/map and comparison changes retain the map instance; switching themes retains the current position and zoom.
- Tooltip width is content-sized with a viewport-safe maximum, preventing wrapped text from collapsing into a one-character column inside Leaflet's zero-width tooltip pane. Map resizing ignores hidden/zero-size containers and preserves its centre when the list/map view changes. Browser assertions cover both behaviours on desktop/mobile.
- Tile outages expose a retry control while leaving historical evidence available. Saved-area failures still show the existing application alert.

## Scope

Real ranking remains Resale HDB only. BTO and private-housing datasets, live listings, listing images and property-level routing are not added by this visual change. Existing evidence explanations, source dates, partial coverage warnings, comparison and saved-area persistence remain unchanged. The 13-category catalogue and separate exploration layer are documented in AMENITIES.md. Profiles still score at most six lifestyle priorities.

## Verification

Tile failures are retained per layer so a cached/older successful tile cannot clear
the warning for a newly failed load. Retry creates a fresh layer without replacing
the map. The outage regression requests an uncached zoom level because an image
already displayed by the browser can bypass later network interception.

`npm run check` checks lint, types and unit tests. `npx playwright test --config=playwright.research.config.ts` checks the results and AI draft journeys at 1440x1000 and 360x800, including panel navigation, saves, comparisons, filtering, layers, keyboard pins, tile theme changes, map-instance preservation and map-outage retry. Browser API responses are fixtures; OneMap tiles are fetched live except in the explicit outage test. These tests do not modify real accounts or saved research.
