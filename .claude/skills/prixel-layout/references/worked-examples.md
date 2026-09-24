# Worked examples

Two subjects, both real. The Opera House is the case for the overprint method;
the Amaretto Sour is the case for measuring a reference instead of estimating it.

## Sydney Opera House

### Three attempts that failed, and why

**Narrow filled sails.** One 2x2 quarter circle per shell, solid body beneath,
podium line under that. It rendered as a **bar chart** — seven vertical columns
with rounded hats. The failure is structural: a two-cell-wide column whose top
two cells are curved reads as a vertical with a cap, because the curve is a
small fraction of the shape's perimeter. Curvature has to be a property of the
whole form, not a decoration on its end.

**Broad filled shells.** Widened so they overlap, with 2x2 right triangles
carrying the long tails down and a quarter circle only at each crown. Better —
recognisably a roofline — but every rectangle in the fill was visible, so it
read as masonry rather than a thin shell, and it consumed all eight `PX-003`.

**Pure outline.** Each shell one continuous stroke: vertical flank, `PX-028` at
270 for the crown, `PX-023` diagonals chained to the podium. Clean, one pass,
23 pieces. But the tails are dead-straight 45 degrees, and the shells cannot
overlap, because two strokes crossing would need the same cell. The real
building's nesting was unreachable.

All three share one mistake: **trying to make the fill's own boundary be the
curve.** With a 10mm maximum radius that is a dead end.

### What worked

Four passes on **white** paper:

| pass | ink | pieces | doing |
|---|---|---|---|
| 1 | Bronze 094 | 13 | podium and steps — rectangles and triangles |
| 2 | Bisque 182 | 13 | shell bodies, filled roughly |
| 3 | Lapislazuli 158 | 11 | water — a row of quarter circles read as scallops |
| 4 | Charcoal 174 | 21 | **the edges**, carving the shells |

58 pieces. The fourth pass is the whole idea: ten `PX-013` inverted quarter
circles plus `PX-015`, `PX-026`, `PX-028`, `PX-018` and `PX-019`, printed over
the cream bodies purely to cut their contour. The shells' curves do not exist in
pass 2 at all — pass 2 is approximately rectangular. The curve is made by what
is printed on top of it.

Two other decisions carry real weight. The paper was changed from cream to
**white**, which is what let pale Bisque read as a white shell — the alternative,
hunting for an ink that survives cream, has no answer. And the water is repetition
rather than accuracy: quarter circles in a row, which the eye takes as waves.

Tightest pieces: `PX-012` 6 of 8, `PX-013` 13 of 16. About one more shell of
headroom. Bronze being oil-based, pass 1 needs to dry before pass 4 lands on it.

## Amaretto Sour — rebuilding from a screenshot

A finished design existed only as an image. Rebuilt by measurement:

1. `trace.py` found the grid pitch (46.5 px/cell) and reported each blob's
   extent in cells.
2. Blob extents gave the placements directly — a 2.0-wide blob at col 4 row 6 is
   a `PX-002`; two 0.95-wide blobs either side of a cell boundary are two 1x1s,
   not one 2x1.
3. The five ink colours matched owned VersaColor inks within ΔRGB 4.5 — Canary
   011, Orange 013, Scarlet 014, Black 082, Charcoal 174 — which confirmed it had
   been made in the planner rather than drawn elsewhere.
4. Rebuilt, re-imported, re-traced, and the two blob maps compared.

**The check that was not sufficient.** Comparing bounding boxes proved position
but *not curve direction*: two quarter circles forming a dome and the same two
forming a bowl occupy identical boxes. When rebuilding, confirm orientation by
looking at the render, or with `pieces.sh --measure`, which tests points against
the piece geometry itself — not by matching extents.

The garnishes were the interesting detail: each is **two quarter circles** split
on a cell boundary, not one `PX-011` half circle. The seam in the reference is
what gives it away, and it is a one-pixel-wide tell at that scale.
