# Third-party material

The code in this repository is MIT-licensed (see `LICENSE`). Some of what the
planner draws belongs to other people, and is used as described here.

| What | Owner | How it is used |
|---|---|---|
| `assets/shapes/*.svg` — the 31 piece outlines | © PRIXEL Press LLC | PRIXEL's own artwork, taken from their product page and included with PRIXEL's permission (September 2026). Not covered by the MIT licence. |
| PRIXEL Mono typeface | © Otherwhere Collective and PRIXEL Press | **Not stored in this repository.** Its licence excludes storing it on public servers. `scripts/build-mono-glyphs.mjs` downloads it from PRIXEL's own store at build time and generates `assets/mono-glyphs.json` locally, which git ignores. |
| `assets/mono-glyphs.meta.json` | This project | Character names, case groups and accent rules for the Mono pieces. No font outlines. |
| `assets/inks.json` | Colour names are Tsukineko's | Factual data transcribed from tsukineko.co.jp. |
| PRIXEL, PRIXEL Mono | Trademarks of PRIXEL Press LLC | Used to say what this planner is for. |

PRIXEL is covered by US Patent 20230264503A1.

## If you deploy it

A build contains `mono-glyphs.json`, which is generated from PRIXEL Mono, so a
public deployment would be storing font data on a public server. `server.mjs`
puts the app behind a password (`SITE_PASSWORD`); keep it there, or run the
planner locally.
