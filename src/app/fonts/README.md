# Bundled Fonts

Bricolage Grotesque (display: headings, the wordmark and large numbers) and
Schibsted Grotesk (body) are unmodified variable TrueType fonts from the official
Google Fonts repository, redistributed under their accompanying SIL Open Font
Licences. Next.js serves these assets from our own origin; builds and visitors do
not need to contact Google Fonts.

- Bricolage Grotesque: https://github.com/google/fonts/tree/main/ofl/bricolagegrotesque
- Schibsted Grotesk: https://github.com/google/fonts/tree/main/ofl/schibstedgrotesk

Both families draw a plain (unslashed) zero. Fallbacks are sans-serif, never
generic cursive (which can resolve to Comic Sans on Windows).
