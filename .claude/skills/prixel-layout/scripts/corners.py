#!/usr/bin/env python3
"""Report which corner a filled piece hugs, per rotation, by measuring the render.

Piece descriptions ("quarter circle") do not say which corner the disc is
centred on, and low-res thumbnails are easy to misread — this reads the pixels.
Usage:  pieces.sh --measure PX-012   (which calls this)
"""
import sys
from PIL import Image
import numpy as np

img, hexes = sys.argv[1], sys.argv[2]
rgb = tuple(int(hexes.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))
a = np.asarray(Image.open(img).convert('RGB')).astype(int)
ink = np.abs(a - np.array(rgb)).sum(axis=2) < 90
cols = np.nonzero(ink.any(axis=0))[0]
if not len(cols):
    sys.exit(f"no {hexes} ink found in {img}")

groups, start, prev = [], cols[0], cols[0]
for x in cols[1:]:
    if x > prev + 5:
        groups.append((start, prev)); start = x
    prev = x
groups.append((start, prev))

for (x0, x1), rot in zip(groups, (0, 90, 180, 270)):
    m = ink[:, x0:x1 + 1]
    rows = np.nonzero(m.any(axis=1))[0]
    m = m[rows.min():rows.max() + 1]
    h, w = m.shape
    q = {'top-left': m[:h // 2, :w // 2].mean(), 'top-right': m[:h // 2, w // 2:].mean(),
         'bottom-left': m[h // 2:, :w // 2].mean(), 'bottom-right': m[h // 2:, w // 2:].mean()}
    solid, thin = max(q, key=q.get), min(q, key=q.get)
    print(f"  r{rot:<4} solid at {solid:<13} ({q[solid]:.2f} covered)   thinnest {thin} ({q[thin]:.2f})")
