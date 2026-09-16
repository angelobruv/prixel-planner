import { SHAPES } from './shapes'
import { GLYPH_BY_CHAR, MONO_UNITS } from './mono'
import { BY_SKU, placementTransform } from './model'
import type { Placement } from './types'
export function artwork(sku: string): string {
  const p = BY_SKU[sku]
  if (p.glyph) return `<path fill="currentColor" d="${GLYPH_BY_CHAR[p.glyph]?.path ?? ''}"/>`
  return SHAPES[sku]?.inner.replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"') ?? ''
}
export function artworkScale(sku: string) { return BY_SKU[sku].glyph ? 1 / MONO_UNITS : 1 / 14.1732 }
export function renderPlacement(p: Placement, ink: string) {
  return `<g transform="${placementTransform(p)}" color="${ink}"><g transform="scale(${artworkScale(p.sku)})">${artwork(p.sku)}</g></g>`
}
