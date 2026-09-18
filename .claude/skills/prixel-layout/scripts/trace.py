#!/usr/bin/env python3
"""Map a reference image onto the 5mm cell grid.

For rebuilding a lost project from a screenshot, or converting someone else's
artwork. Finds the grid pitch from the faint rules a planner screenshot already
carries, then reports each ink blob's extent in CELLS — which is what you need
in order to write placements, and what eyeballing a screenshot will not give you.

    trace.py shot.png
    trace.py shot.png --pitch 46.5 --origin 11.5,6.5

Needs pillow, numpy and scipy.
"""
import argparse
import collections
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('image')
ap.add_argument('--pitch', type=float, help='pixels per cell, if auto-detect misses')
ap.add_argument('--origin', help='x,y pixel of the top-left grid corner')
ap.add_argument('--cells', help='COLSxROWS the image spans, e.g. 24x16 for a whole plate; '
                               'use when the screenshot has the grid switched off')
ap.add_argument('--min-area', type=int, default=60, help='ignore blobs smaller than this')
a = ap.parse_args()

im = np.asarray(Image.open(a.image).convert('RGB')).astype(int)
H, W, _ = im.shape
paper = np.array(collections.Counter(map(tuple, im.reshape(-1, 3))).most_common(1)[0][0])
print(f"paper  #{paper[0]:02x}{paper[1]:02x}{paper[2]:02x}   image {W}x{H}")


def rules(profile, base):
    """Centres of the runs of pixels darker than the paper — the grid lines."""
    idx = [i for i, v in enumerate(profile) if v < base - 1.0]
    if not idx:
        return []
    out, cur = [], [idx[0]]
    for v in idx[1:]:
        if v == cur[-1] + 1:
            cur.append(v)
        else:
            out.append(sum(cur) / len(cur))
            cur = [v]
    out.append(sum(cur) / len(cur))
    return out


if a.pitch:
    S = a.pitch
    X0, Y0 = (float(v) for v in a.origin.split(',')) if a.origin else (0.0, 0.0)
elif a.cells:
    S = W / float(a.cells.lower().split('x')[0])
    X0 = Y0 = 0.0
else:
    band = im[:max(1, H // 8), :, :].mean(axis=2).mean(axis=0)
    xs = rules(band, float(np.median(band)))
    gaps = [xs[i + 1] - xs[i] for i in range(len(xs) - 1)]
    wide = [g for g in gaps if g > 8]
    # A plate is at least 16 cells across, so a handful of rules means we found
    # something else — a border, or a screenshot taken with the grid switched off.
    if len(wide) < 6:
        sys.exit("no grid lines found. Either re-shoot with the grid on, or pass "
                 "--cells 24x16 (whole plate) or --pitch/--origin.")
    S = float(np.median(wide))
    X0 = xs[0] % S
    side = im[:, -max(1, W // 5):, :].mean(axis=2).mean(axis=1)
    ys = rules(side, float(np.median(side)))
    Y0 = ys[0] % S if ys else 0.0
print(f"grid   {S:.2f} px per cell, origin ({X0:.1f}, {Y0:.1f})   "
      f"plate reads {round((W - X0) / S)} x {round((H - Y0) / S)} cells\n")

ink = np.abs(im - paper).sum(axis=2) > 90
counts = collections.Counter(map(tuple, im[ink]))
seen = []
for colour, n in counts.most_common(40):
    if n < a.min_area:
        continue
    if any(sum(abs(x - y) for x, y in zip(colour, s)) < 60 for s in seen):
        continue
    seen.append(colour)
    mask = np.abs(im - np.array(colour)).sum(axis=2) < 60
    lab, count = ndimage.label(mask)
    blobs = []
    for i in range(1, count + 1):
        ys_, xs_ = np.nonzero(lab == i)
        if len(xs_) < a.min_area:
            continue
        blobs.append(((xs_.min() - X0) / S, (ys_.min() - Y0) / S,
                      (xs_.max() + 1 - X0) / S, (ys_.max() + 1 - Y0) / S))
    if not blobs:
        continue
    print(f"#{colour[0]:02x}{colour[1]:02x}{colour[2]:02x}  {len(blobs)} blob(s)")
    for x0, y0, x1, y1 in sorted(blobs, key=lambda b: (round(b[1]), b[0])):
        print(f"    col {x0:5.1f} to {x1:5.1f} ({x1 - x0:4.1f} wide)   "
              f"row {y0:5.1f} to {y1:5.1f} ({y1 - y0:4.1f} tall)")
    print()

print("Blob extents are the UNION of touching same-colour pieces — a 2-wide blob may be")
print("one 2x1 piece or two 1x1s. The 0.2mm seam between pieces shows as a ~0.1 cell gap.")
