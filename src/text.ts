import { GLYPH_BY_CHAR, monoSku } from './mono'
import { GRID, inventoryLabel, layerCounts, plateSize } from './model'
import type { Design, Placement, Rotation } from './types'
export type TextAlignment = 'left' | 'centre' | 'right'
export interface TextOptions { text: string; col: number; row: number; alignment: TextAlignment }
export interface TextLayout { placements: Placement[]; errors: string[]; warnings: string[]; width: number; depth: number; pieces: number; census: Record<string,number> }
interface Mark { char: string; rotation: Rotation }
interface Token { char?: string; marks: Mark[] }
const marks: Record<string,Mark> = {
  '\u0300': {char:'\u0300',rotation:0}, '\u0302': {char:'\u0302',rotation:0},
  '\u0303': {char:'˜',rotation:0}, '˜': {char:'˜',rotation:0},
  '\u0308': {char:':',rotation:90}, '\u0301': {char:'’',rotation:0},
}
export function layoutText(options: TextOptions, design: Design, idPrefix = 'text-preview'): TextLayout {
  const errors: string[] = [], warnings: string[] = [], placements: Placement[] = []
  const addError = (error: string) => { if (!errors.includes(error)) errors.push(error) }
  const addMark = (token: Token | undefined, mark: string, line: number) => {
    if (!token?.char) { addError(`Line ${line}: an accent needs a letter before it.`); return }
    if (!marks[mark]) { addError(`Line ${line}: accent U+${mark.codePointAt(0)!.toString(16).toUpperCase().padStart(4,'0')} has no physical piece.`); return }
    token.marks.push(marks[mark])
    if (token.marks.length > 1) addError(`Line ${line}: multiple accents over one letter collide in the same cell.`)
    if (mark === '\u0301' && !warnings.length) warnings.push('No acute piece exists. Acute accents use U+2019 from the quote pool, printing 4.1 mm above the letter versus 2.0 mm for a true grave. They will look noticeably high.')
  }
  if (!Number.isInteger(options.col) || !Number.isInteger(options.row)) addError('The starting cell must use whole column and row numbers.')
  if (options.text.length > 4000) return {placements:[],errors:['Text is limited to 4,000 input characters.'],warnings:[],width:0,depth:0,pieces:0,census:{}}
  const lines = options.text.replace(/\r\n?/g,'\n').split('\n')
  let depth = 0, width = 0
  const size = plateSize(design)
  const append = (char: string, x: number, y: number, rotation: Rotation = 0) => {
    const portrait = design.orientation === 'portrait'
    placements.push({id:`${idPrefix}-${placements.length}`,sku:monoSku(char),
      col:portrait ? y : x, row:portrait ? GRID.rows - 1 - x : y,
      rotation:((rotation + (portrait ? 270 : 0)) % 360) as Rotation})
  }
  lines.forEach((line, index) => {
    const tokens: Token[] = []
    // NFC preserves dedicated physical Ç/ç; NFD is used only for composite accents.
    const clusters = line.normalize('NFC').match(/\P{M}\p{M}*|\p{M}+/gu) ?? []
    for (const cluster of clusters) {
      if (cluster === ' ') { tokens.push({marks:[]}); continue }
      if (marks[cluster] || /^\p{M}+$/u.test(cluster)) {
        for (const mark of cluster) addMark(tokens.at(-1),mark,index+1)
        continue
      }
      const direct = GLYPH_BY_CHAR[cluster]
      if (direct?.printable === false) {
        addError(`Line ${index+1}: “${cluster}” (${direct.name}) exists in the font but has no physical piece.`)
        tokens.push({marks:[]}); continue
      }
      if (direct?.case_group && !direct.is_diacritic) { tokens.push({char:cluster,marks:[]}); continue }
      const [base,...accents] = [...cluster.normalize('NFD')]
      const glyph = GLYPH_BY_CHAR[base]
      if (!glyph || glyph.printable === false || !glyph.case_group || glyph.is_diacritic) {
        const code = base.codePointAt(0)!.toString(16).toUpperCase().padStart(4,'0')
        addError(`Line ${index+1}: “${cluster}” (U+${code}) has no supported physical piece.`)
        tokens.push({marks:[]}); continue
      }
      const token: Token = {char:base,marks:[]}; tokens.push(token)
      for (const mark of accents) addMark(token,mark,index+1)
    }
    const lineWidth = tokens.length
    width = Math.max(width,lineWidth)
    if (lineWidth > GRID.cols) addError(`Line ${index+1} is ${lineWidth} cells wide; the hard limit is 24. Text does not wrap automatically.`)
    const start = options.alignment === 'right' ? options.col - lineWidth + 1 : options.alignment === 'centre' ? options.col - Math.floor(lineWidth/2) : options.col
    if (lineWidth && (start < 0 || start + lineWidth > size.w)) addError(`Line ${index+1} extends off the plate at this starting cell and alignment.`)
    const accented = tokens.some(t => t.marks.length)
    const baseline = options.row + depth + (accented ? 1 : 0)
    for (const [i, token] of tokens.entries()) {
      if (token.char) append(token.char,start+i,baseline)
      for (const mark of token.marks) append(mark.char,start+i,baseline-1,mark.rotation)
    }
    depth += 1 + (accented ? 1 : 0)
  })
  if (depth > GRID.rows) addError(`Text needs ${depth} rows including accent rows; the hard limit is 16.`)
  if (options.row < 0 || options.row + depth > size.h) addError('Text, blank lines or accent rows extend off the plate.')
  if (!placements.length && !errors.length) addError('Type at least one printable character.')
  const census = layerCounts({id:'text',name:'Text',ink:'#30302c',placements})
  return {placements,errors,warnings,width,depth,pieces:placements.length,census}
}
export function textCensusLabel(key: string, n: number) { return `${inventoryLabel(key)} × ${n}` }
