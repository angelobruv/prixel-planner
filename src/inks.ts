import owned from '../assets/owned-inks.json' with { type: 'json' }
import catalogue from '../assets/inks.json' with { type: 'json' }
import type { Layer } from './types'

export interface InkSwatch {
  printed_hex: string | null
  vendor_hex: string | null
}
export interface OwnedInk extends InkSwatch {
  code: string; sku: string; name: string; qty: number
  base: 'water' | 'oil'; metallic: boolean; hasReinker: boolean
}
export const isHex = (hex: string) => /^#[\da-f]{6}$/i.test(hex)
/** A pad photograph is deliberately not a fallback for a printed/brand swatch. */
export function swatchHex(ink: InkSwatch): string | null {
  return ink.printed_hex && isHex(ink.printed_hex) ? ink.printed_hex
    : ink.vendor_hex && isHex(ink.vendor_hex) ? ink.vendor_hex : null
}
export function swatchSource(ink: InkSwatch) {
  return ink.printed_hex && isHex(ink.printed_hex) ? 'Measured printed swatch' : 'Approximate vendor swatch'
}
export const OWNED_INKS: OwnedInk[] = owned.colors.map(ink => {
  const stock = catalogue.colors.find(c => c.code === ink.code)
  return {
    code: ink.code, sku: ink.sku, name: ink.name, qty: ink.qty,
    base: ink.base as OwnedInk['base'], metallic: ink.metallic,
    // A later measured catalogue value replaces the approximate owned snapshot.
    printed_hex: stock?.printed_hex ?? ink.printed_hex,
    vendor_hex: stock?.vendor_hex ?? ink.vendor_hex,
    hasReinker: !!stock?.sku_inker,
  }
})
export function selectedOwnedInk(layer: Layer): OwnedInk | undefined {
  return layer.inkSku ? OWNED_INKS.find(i => i.sku === layer.inkSku)
    : OWNED_INKS.find(i => swatchHex(i)?.toLowerCase() === layer.ink.toLowerCase())
}
export function layerInkHex(layer: Layer): string {
  // Existing raw-hex projects are never silently recoloured. Only an explicit
  // stock-ink selection follows future measured swatch updates.
  const ink = layer.inkSku ? selectedOwnedInk(layer) : undefined
  return ink ? swatchHex(ink) ?? layer.ink : layer.ink
}
export function inkDescription(layer: Layer): string {
  const ink = selectedOwnedInk(layer)
  return ink ? `${ink.name} · ${ink.sku} · ${swatchSource(ink)}${ink.base === 'oil' ? ' · OIL-based; do not mix with water-based inks; no reinker' : ''}` : `Custom colour ${layer.ink} · unmeasured`
}
/** Björn Ottosson's public-domain linear sRGB → Oklab transform.
 * https://bottosson.github.io/posts/oklab/#converting-from-linear-srgb-to-oklab
 * Euclidean Oklab distance ranks screen swatches, not physical print outcomes.
 */
export function hexToOklab(hex: string): [number, number, number] {
  if (!isHex(hex)) throw new Error('Enter a six-digit hex colour, such as #C0392B.')
  const [r,g,b] = [1,3,5].map(offset => {
    const c = parseInt(hex.slice(offset,offset+2),16) / 255
    return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4
  })
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b)
  const m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b)
  const s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b)
  return [.2104542553*l + .7936177850*m - .0040720468*s, 1.9779984951*l - 2.4285922050*m + .4505937099*s, .0259040371*l + .7827717662*m - .8086757660*s]
}
export function nearestOwnedInks(hex: string, inks = OWNED_INKS, count = 2): OwnedInk[] {
  if (!isHex(hex)) return []
  const target = hexToOklab(hex)
  return inks.filter(i => swatchHex(i)).map(ink => {
    const lab = hexToOklab(swatchHex(ink)!)
    return { ink, distance: lab.reduce((d,c,index) => d + (c - target[index]) ** 2, 0) }
  }).sort((a,b) => a.distance - b.distance || a.ink.code.localeCompare(b.ink.code)).slice(0,count).map(i => i.ink)
}
