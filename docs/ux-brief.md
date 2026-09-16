# UX brief — direct manipulation

**Status: for review, not for build.** Read it, push back, flag what it misses.

Written against the working tree (uncommitted), not the last commit. If any of
the evidence below is already stale, say so — that is itself a useful finding.

## The complaint, in the user's words

> "the click and rotate and click again feels a bit clunky"
> "i want to be able to do select and move, and copy/paste as well"

## What is actually there

Drag-to-move already works, for single pieces and for groups (`App.tsx`
pointer handlers, `drag.current` / `groupDrag.current`). So "select and move"
is half-built. The real gaps are narrower than the complaint suggests.

### 1. `rotate()` is one key with four behaviours

```
floating group      -> rotates the group           needs Enter to commit
multi-selection     -> CONVERTS to floating group  needs Enter to commit
single selection    -> rotates in place            immediate
nothing selected    -> sets pending rotation       no visible target
```

This is the clunk. The same key sometimes acts immediately and sometimes drops
you into an uncommitted mode. Worse, rotating a multi-selection silently turns
a committed thing into a pending thing — the user did not ask to enter a mode.

The fourth case is a different concept wearing the same key: it is not rotating
anything, it is pre-setting an attribute of the *next* placement.

### 2. No marquee selection

Multi-select is `Shift`+`Enter` on the keyboard cursor, one piece at a time.
There is no drag-a-box-around-things. For a 45-piece composition that is the
difference between a gesture and a chore.

### 3. No clipboard at all

`grep` finds no copy, paste, or clipboard handling anywhere in `src/`. For a
design made of repeated motifs — a row of glasses, a border pattern — this is
the single biggest multiplier missing.

## Proposed model

### Rotation becomes non-modal

**R always rotates the current thing, in place, committed.** No mode change, no
Enter. A multi-selection rotates about its own bounding-box centre and stays
committed, exactly as a single piece does today.

Rotation-before-placement stops sharing the key. It belongs to the palette as a
visible control showing the orientation the next piece will land in — a small
preview that itself responds to R while the palette has focus. The user should
never press R and have to guess which of four things happened.

Open question for you: is there a case where rotating a committed selection
*should* become pending? I do not think so, but you have the failure modes.

### Marquee selection

- Drag on empty plate → rubber-band box; anything whose footprint intersects it
  is selected on release.
- `Shift`+drag → add to selection rather than replace.
- Click empty plate → clear selection.
- Keep `Shift`+`Enter` and `Cmd`+`A` as they are.

Intersect, not contain: on a 24×16 grid, requiring full containment makes the
gesture fussy at the edges.

### Copy and paste

- `Cmd`/`Ctrl`+`C` — copy the selection, normalised to its own bounding box, so
  the source coordinates stop mattering.
- `Cmd`/`Ctrl`+`V` — paste as a **floating group**, positioned and committed with
  the machinery `importGroup` already provides. Paste is import with a different
  source; it should not be a second code path.
- `Cmd`/`Ctrl`+`D` — duplicate in place, offset one cell down-right, landing
  selected so it can be nudged immediately.
- Paste targets the **active pass**, so copying a motif and pasting it into a
  different ink is how a two-colour repeat gets made. That is a feature, not a
  side effect — but it means paste must re-validate inventory against the target
  pass, not the source.

Clipboard should be in-app state, not the system clipboard — the payload is
placements, not text, and a system-clipboard round trip invites malformed input
through a path that `parseProject` does not guard.

## What must not regress

- Every existing validation still applies on commit: overlap within a pass,
  blocked corner cells, plate bounds, inventory under the active mode.
- No `flipped`. Rotation stays quarter-turns only.
- Undo must treat a paste, a marquee-rotate, and a duplicate each as **one**
  history entry, not one per piece.
- Accented text: a glyph's accent lives in the cell above it. If a selection
  splits a letter from its accent, copying or moving it must either carry both
  or refuse. I do not know what the text tool currently does here — this may be
  the sharpest edge in the whole brief.

## Deliberately out of scope

Freehand rotation, flipping, scaling, layer reordering, and multi-plate
selection. All of them are either physically impossible or a bigger argument.

## What I want from you

1. Does the non-modal rotation break a case I have not seen?
2. Is marquee-on-empty-drag free, or does empty-drag already do something?
3. Is paste-as-floating-group actually reusable, or does `importGroup` assume a
   cross-design source in a way that makes this awkward?
4. The accent/letter splitting question above — what happens today?
5. Anything here that is already built and I have missed.
