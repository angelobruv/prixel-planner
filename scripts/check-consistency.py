#!/usr/bin/env python3
"""Fail if docs/prixel-spec.md's piece table disagrees with assets/catalogue.json.

assets/catalogue.json is canonical. The spec's markdown table is hand-written so
the prose stays editable — this catches drift rather than preventing it.

    python3 scripts/check-consistency.py      # exit 0 clean, 1 on drift
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cat = json.load(open(os.path.join(ROOT, "assets", "catalogue.json")))
spec = open(os.path.join(ROOT, "docs", "prixel-spec.md")).read()

by_code = {p["code"]: p for p in cat["pieces"]}
row = re.compile(r"^\|\s*(PX-\d{3})\s*\|\s*(\d+)×(\d+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*$", re.M)

errors, seen = [], set()
for m in row.finditer(spec):
    code, h, w, desc, qty, colour = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4), m.group(5), m.group(6)
    seen.add(code)
    p = by_code.get(code)
    if not p:
        errors.append(f"{code}: in spec table but not in catalogue.json")
        continue
    if (h, w) != (p["cells_h"], p["cells_w"]):
        errors.append(f"{code}: spec says {h}×{w}, catalogue says {p['cells_h']}×{p['cells_w']}")
    if desc != p["description"]:
        errors.append(f"{code}: spec desc {desc!r}, catalogue {p['description']!r}")
    q = qty.strip()
    expected = "—" if p["qty_in_kit"] == 0 else str(p["qty_in_kit"])
    if q != expected:
        errors.append(f"{code}: spec qty {q!r}, catalogue {expected!r}")
    if p["fill"] and p["fill"] not in colour:
        errors.append(f"{code}: spec colour {colour!r} omits catalogue fill {p['fill']}")

for code in sorted(set(by_code) - seen):
    errors.append(f"{code}: in catalogue.json but missing from the spec table")

total = sum(p["qty_in_kit"] for p in cat["pieces"])
if f"sums to **{total}**" not in spec and f"sums to {total}" not in spec:
    errors.append(f"spec does not state the catalogue's actual kit total ({total})")

if errors:
    print(f"DRIFT — {len(errors)} mismatch(es) between docs/prixel-spec.md and assets/catalogue.json:")
    for e in errors:
        print("  -", e)
    sys.exit(1)
print(f"OK — spec table matches catalogue.json ({len(seen)} SKUs, {total} pieces)")
