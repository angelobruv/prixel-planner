# Build brief — PRIXEL planner v1

For Codex. You reviewed the plan at `docs/plan-review-request.md` and returned
**approve-with-changes**; your findings and the resolutions are appended to that
file. This is the build.

## What already exists

- `assets/catalogue.json` — canonical piece data, **verified against the vendor
  site**. Read `_provenance`, `_units` and `_naming` before trusting any field.
- `assets/shapes/*.svg` — PRIXEL's own artwork, 14.1732 user units per cell = 5mm.
- `assets/inks.json` — 85 Tsukineko VersaColor colours.
- `docs/prixel-spec.md` — the hardware contract.
- `docs/colour-system.md` — ink model (not needed for v1, but read the data model).
- Scaffold on `init`: Vite + React 19 + TS, `src/types.ts`, `src/shapes.ts`.
  **`npm install` has not been run yet.** Port 5173 is free; `npm run dev`.
- `scripts/check-consistency.py` must still pass after your changes.

## Non-negotiables (verified — do not re-derive, do not "fix")

1. Grid **24 cols × 16 rows**, 5mm pitch, print area exactly **120×80 mm**.
2. Vendor size labels are **HEIGHT × WIDTH**. A `1×4` is 4 cells wide, 1 tall.
   Use `cells_w`/`cells_h` from the JSON; never parse `size_label`.
3. **Every print is mirrored.** Design view ≠ build sheet.
4. **No `flipped` on Placement.** Per your own review: reflecting a chiral piece
   may produce an orientation the physical stamp cannot make, and that is
   unverified. Whole-plate mirroring only.
5. Corner mask is **config-driven** — read blocked cells from the grid config,
   never hardcode corner logic. The L-triomino shape is inferred from a photo
   and is explicitly unconfirmed.
6. **PX-030/031/032 have no SVG and are not in the kit.** Raising their inventory
   must not make them placeable.
7. Group the palette by **family**, not by exact hex — PX-029 is a different
   green from the other Straight Line pieces and would otherwise split into an
   eighth group.

## v1 scope

- Plate canvas: click-to-place, drag, rotate (R), delete. Snap to cell.
- Palette grouped by the 7 sort-bin families, live "n remaining" per SKU.
- Validation: collision, off-plate, blocked-cell mask, inventory exhausted.
- Mirror toggle: design view ⇄ build sheet.
- Layers — one layer = one plate = one ink pass, each with an ink colour.
- Undo/redo, JSON import/export, localStorage persistence.
- Export: SVG at true 120×80 mm, mirrored, plus a piece pick-list **outside**
  the plate area.

Keep geometry, transforms, inventory accounting and validation in plain
TypeScript functions independent of React. Add footprint-sized hit targets —
artwork hit-testing on thin line pieces will be miserable.

## Acceptance test: the Negroni card

Angelo wants to recreate this specific reference. Build toward it.

A portrait card, cream ground, stamp-perforation edge. Three flat shapes plus a
word:

- **Red** (~`#C0392B`) glass body — a rectangle whose **bottom two corners are
  rounded**. Squares/rectangles for the bulk (PX-001/002/003/004) plus quarter
  circles (PX-010 or PX-012) rotated into the two bottom corners.
- **Orange** (~`#F07E26`) — a large **solid quarter-disc**, nested top-right.
  PX-012 (2×2 quarter circle), possibly scaled up from several.
- **Yellow** (~`#F2C230`) — a quarter-circle **ring/arc**, same centre, larger
  radius, opening toward bottom-left. PX-016 (2×2 arc) or PX-017 (3×3 arc).
- **"Negroni"** — 7 characters of PRIXEL Mono, 1 cell each, bottom-left.

The red body overlaps and occludes the orange and yellow — its top edge cuts
across both.

### Why this test matters

It is **four ink passes** (red, orange, yellow, text) against **two physical
setup plates**. That forces the inventory question your review raised and which
is still open:

> If plates remain assembled together, sum their piece usage. If pieces are
> dismantled and reused between passes, required inventory is the maximum
> per-pass count for each SKU.

**Implement both, behind a setting, and label which is active in the UI and on
the build sheet.** Do not silently pick one. Default to concurrent assembly
(sum) as the conservative choice.

Also note: the design is **portrait**, the plate is landscape 24×16. The plate
rotates — handle it as a plate-level orientation, not per-piece.

## Still unverified — do not design around either as settled

- Whether a chiral piece can physically be flipped.
- Whether overprinting blends or covers (the inks are opaque pigment, so
  probably covers — untested).

## When you are done

Do not commit to `main`. Work on `init` or a branch off it, run
`scripts/check-consistency.py`, get `npm run dev` serving on 5173, and report
what you built and what you could not.
