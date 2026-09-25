// Build assets/mono-glyphs.json from PRIXEL's own published font.
//
// The PRIXEL Mono font is © Otherwhere Collective and PRIXEL Press, and its licence
// forbids storing it on public servers. So this repository holds none of it: this
// script downloads the font from PRIXEL's store at build time and turns each glyph
// into an outline in the planner's cell space. Everything that is *not* font data —
// names, case groups, accent rules — lives in assets/mono-glyphs.meta.json.
//
// Runs automatically before dev, build and test. The font is cached in
// node_modules/.cache, so after the first run it works offline.
import fs from 'node:fs'
import path from 'node:path'
import opentype from 'opentype.js'

export const FONT_URL = 'https://cdn.shopify.com/s/files/1/0594/8840/3665/files/PRIXELMono.otf'
const CACHE = 'node_modules/.cache/prixel/PRIXELMono.otf'
const META = 'assets/mono-glyphs.meta.json'
const OUT = 'assets/mono-glyphs.json'
/** Vendor SVG units per 5mm cell. Shapes and glyphs share this space. */
const CELL = 14.1732
/** The em box maps onto one cell, baseline 800/1000 of the way down. */
const BASELINE = 0.8 * CELL

async function fontBytes() {
  if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE)
  const res = await fetch(FONT_URL)
  if (!res.ok) throw new Error(`PRIXEL Mono download failed: HTTP ${res.status} from ${FONT_URL}`)
  const bytes = Buffer.from(await res.arrayBuffer())
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  fs.writeFileSync(CACHE, bytes)
  return bytes
}

/** Numbers as the original outlines printed them (Python's float repr): a whole
 *  number keeps its ".0", everything else is the shortest round-trip form, which
 *  JavaScript and Python agree on for every value this font produces. */
const n = v => Number.isInteger(v) ? `${Object.is(v, -0) ? '-' : ''}${Math.abs(v)}.0` : String(v)

/** SVG path data in the planner's format: plain numbers, H/V for straight lines,
 *  and an implicit lineto for diagonals that directly continue a moveto. */
export function pathData(glyph) {
  let out = '', cx, cy, open = false, afterMove = false
  for (const c of glyph.getPath(0, BASELINE, CELL).commands) {
    if (c.type === 'Z') { out += 'Z'; open = false; afterMove = false; continue }
    if (c.type === 'M') { if (open) out += 'Z'; out += `M${n(c.x)} ${n(c.y)}`; open = true; afterMove = true }
    else if (c.type === 'L' && c.x === cx) { out += `V${n(c.y)}`; afterMove = false }
    else if (c.type === 'L' && c.y === cy) { out += `H${n(c.x)}`; afterMove = false }
    else if (c.type === 'L') out += `${afterMove ? ' ' : 'L'}${n(c.x)} ${n(c.y)}`
    else if (c.type === 'C') { out += `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`; afterMove = false }
    else if (c.type === 'Q') { out += `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`; afterMove = false }
    cx = c.x; cy = c.y
  }
  return open ? out + 'Z' : out
}

export async function build() {
  const bytes = await fontBytes()
  const font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'))
  const glyphs = Object.fromEntries(Object.entries(meta.glyphs).map(([key, g]) => {
    const { char, name, ...rest } = g
    return [key, { char, name, path: pathData(font.charToGlyph(String.fromCodePoint(parseInt(key.slice(2), 16)))), ...rest }]
  }))
  const out = { ...meta, glyphs }
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n')
  return out
}

if (import.meta.url === `file://${process.argv[1]}`) {
  build().then(o => console.log(`mono glyphs: ${Object.keys(o.glyphs).length} outlines from PRIXEL's published font`))
    .catch(e => { console.error(e.message); process.exit(1) })
}
