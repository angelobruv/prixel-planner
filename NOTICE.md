# Third-party assets — read before making this repo public

**This repository is private, and it must stay private in its current form.**
It vendors copyrighted vendor material and a non-commercially-licensed font.

| Path | What | Licence / status |
|---|---|---|
| `assets/fonts/PRIXELMono.otf` | PRIXEL Mono, by Andrew Bellamy / Otherwhere Collective for PRIXEL Press | **Non-commercial use only.** Redistribution not granted. |
| `assets/mono-glyphs.json` | 120 outlines extracted from the supplied PRIXEL Mono font | Same non-commercial restriction as the font. |
| `assets/negroni-glyphs.json` | Seven glyph outlines extracted from the supplied PRIXEL Mono font for the Negroni sample | Same non-commercial restriction as the font. |
| `docs/prixel-datasheet.html` | Contains the **same font base64-embedded** in an `@font-face` data URI | Same restriction — this is a *second* copy of the font. |
| `reference/PRIXEL_Idea_Book_2024.pdf` | PRIXEL's 20-page product book | © PRIXEL Press LLC. Vendored verbatim for private reference. |
| `reference/prixel_mono_booklet_-_download.pdf` | PRIXEL Mono type specimen | © PRIXEL Press LLC. |
| `reference/PRIXEL_planning_template_-_2025_Q1.ait` | PRIXEL's Illustrator planning template | © PRIXEL Press LLC. |
| `reference/setup-plate.jpg` | PRIXEL product photograph | © PRIXEL Press LLC. |
| `assets/shapes/*.svg` (31 files) | PRIXEL's own shape artwork, from their product page | © PRIXEL Press LLC. Used here to avoid redrawing. |
| `assets/inks.json` | Colour names/codes transcribed from tsukineko.co.jp | Factual data; names are Tsukineko's. |

PRIXEL is covered by US Patent 20230264503A1.

## Before any public flip

1. Delete `reference/` entirely, and purge it from git history — it is ~13 MB of
   vendor PDFs and a product photo.
2. Delete `assets/fonts/PRIXELMono.otf` and purge from history.
3. Regenerate `docs/prixel-datasheet.html` with font embedding disabled
   (`python3 scripts/build-datasheet.py --no-embed-font`) — the committed version
   carries the font inline.
4. Decide on `assets/shapes/*.svg`. They are PRIXEL's artwork. Either seek
   permission, or replace them with your own traced equivalents.

Points 1 and 2 need history rewriting, not just a delete commit. Git does not
forget.
