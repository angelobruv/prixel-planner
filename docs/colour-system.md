# Colour system — custom inks, mixing, and the swatch notebook

## The reframe

The original ask was "a colour mixer". The actual workflow is: **buy reinkers,
mix physically, print, judge, keep the good ones.** So this is a **lab notebook
first and a predictor second.** The prediction is the unreliable half — opaque
pigments, no published K/S data, screen ≠ paper. Your measured swatches are
ground truth, and the predictor exists only to narrow down what's worth mixing.

Tsukineko publishes **no hex values for any of the 80 VersaColor colours**.
So the swatch library isn't just a nice feature — it is the only source of real
colour data this app will ever have.

## What's known about the inks

Full palette data in `assets/inks.json` (85 rows: 80 small pads / 66 large /
80 reinkers, matching Tsukineko's own counts).

- **All water-based pigment, opaque, high saturation.** No dye line exists.
- **Metallics 091–094 are OIL-based.** Never mix them with the other 80.
- **Reinker = "Ultimate Pigment Inker"** `VCR-000-***`, all 80 colours.
  prixel.com stocks black only — buy colours direct.
- **Five colours are inker-only**: Apricot, Coral, Apple Green, Citron, Pale
  Blue. An uninked pad is the only way to use them.
- **Vessel: Tsukineko Uninked Foam Pad `UI000001`** — 76×47 mm impression,
  same footprint as VersaColor L, officially rated for VersaColor / Brilliance /
  VersaCraft / StazOn reinkers. No blank mini pad exists.
- Drying 10–15 min. Recommended surface: smooth uncoated cardstock.
- PRIXEL's print area (120×80 mm) exceeds the largest pad (76×47 mm).
  Tsukineko's guidance for that case: tap the pad onto the stamp by hand.

⚠️ **Unverified:** every source calls these inks opaque, so overprinting
*probably* covers rather than blends — but nobody has tested it. See the
first experiment below; it decides whether this app needs an overprint model.

## The swatch card protocol

The cheapest calibration that isn't self-deceiving: **put the references on the
card itself.** Every swatch photo must contain a white point and a black point
alongside the test ink, so one photo self-corrects.

1. Use the same uncoated stock you actually print on. Leave a patch **unstamped**
   — that's your paper-white reference.
2. Stamp a solid patch of **VS-082 Black** on every card — that's your black point.
3. Stamp the test ink beside them. Same pressure, same dab count.
4. Write the recipe on the card in pen (parts, not drops — see below).
5. Dry a full 15 min before photographing. Wet pigment reads darker and more
   saturated than dry.
6. Photograph flat, in even indirect daylight, no flash, card filling the frame.
7. The app linearly rescales the photo's channels so white patch → paper white
   and black patch → black point, then samples the ink patch.

A ColorChecker target improves hue and gamma accuracy further, but it is an
upgrade, not the minimum. White + black patches fix the dominant errors
(exposure and white balance) for free.

## Recipes: parts, not drops

**Drops are not a unit.** Drop volume varies with viscosity and nozzle geometry
between bottles — the ink-dilution community moved to syringes and millilitres
for exactly this reason. So:

- **Source of truth: parts / percent by volume.** Record `{inkId, parts}`.
- **Drops are a rounded UI convenience** derived from parts, never stored as the
  canonical value.
- Measure with a syringe when a mix is worth reproducing.

## The mixing engine

**Use `spectral.js` (MIT).** Kubelka-Munk-style pigment mixing, reconstructs a
plausible reflectance curve from RGB, on npm and jsDelivr, works from a plain
script tag, actively maintained.

**Do not use Mixbox.** Same class of technique and arguably better, but it's
**CC BY-NC 4.0** — non-commercial only. Not worth the licence exposure.

**Do not write Kubelka-Munk from scratch.** It needs measured K(λ)/S(λ)
reflectance curves per pigment. That data does not exist for craft stamp inks
without a spectrophotometer.

### Two separate modes — do not conflate them

| Mode | Physics | Model |
|---|---|---|
| **Mix** — combining reinkers in a pad | subtractive pigment mixing | spectral.js |
| **Overprint** — stamping B over dried A | stacked translucent filters | multiplicative transmittance in linear light |

Neugebauer / Yule-Nielsen are the rigorous overprint models, but they describe
halftone dots; a rubber stamp lays near-solid coverage, so they're overkill.

### Inverse solve (target colour → recipe)

spectral.js is forward-only — no solve function. Search it yourself:

- Coarse grid search at ~5% steps to seed, then **Nelder-Mead simplex** to refine.
  Smooth enough that simplex converges fast without an autodiff library.
- **Cap at 3 pigments.** Beyond that real subtractive mixes desaturate toward
  mud and the solve space goes multi-modal.
- **Error metric: CIEDE2000 in Lab.** Notably better than CIE76/94 in blues,
  which is exactly where ink mixing lives.

### Tinting strength — the biggest gotcha

A "50/50" mix from any KM model is a ratio of **optical concentration, not
volume.** If one pigment is stronger, the visually-even midpoint sits nowhere
near 50/50 by volume, and an uncalibrated recipe overshoots toward the weak
pigment. spectral.js exposes a `tintingStrength`, but it's inferred from the
RGB reconstruction — a plausible estimate, not a measurement.

So each ink carries a calibratable override:

```ts
type InkStrength = {
  inkId: string
  tintStrength: number                          // relative, 1.0 = baseline
  calibratedAt: 'estimated' | 'swatch-test'
  calibrationRatio?: [number, number]           // volume ratio vs reference that
                                                // produced the visual midpoint
}
```

Calibrate by mixing a known ratio against a reference ink (or white), stamping,
photographing, and back-solving which actual ratio landed on the visual midpoint.

## Data model

```ts
type Ink =
  | { kind: 'stock';  id: string; code: string; name: string        // from inks.json
      format: 'small' | 'large' | 'inker'; base: 'water' | 'oil' }
  | { kind: 'custom'; id: string; name: string
      recipe: { inkId: string; parts: number }[]
      predictedHex?: string }                                        // spectral.js guess

type Swatch = {
  id: string; inkId: string
  measuredHex: string                       // after white/black rescale
  photoRef?: string
  paperStock: string
  verdict: 'keep' | 'discard' | 'undecided'
  notes: string
  measuredAt: string
}
```

`predictedHex` and `measuredHex` stay separate columns forever. Showing the
delta between them is what makes the predictor trustworthy over time — and it
is the honest way to display a guess.

## What the UI must say

The mixer is a **preview, not a proof**. Uncoated stock's gamut is roughly half
the volume of coated, and dot gain on absorbent uncoated paper runs ~20% against
~3–4% coated. sRGB will cheerfully show colours the ink cannot physically reach.
Every predicted colour needs a visible "stamp a test swatch before committing"
affordance.

## First experiments, in order

1. **Does overprint blend?** Stamp A, dry 15 min, stamp B across it. Settles
   whether the overprint model gets built at all.
2. **Tint strength of your mixing base.** Mix each primary 1:1 against White
   (080) and against Black (082), stamp, measure. Seeds every `tintStrength`.
3. **Paper delta.** Stamp the four kit inks on your actual stock and measure.
   That's the first real `printed_hex` data, and it shows how far the pad-surface
   samples in `inks.json` are from truth.

## Suggested buy list for mixing

Rather than buying broadly across 80 pads: **Magenta 015, Cyan 019, Canary 011,
Black 082, White 080** as reinkers, plus one Uninked Foam Pad per custom colour
you want live at once. That's a proper subtractive CMY+K+W base — derive what
you like, then buy the stock pad if a mix earns a permanent place.

Sources: [VersaColor](https://www.tsukineko.co.jp/en/products/versa-color-series/) ·
[Uninked Foam Pad](https://www.tsukineko.co.jp/en/products/uninked-foam-pad/) ·
[spectral.js](https://github.com/rvanwijnen/spectral.js) ·
[Mixbox licence](https://github.com/scrtwpns/mixbox) ·
PRIXEL Idea Book p.6 (`reference/PRIXEL_Idea_Book_2024.pdf`) for the ink-type guidance.
