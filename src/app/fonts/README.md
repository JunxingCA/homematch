# Bundled Fonts

DM Sans and Playwrite GB S are unmodified variable TrueType fonts from the
official Google Fonts repository, redistributed under their accompanying SIL
Open Font Licences. Next.js serves these assets from our own origin; builds and
visitors do not need to contact Google Fonts.

- DM Sans: https://github.com/google/fonts/tree/main/ofl/dmsans
- Playwrite GB S: https://github.com/google/fonts/tree/main/ofl/playwritegbs

Playwrite GB S replaces the invalid `Playwrite SG` family previously requested
by the external stylesheet. The final script fallback is serif, not generic
cursive (which can resolve to Comic Sans on Windows).
