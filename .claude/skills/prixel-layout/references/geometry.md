# Measured geometry

Everything here was measured from rendered output, not inferred from a
description. Where you need a fact that is not here, measure it the same way:
`scripts/pieces.sh --measure <SKU>`.

## Plate coordinates

- 24 x 16 cells, 5mm pitch, 120 x 80mm print area. `GRID` in `src/model.ts`.
- `col` and `row` are zero-based and name the **top-left cell of the rotated
  footprint**. Column increases right, row increases down.
- `orientation: 'landscape'` is 24 wide x 16 tall; `'portrait'` swaps them.
- Three cells per corner are blocked by magnet bosses — 372 of 384 usable.
- Vendor size labels are **height x width**, so a "1x4" is four cells wide. The
  catalogue's `cells_w` / `cells_h` are already right; only the label misleads.

## The placement transform

From `src/model.ts`, unchanged:

```
translate(col row)  then, by rotation:
  90  -> translate(h 0) rotate(90)
  180 -> translate(w h) rotate(180)
  270 -> translate(0 w) rotate(270)
```

A rotation of 90 or 270 swaps the footprint's width and height (`bounds()`).

## Quarter circles: which corner the disc hugs

Measured for `PX-010` (1x1) and `PX-012` (2x2). **Both share this mapping** —
do not assume other families follow it.

| rotation | disc centred on | thinnest corner |
|---|---|---|
| 0 | bottom-left | top-right |
| 90 | top-left | bottom-right |
| 180 | top-right | bottom-left |
| 270 | bottom-right | top-left |

Consequence worth knowing: a quarter disc **tapers to a point** at the corner
diagonally adjacent to its centre along the short edge. `PX-012` at rotation 0
is full across its bottom and left edges and narrows to a single point at the
top-left — which is why it works as a sail or shell crown.

To build a **dome** (semicircle, flat side down) spanning two cells, the centre
of the circle sits at the midpoint of the shared bottom edge, so:

- left cell: centre at *its* bottom-right -> rotation **270**
- right cell: centre at *its* bottom-left -> rotation **0**

Inverted quarter circles (`PX-013`, `PX-015`) are the complement — the square
minus that disc. They are the carving tool: overprinted in a darker ink they
read as biting a curve out of the mass beneath.

## Line pieces sit on a cell edge

A line piece's stroke runs along one edge of its footprint, roughly 1mm wide,
not through the cell's middle. So the footprint is offset from where the ink
lands, and two strokes that would cross need the same cell — impossible.

`PX-020` (4x1 straight line) draws on the **top** edge at rotation 0:

| rotation | footprint | stroke lands on |
|---|---|---|
| 0 | 4 wide x 1 tall | top edge |
| 90 | 1 wide x 4 tall | right edge of the column |
| 270 | 1 wide x 4 tall | left edge of the column |

## Curve lines chain end to end

`PX-028` (2x2 quarter circle line) is the one place the kit gives a genuinely
continuous curve, because the strokes butt together at cell corners.

| rotation | enters | leaves |
|---|---|---|
| 0 | top-left, horizontal | bottom-right, vertical |
| 90 | bottom-left, horizontal | top-right, vertical |
| 180 | top-left, vertical | bottom-right, horizontal |
| 270 | bottom-left, vertical | top-right, horizontal |

`PX-023` (2x2 diagonal line) is a 45-degree stroke corner to corner: rotations
0 and 180 both draw `\`, rotations 90 and 270 both draw `/`.

A shell outline that lands cleanly on a baseline: vertical flank, then
`PX-028` at 270 (enters vertical, leaves horizontal), then `PX-023` at 0
chained down two cells per two cells.

## Arcs are annuli, not fills

`PX-016` (2x2), `PX-017` (3x3), `PX-033` and `PX-034` (3x2) are thick curved
**bands**, not filled wedges. Nesting them to make concentric ribs is
physically impossible on one plate: the smaller one's footprint sits inside the
larger one's, even though the inked areas do not touch. Ribs need one pass each.

## What the kit holds

Solid-fill ceiling is **120 cells, 31% of the plate** — that is every
square-family piece at once.

| | 1x1 | 2x1 | 2x2 | 4x1 | other |
|---|---|---|---|---|---|
| Square | `PX-001` 16 | `PX-002` 12 | `PX-003` 8 | `PX-004` 12 | |
| Circle & Arc | `PX-010` 16 | `PX-011` 6 | `PX-012` 8 | | `PX-016` 12, `PX-017` 6 (3x3), `PX-033` 6, `PX-034` 2 |
| Inverted Circle | `PX-013` 16 | `PX-014` 6 | `PX-015` 8 | | |
| Triangle | `PX-005` 16 | `PX-006` 6 | `PX-007` 8 | | |
| Straight Line | `PX-018` 16, `PX-029` 16 | `PX-019` 12 | | `PX-020` 12 | |
| Circle & Arc Line | `PX-026` 16, `PX-024` 12 | `PX-027` 6 | `PX-028` 8, `PX-025` 6 | | |
| Diagonal Line | `PX-021` 16 | `PX-022` 6 | `PX-023` 8 | | |
| Circles | `PX-008` 12 | | `PX-009` 6 | | |

`PX-030`, `PX-031`, `PX-032` exist in the catalogue but the kit ships none.

The scarce pieces are the 2x2s — eight each. That, not plate area, is usually
what stops a design.

## Piece colour is not ink colour

Each piece carries a `fill` — the colour its rubber is moulded in, which is how
the kit is sorted in the box (Square yellow, Triangle red, Circle & Arc blue,
and so on). It has nothing to do with the ink a pass prints in. `binHex(sku)`
in `src/model.ts` returns it, and the app's build-sheet view can paint the
plate in these colours so the physical pieces can be found.

## Vendor SVG units

14.1732 units per cell; every piece is inset 0.2835 units from its cell edge, so
touching pieces leave a 0.2mm channel. That channel is what shows as a hairline
seam in renders, and what a merge script has to close.
