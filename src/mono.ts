import glyphData from '../assets/mono-glyphs.json' with { type: 'json' }
import caseData from '../assets/mono-case.json' with { type: 'json' }
import type { Piece } from './types'
export interface MonoGlyph {
  char: string; name: string; path: string; advance_cells: number; zero_width: boolean
  is_diacritic: boolean; case_group: string | null; printable?: boolean; note?: string
}
export const MONO_GLYPHS = Object.values(glyphData.glyphs) as MonoGlyph[]
export const GLYPH_BY_CHAR = Object.fromEntries(MONO_GLYPHS.map(g => [g.char, g]))
export const MONO_CASE = caseData.case as Record<string, number>
export const MONO_UNITS = glyphData.cell_units
export const monoSku = (char: string) => `MONO-${char}`
export const monoPool = (group: string) => `MONO-CASE-${group}`
export function caseLabel(group: string) {
  const labels: Record<string,string> = { CU: 'C / U', HI: 'H / I', MW: 'M / W', NZ: 'N / Z', OO: 'O / 0', '69': '6 / 9', "'’": 'Quotes / acute substitute', ':..': 'Colon / diaeresis', '\u0300': 'Grave accent', '\u0302': 'Circumflex', '˜': 'Tilde', '↑': 'Cardinal arrows', '↗': 'Diagonal arrows', '(': '( / )' }
  return `Mono ${labels[group] ?? group}`
}
export const MONO_PIECES: Piece[] = MONO_GLYPHS.map(g => ({
  code: monoSku(g.char), glyph: g.char, description: `PRIXEL Mono ${g.name.toLowerCase()}`,
  cells_w: 1, cells_h: 1, mm_w: 5, mm_h: 5, qty_in_kit: 0,
  fill: '#30302c', viewBox: `0 0 ${MONO_UNITS} ${MONO_UNITS}`,
  svg: g.printable !== false && g.case_group ? `mono-${g.char}` : null,
  size_label: '1x1', family: 'PRIXEL Mono', footprint_cells: [[0,0]],
  inventory_key: g.case_group ? monoPool(g.case_group) : undefined,
}))
export const MONO_INVENTORY: Piece[] = Object.entries(MONO_CASE).map(([group, count]) => {
  const representative = MONO_PIECES.find(p => p.inventory_key === monoPool(group))!
  return { ...representative, code: monoPool(group), description: caseLabel(group), qty_in_kit: count }
})
