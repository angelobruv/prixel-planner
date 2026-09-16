# PRIXEL — hardware spec (source of truth for the planner)

Everything below is scraped from prixel.com (Sept 2026) plus the official Idea Book PDF,
the Illustrator planning template, and the shipped `PRIXELMono.otf`. Local copies live in
`reference/`; machine-readable piece data in `assets/catalogue.json`.

## The grid

| Property | Value |
|---|---|
| Setup plate work area | **24 × 16 cells** (landscape; 16 × 24 portrait) |
| Cell pitch | **5 mm** (≈ 1/5") — pitch is both x and y |
| Effective printing area | **120 × 80 mm** (4.75" × 3.125") — 24×5 by 16×5 exactly |
| Press outer size | 6" × 4" — ⚠️ vendor says "(17cm × 10cm)" but 6×4" is 15.2×10.2 cm. Their two units disagree; measure before relying on either. |
| Corner holes | 3 holes removed at **each** corner (magnet boss) → **372 usable cells** of 384 |
| Target stock | 4×6" card (A2 US / A6 elsewhere) |
| Patent | US 20230264503A1 |

Confirmed independently: the official Illustrator template `.ait` has MediaBox
`340.157 × 226.772 pt` = **120.00 × 80.00 mm**.

### Two rules the planner must enforce

1. **Every print is mirrored.** The plate layout is the mirror image of the printed result.
   The app should have a canonical "design" view and a "setup (mirrored)" view, and export
   the mirrored one as the build sheet.
2. **Inventory is finite.** A design is only buildable if it fits the piece counts below.
   Live "pieces remaining" is the single most useful thing a planner does that paper can't.

The press can also be **rotated 45°** on the paper for off-grid compositions, and both
setup plates can be overlaid for **multi-colour registration** — worth modelling as layers.

## Piece catalogue

34 distinct SKUs exist (`PX-001`…`PX-034`), sold individually as $5 expansion packs
(16–32 pieces each). The $139 kit ships **31 of the 34**. Missing from the kit:
`PX-030` 1×1 half round square, `PX-031` 1×1 isosceles triangle, `PX-032` 2×2 isosceles triangle.

⚠️ **Count discrepancy:** the site headline says "310 pieces of shape type" but its own
spec table sums to **316**. Treat 316 as the table truth, make counts user-editable.

Size labels are **height × width** in cells — a `1×4` is 4 cells wide and 1 tall.
Verified against the viewBox of all 31 shipped SVGs.

| SKU | Cells (H×W) | Description | Qty in kit | Colour |
|---|---|---|---|---|
| PX-001 | 1×1 | square | 16 | `#fcee21` yellow |
| PX-002 | 1×2 | rectangle | 12 | `#fcee21` yellow |
| PX-003 | 2×2 | square | 8 | `#fcee21` yellow |
| PX-004 | 1×4 | rectangle | 12 | `#fcee21` yellow |
| PX-005 | 1×1 | right triangle | 16 | `#ff1d25` red |
| PX-006 | 1×2 | right triangle | 6 | `#ff1d25` red |
| PX-007 | 2×2 | right triangle | 8 | `#ff1d25` red |
| PX-008 | 1×1 | circle | 12 | `#3fa9f5` blue |
| PX-009 | 2×2 | circle | 6 | `#3fa9f5` blue |
| PX-010 | 1×1 | quarter circle | 16 | `#3fa9f5` blue |
| PX-011 | 1×2 | half circle | 6 | `#3fa9f5` blue |
| PX-012 | 2×2 | quarter circle | 8 | `#3fa9f5` blue |
| PX-013 | 1×1 | inverted quarter circle | 16 | `#99d9e8` light blue |
| PX-014 | 1×2 | inverted half circle | 6 | `#99d9e8` light blue |
| PX-015 | 2×2 | inverted quarter circle | 8 | `#99d9e8` light blue |
| PX-016 | 2×2 | arc | 12 | `#3fa9f5` blue |
| PX-017 | 3×3 | arc | 6 | `#3fa9f5` blue |
| PX-018 | 1×1 | straight line | 16 | `#7ac943` green |
| PX-019 | 1×2 | straight line | 12 | `#7ac943` green |
| PX-020 | 1×4 | straight line | 12 | `#7ac943` green |
| PX-021 | 1×1 | diagonal line | 16 | `#459261` dark green |
| PX-022 | 1×2 | diagonal line (chevron) | 6 | `#459261` dark green |
| PX-023 | 2×2 | diagonal line | 8 | `#459261` dark green |
| PX-024 | 1×1 | circle line | 12 | `#a0c75e` light green |
| PX-025 | 2×2 | circle line | 6 | `#a0c75e` light green |
| PX-026 | 1×1 | quarter circle line | 16 | `#a0c75e` light green |
| PX-027 | 1×2 | half circle line | 6 | `#a0c75e` light green |
| PX-028 | 2×2 | quarter circle line | 8 | `#a0c75e` light green |
| PX-029 | 1×1 | straight line corner | 16 | `#7ebe5e` green |
| PX-030 | 1×1 | half round square | — | not in kit |
| PX-031 | 1×1 | isosceles triangle | — | not in kit |
| PX-032 | 2×2 | isosceles triangle | — | not in kit |
| PX-033 | 2×3 | arc "U" | 6 | `#3fa9f5` blue |
| PX-034 | 2×3 | arc "Y" | 2 | `#3fa9f5` blue |

Colour is the physical sort-bin coding, grouped in the Idea Book as: **Square** (yellow),
**Triangle** (red), **Circle & Arc** (blue), **Inverted Circle** (light blue),
**Straight Line** (green), **Circle & Arc Line** (light green), **Diagonal Line** (dark green).

**Vector geometry:** the 31 kit shapes are in `assets/shapes/` as the vendor's own SVGs,
already authored at real scale — `width="5mm"`, `viewBox="0 0 14.1732 14.1732"` per cell
(14.1732 pt = 5 mm). Drop them straight into the planner; no redrawing needed.

## PRIXEL Mono (the font set)

- Physical set: **324 stated pieces, 323 counted** across 56 physical pools in
  `assets/mono-case.json`, transcribed from the specimen booklet's INVENTORY page.
  Counts are editable; the one-piece discrepancy remains unresolved.
- `assets/mono-glyphs.json` supplies 120 outlines in the same coordinate space as
  shapes: 14.1732 units per 5 mm cell, y down, origin at the cell top-left.
  Every physical piece occupies one cell. Seventeen outlines are digital-only
  (`printable:false`) and must be refused for physical composition.
- The font is **unicase**: all 26 lowercase outlines match their capitals.
  Inventory follows `case_group`, not codepoint. C/U, H/I, M/W, N/Z, O/0, 6/9,
  quotes, colon/diaeresis, parentheses and rotated arrows share physical pools.
  MINIMUM consumes three M/W pieces, two H/I, one N/Z and one C/U.
- Diacritics occupy the cell above the letter. Grave, circumflex and tilde each
  have two pieces. Diaeresis uses the colon pool. There is no acute piece:
  U+2019 is a four-piece shared quote-pool substitute, printing noticeably high
  at 4.1 mm above the letter versus 2.0 mm for grave. Ç/ç is a dedicated piece.
- Text layout is limited to 24 columns and 16 rows including accent rows, with
  actual visible plate bounds also enforced. Spaces consume cells but no pieces.
- Digital `.otf` in `assets/fonts/PRIXELMono.otf` is retained as reference;
  physical availability and layout follow the supplied glyph and case JSONs.
- Designed with Andrew Bellamy / Otherwhere Collective. **Licence: non-commercial use only.**

## Local reference files

| File | What |
|---|---|
| `reference/PRIXEL_Idea_Book_2024.pdf` | 20-page official book — technique, colour groups, examples |
| `reference/prixel_mono_booklet_-_download.pdf` | Mono type specimen + design rationale |
| `reference/PRIXEL_planning_template_-_2025_Q1.ait` | Official Illustrator template (120×80 mm artboard) |
| `reference/setup-plate.jpg` | Photo of the plate — shows corner magnet bosses |
| `assets/catalogue.json` | Machine-readable: grid + all 34 SKUs, cell dims, mm dims, qty, fill |

Other planning templates exist but aren't vendored here:
[Figma](https://www.figma.com/community/file/1316133950812236867) (Attila Kömény),
Procreate (つか / レゴ版画).

## Open questions

- Exact corner cut-out shape — "3 holes per corner" is the vendor's wording; the plate photo
  reads as an L-triomino at each corner. Measure the real plate before locking the mask.
- The 323 counted vs 324 stated Mono pieces.
- Whether 310 or 316 is the true kit count.

Sources: [kit](https://prixel.com/products/the-prixel-printing-kit) ·
[help](https://prixel.com/pages/help) · [expansion packs](https://prixel.com/products/expansion-packs) ·
[Mono](https://prixel.com/products/prixel-mono) · [setup plates](https://prixel.com/products/ps-002-prixel-setup-plates)
