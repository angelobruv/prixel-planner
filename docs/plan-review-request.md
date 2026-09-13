Requesting your approval (or pushback) before I write any implementation code.

You're in the same worktree: /Users/angelo/orca/workspaces/prixel-planner/init @ 1cbd7e4.
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
