Requesting your approval (or pushback) before I write any implementation code.

You're in the same checkout @ 1cbd7e4.
Read docs/prixel-spec.md and assets/catalogue.json first — that's the contract.

## Goal
A planner for the PRIXEL modular rubber-stamp kit. You compose on a virtual
24x16 grid, it tells you whether the design is buildable with the pieces you
actually own, and it prints a mirrored build sheet you work from at the press.

## Hard constraints (already verified, do not re-derive)
1. Grid 24x16 cells, 5mm pitch, print area exactly 120x80mm.
2. 3 holes removed at each corner (magnet boss) -> 372 of 384 cells usable.
   Exact cut shape is INFERRED as an L-triomino from a product photo. Unconfirmed.
3. Vendor size labels are HEIGHT x WIDTH. A "1x4" is 4 cells wide, 1 tall.
   Verified against all 31 shipped SVG viewBoxes. Highest-risk gotcha in the repo.
4. Every print is the mirror of the plate layout. Design view != build sheet.
5. Finite inventory: 316 pieces / 31 SKUs in the kit (site headline says 310 —
   its own spec table sums to 316). Counts must be user-editable.
6. Vendor SVGs in assets/shapes/ are authored at 5mm/cell, 14.1732 units/cell.
   Scale by 5/14.1732 to work in mm. Do not redraw them.

## Proposed data model
  Design  { id, name, cols: 24, rows: 16, layers: Layer[] }
  Layer   { id, name, inkColor, placements: Placement[] }   // one layer = one plate = one ink pass
  Placement { sku: "PX-017", col, row, rotation: 0|90|180|270, flipped: boolean }
  Inventory { [sku]: number }   // seeded from catalogue.json qty_in_kit, editable

Placements store {sku, cell, rotation} — never a pre-rotated sprite variant.
Most pieces are used in 4 orientations and several are chiral, so the real
placement vocabulary is far bigger than 34.

## Proposed stack
Vite + TypeScript + React, SVG rendering (not canvas — 384 cells is nothing,
and SVG gives free hit-testing plus a native export path). Local-only,
localStorage persistence. No backend.

## v1 scope
- Plate canvas: click-to-place, drag, rotate (R), delete. Snap to cell.
- Palette grouped by the 7 sort-bin colours, with live "n remaining" per SKU.
- Occupancy check: collision + off-plate + corner-cutout mask.
- Mirror toggle: design view <-> build sheet.
- Layers for multi-colour (both plates overlay through the clear press).
- Export: SVG/PDF at true 120x80mm, mirrored, with a piece pick-list.

## Explicitly out of v1
Image-to-design auto-tracing, PRIXEL Mono text tool, 45-degree press rotation,
sharing/multiplayer.

## What I want you to rule on
a) Data model — anything that will hurt once layers and rotation land?
b) React vs vanilla TS for something this small. I lean React; talk me out of it.
c) Is the L-triomino corner assumption safe to build on, or should the mask be
   config-driven until Angelo measures the real plate?
d) Anything in v1 scope you'd cut, or anything out-of-scope you'd pull forward?

Reply with approve / approve-with-changes / reject + reasoning. I won't start
until you answer.

---

# Verdict and decisions

Reviewed by Codex (gpt-6-astra) on 2026-09-13 against commit `1cbd7e4`.
**Result: approve-with-changes.** Stack and scope sound; the gaps were all in
"can this design actually be assembled". Its findings and what we settled:

## Accepted — data model

- **Drop `flipped` as a user operation.** Reflecting a chiral piece may produce
  an orientation the physical stamp cannot make, and nothing establishes that
  pieces can be flipped. Whole-plate mirroring stays, as a view/export transform
  only. ❓ Still open: **can a chiral piece physically be flipped?** A 1×1 right
  triangle settles it. Also unresolved: do the vendor SVGs depict the stamp face
  or the printed impression?
- **Physical footprint ≠ ink geometry.** An SVG bounding box does not establish
  where a neighbouring piece's stud fits, and neither does the empty space inside
  a hollow shape. Model footprints explicitly; a rectangular default is
  provisional and needs measuring.
- **Add placement IDs and a persistence schema version.** Stable IDs for
  selection, dragging and undo; versioning so saved designs survive model changes.
- **Define coordinate and rotation semantics explicitly** — zero-based, anchor at
  the top-left of the rotated bounding box, clockwise quarter-turns. Use
  `cells_w`/`cells_h`; never parse the vendor size labels.
- **Inventory across layers is undefined.** Collisions are per-plate; overlapping
  artwork across passes is legal. If both plates stay assembled, sum usage; if
  pieces are dismantled and reused between passes, take the max per pass.
  ❓ **Angelo's call** — concurrent assembly is the conservative default.
- **Versioned plate profile** (dimensions, pitch, blocked cells) that revalidates
  saved designs when it changes.

Two catalogue details Codex caught, both since handled in `assets/catalogue.json`:
PX-030–032 have no SVGs, so raising their inventory must not silently make them
placeable; and PX-029 has a different green fill from the other Straight Line
pieces, so grouping by exact colour yields eight groups — group by family, not hex.

## Accepted — the rest

- **React stays**, justified by interdependent UI state rather than grid size.
  Geometry, transforms, inventory accounting and validation live in plain
  TypeScript outside React. Add footprint-sized hit targets — artwork
  hit-testing on thin pieces will be miserable.
- **Corner mask is config-driven**, shipping the L-triomino as a provisional
  profile with the assumption labelled in validation and on build sheets.
  Blocked coordinates are stored explicitly, not derived by corner logic.
- **Scope:** v1 as proposed, all four exclusions held. Added undo/redo and JSON
  import/export. PDF generation dropped in favour of a print layout plus
  browser Save-as-PDF; standalone SVG export kept. Plate stays exactly
  120×80 mm with the pick-list outside it; one sheet per pass; orientation
  marker, calibration ruler and actual-size instruction included.

## Added since the review

The colour system did not exist when Codex reviewed this. See
`docs/colour-system.md`. It introduces two entities the reviewed model lacks —
`Ink` (stock or custom, with a recipe in parts) and `Swatch` (a measured
printed colour with a keep/discard verdict) — and adds a measured `paperColor`
to both the design and every swatch, because the colour model had quietly
assumed white paper.

**Not re-reviewed.** The inventory question above now has a colour dimension too.
