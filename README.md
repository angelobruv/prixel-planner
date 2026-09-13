# prixel-planner

A planner for the [PRIXEL](https://prixel.com) modular rubber-stamp kit — compose
on a virtual 24×16 grid, check the design against the pieces you actually own, and
print a mirrored build sheet to work from at the press.

**No app code yet.** What's here is the verified reference the app gets built
against.

## Start here

| File | What it is |
|---|---|
| [`docs/prixel-spec.md`](docs/prixel-spec.md) | **The hardware contract.** Grid, dimensions, all 34 piece SKUs, PRIXEL Mono. |
| [`docs/colour-system.md`](docs/colour-system.md) | Ink system — custom mixing, the swatch-notebook design, the calibration protocol. |
| [`assets/catalogue.json`](assets/catalogue.json) | **Canonical piece data.** Read `_provenance` before trusting any field. |
| [`assets/inks.json`](assets/inks.json) | 85 Tsukineko VersaColor colours. Read `_warning`. |
| [`docs/plan-review-request.md`](docs/plan-review-request.md) | Build plan, externally reviewed. |
| [`NOTICE.md`](NOTICE.md) | **Third-party licensing. Read before making this repo public.** |

## Three things that will bite you

1. **Vendor size labels are height × width.** A `1×4` is four cells wide, one
   tall. Verified against the viewBox of all 31 shipped SVGs.
2. **Every print is mirrored.** The plate layout is the reverse of what prints.
3. **The corner cut-out shape is inferred from a photo, not measured.** Keep the
   blocked-cell mask config-driven until someone measures a real plate.

## Regenerating

```bash
python3 scripts/build-datasheet.py       # docs/prixel-datasheet.html from assets/
```
