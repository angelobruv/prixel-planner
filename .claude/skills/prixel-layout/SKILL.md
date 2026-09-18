---
name: prixel-layout
description: Design a PRIXEL modular rubber-stamp layout — turn a subject (a building, a cocktail, a logo, a wordmark) into piece placements on the 24x16 plate, or rebuild an existing design from a screenshot. Use this whenever the user wants to make something with the PRIXEL kit, asks "what would X look like", hands over a reference image to convert, mentions stamps, plates, passes, inks, or piece codes like PX-012, or wants an existing project JSON changed. Also use it before answering any question about what the kit can and cannot draw — the piece geometry is counter-intuitive and guessing it wastes the user's time.
---

# Designing a PRIXEL layout

The kit is 316 rubber pieces on a 24x16 magnetic plate, 5mm pitch, 120x80mm of
print. You compose a design as **passes** — one plate setup per ink colour — and
the planner app in this repo validates and renders them.

The whole difficulty of this job is that the kit's shape vocabulary is small and
its curves are tiny. Designs that look obvious on paper are often impossible, and
the moves that actually work are not the ones you would guess. What follows is
what has been learned the expensive way.

## Do not reason about piece shapes — measure them

A piece's description tells you almost nothing useful. "Quarter circle" does not
say which corner the disc is centred on; "straight line" does not say which edge
the stroke sits on. Both have been guessed wrong repeatedly, including from
looking at thumbnails, and each wrong guess costs a full build-and-render cycle.

Before using an unfamiliar piece, look at it:

```bash
.claude/skills/prixel-layout/scripts/pieces.sh              # every piece, 4 rotations
.claude/skills/prixel-layout/scripts/pieces.sh --measure PX-012   # + which corner is solid
```

`--measure` prints the answer as text rather than making you read a picture,
which is the reliable way. `references/geometry.md` has the mapping that has
already been measured — start there, and measure anything it does not cover.

## The method

### 1. Read the subject as masses and edges, not as an outline

The instinct is to trace a silhouette. That fails, because the silhouette's
curve is usually bigger than any curve the kit owns. Instead, separate:

- **mass** — the areas of flat colour, which tile from squares and rectangles
- **edge** — the contour that makes it recognisable, which is a different job

### 2. Put the edge in a separate pass, printed over the mass

This is the move that unlocks the kit, and it is not obvious.

Fill the mass **roughly** — rectangles are fine, the boundary does not have to be
right. Then add a second pass in a darker ink whose only job is to carve the
contour, using **inverted quarter circles** (`PX-013`, `PX-015`) and line pieces
laid over the fill. The dark piece reads as *removing* a curve from the shape
beneath it.

Why this matters: a fill piece's own boundary can only curve at radius 5mm or
10mm. An overprinted edge is not limited that way, because the eye reads the
composite, and you can place the carving piece anywhere relative to the mass.
A curve that is impossible as a fill boundary becomes easy as an overprint.

The Sydney Opera House in `references/worked-examples.md` is exactly this: three
attempts that tried to make the fill's boundary be the curve all failed, and the
version that worked used cream shell bodies with a charcoal carving pass on top.

### 3. Choose the paper before fighting the ink

If a colour will not read, change the paper rather than hunting for a stronger
ink. White shells are invisible on cream paper and obvious on white. The paper
colour is a field on the design (`design.paperColor`) and costs nothing.

### 4. Let repetition do the work the curve cannot

A row of quarter circles reads as scalloped water. A row of small triangles reads
as steps. Rhythm carries meaning that a single accurate shape cannot, and it is
cheap — the kit holds 16 of most 1x1 pieces.

## Constraints that will bite

**Curves stop at 10mm.** The largest arc is a 2-cell quarter circle. There is
nothing between that and a straight edge, so any curve wider than two cells is
either faceted (small arcs plus 45-degree diagonals chained together) or carved
by overprint. Do not plan a smooth 6-cell dome; it does not exist.

**No two pieces may hold the same cell in one pass.** This bites hardest with
outlines: two shells whose strokes cross cannot both live on one plate, and
neither can nested concentric arcs, because their *footprints* overlap even
though their ink does not. Overlapping forms need separate passes.

**Line pieces draw on a cell edge, not through the middle.** A stroke sits on one
edge of its footprint, so the footprint is offset from where the line appears.
Two strokes that need to cross would need the same cell — physically impossible.

**Inventory is the real budget.** Solid fill is capped at about 120 cells, 31% of
the plate, because that is every square-family piece in the kit. The scarce
pieces are the big ones: 8 each of `PX-003`, `PX-007`, `PX-012`, `PX-015`,
`PX-023`, `PX-028`. A design needing nine 2x2 quarter circles cannot be built.

**Vendor size labels are height x width.** A "1x4" is four cells *wide*. The
catalogue's `cells_w`/`cells_h` are already correct; the label is the trap.

**Corner cells are blocked.** Three per corner, taken by the magnet bosses.

## The loop

Write the project JSON, then render it. Never ship a layout you have not looked
at — every layout in this repo's history that was reasoned about but not rendered
was wrong in some way that a single screenshot would have caught.

```bash
.claude/skills/prixel-layout/scripts/preview.sh design.json out.png
```

That starts the dev server if needed, imports the project, reports validation
errors and inventory shortfalls, and screenshots the plate. Read the PNG back
and judge it. Then adjust and repeat — expect three or four rounds; the first
attempt at a new subject is usually a good diagnosis of what is wrong rather
than a good design.

Generate the JSON however suits the task. A throwaway vitest file in `tests/`
is convenient because it can import the app's own `blankProject`, `validate`
and `requiredInventory` — see the worked examples. Delete it afterwards; these
generators are scaffolding, not tests, and `vitest.config.ts` only picks up
`tests/**/*.test.ts`.

## Rebuilding a design from an image

When the user hands over a screenshot — a lost project, or someone else's work —
measure it rather than estimating:

```bash
python3 .claude/skills/prixel-layout/scripts/trace.py shot.png            # grid visible
python3 .claude/skills/prixel-layout/scripts/trace.py shot.png --cells 24x16   # grid off
```

It finds the cell pitch and reports every ink blob's extent in cells, which
converts directly into placements. Two cautions: a blob is the union of touching
same-colour pieces, so a 2-wide blob may be one 2x1 or two 1x1s — the ~0.1 cell
seam between pieces is the tell. And bounding boxes cannot distinguish a dome
from an upside-down dome, so confirm curve direction by rendering your rebuild
and comparing, not by matching extents.

## Inks

`assets/inks.json` holds all 85 VersaColor colours with vendor hex values;
`assets/owned-inks.json` is what the user actually has. Match a target colour
against the owned list first — a design needing an unowned ink is a shopping
list, not a plan. Set both `ink` (hex) and `inkSku` on each layer; an empty
`inkSku` fails import with "Invalid ink SKU".

Bronze (`VS-000-094`) is oil-based, unlike the rest of the range. It needs its
own drying time before another pass prints over it — worth saying out loud when
a design stacks a pass on top of Bronze.

## Reference

- `references/geometry.md` — measured rotation and orientation facts, the
  placement transform, piece inventory, plate coordinates. Read before placing
  arcs or line pieces.
- `references/worked-examples.md` — the Opera House (three failures and the fix)
  and the Amaretto Sour (rebuilding from a screenshot). Read when starting a new
  subject; the failure modes repeat.
