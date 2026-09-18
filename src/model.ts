import catalogue from '../assets/catalogue.json' with { type: 'json' }
import { MONO_PIECES, MONO_INVENTORY } from './mono'
import type { Catalogue, Cell, Design, Inventory, Layer, Placement, Project, Rotation } from './types'
export const CATALOGUE = catalogue as unknown as Catalogue
export const GRID = CATALOGUE.grid
export const FAMILIES = ['Square', 'Triangle', 'Circle & Arc', 'Inverted Circle', 'Straight Line', 'Circle & Arc Line', 'Diagonal Line']
export const MONO = MONO_PIECES
export const PIECES = [...CATALOGUE.pieces, ...MONO]
export const INVENTORY_ITEMS = [...CATALOGUE.pieces, ...MONO_INVENTORY]
export const BY_SKU = Object.fromEntries([...PIECES, ...MONO_INVENTORY].map(p => [p.code, p]))
/** The colour a piece is physically moulded in — its sort bin in the box.
 *  Nothing to do with the ink it prints: a scarlet pass is built from yellow
 *  squares, blue arcs and near-black type. Three SKUs carry no fill of their
 *  own, so the first fill declared for their family stands in. */
const UNSORTED_BIN = '#8c8375'
const FAMILY_FILL: Record<string, string> = {}
for (const p of PIECES) if (p.family && p.fill && !FAMILY_FILL[p.family]) FAMILY_FILL[p.family] = p.fill
export function binHex(sku: string): string {
  const p = BY_SKU[sku]
  return p?.fill ?? (p?.family ? FAMILY_FILL[p.family] : undefined) ?? UNSORTED_BIN
}

export const inventoryKey = (sku: string) => BY_SKU[sku]?.inventory_key ?? sku
export const inventoryLabel = (sku: string) => BY_SKU[sku]?.glyph ? BY_SKU[sku].description : sku
export const uid = () => crypto.randomUUID()
export const stockInventory = (): Inventory => Object.fromEntries(INVENTORY_ITEMS.map(p => [p.code, p.qty_in_kit]))
export const newLayer = (name = 'New pass', ink = '#C0392B'): Layer => ({ id: uid(), name, ink, placements: [] })
export function blankProject(): Project {
  const layer = newLayer('Red ink')
  return { design: { schemaVersion: 2, name: 'Untitled composition', layers: [layer], activeLayerId: layer.id,
    plateProfile: { id: GRID.id, version: GRID.version }, orientation: 'landscape', paperColor: '#F6EEDC', inventoryMode: 'concurrent' }, inventory: stockInventory() }
}
export function bounds(p: Placement) {
  const piece = BY_SKU[p.sku]
  return p.rotation % 180 ? { w: piece.cells_h, h: piece.cells_w } : { w: piece.cells_w, h: piece.cells_h }
}
export function occupied(p: Placement): Cell[] {
  const piece = BY_SKU[p.sku]
  return piece.footprint_cells.map(([x, y]) => {
    const [rx, ry] = p.rotation === 90 ? [piece.cells_h - 1 - y, x]
      : p.rotation === 180 ? [piece.cells_w - 1 - x, piece.cells_h - 1 - y]
      : p.rotation === 270 ? [y, piece.cells_w - 1 - x] : [x, y]
    return [p.col + rx, p.row + ry]
  })
}
export function placementTransform(p: Placement) {
  const { cells_w: w, cells_h: h } = BY_SKU[p.sku]
  const rotate = p.rotation === 90 ? `translate(${h} 0) rotate(90)` : p.rotation === 180 ? `translate(${w} ${h}) rotate(180)` : p.rotation === 270 ? `translate(0 ${w}) rotate(270)` : ''
  return `translate(${p.col} ${p.row}) ${rotate}`
}
export function plateSize(d: Design) { return d.orientation === 'portrait' ? { w: GRID.rows, h: GRID.cols } : { w: GRID.cols, h: GRID.rows } }
export function plateTransform(d: Design, mirror = false) {
  return `${mirror ? `translate(${plateSize(d).w} 0) scale(-1 1)` : ''} ${d.orientation === 'portrait' ? `translate(${GRID.rows} 0) rotate(90)` : ''}`
}
export function fromView(d: Design, x: number, y: number, mirror = false): Cell {
  if (mirror) x = plateSize(d).w - x
  return d.orientation === 'portrait' ? [y, GRID.rows - x] : [x, y]
}
export function layerCounts(layer: Layer): Inventory {
  const counts: Inventory = {}
  for (const p of layer.placements) { const key = inventoryKey(p.sku); counts[key] = (counts[key] ?? 0) + 1 }
  return counts
}
export function requiredInventory(d: Design): Inventory {
  const counts: Inventory = {}
  for (const layer of d.layers) for (const [sku, n] of Object.entries(layerCounts(layer))) {
    counts[sku] = d.inventoryMode === 'concurrent' ? (counts[sku] ?? 0) + n : Math.max(counts[sku] ?? 0, n)
  }
  return counts
}
/** How many additional copies can be placed on this pass under the active policy. */
export function remaining(project: Project, layerId: string, sku: string) {
  sku = inventoryKey(sku)
  const used = project.design.inventoryMode === 'concurrent' ? requiredInventory(project.design)[sku] : layerCounts(project.design.layers.find(l => l.id === layerId)!)[sku]
  return (project.inventory[sku] ?? 0) - (used ?? 0)
}
export interface Issue { layerId?: string; placementId?: string; message: string }
export function validate(project: Project): Issue[] {
  const issues: Issue[] = []
  const blocked = new Set(GRID.blocked_cells.map(c => c.join(',')))
  for (const layer of project.design.layers) {
    const taken = new Map<string, string>()
    for (const p of layer.placements) {
      const issue = (message: string) => issues.push({ layerId: layer.id, placementId: p.id, message: `${layer.name}: ${p.sku} ${message}` })
      if (!BY_SKU[p.sku]?.svg) { issue('has no supported artwork.'); continue }
      const cells = occupied(p)
      if (cells.some(([x,y]) => x < 0 || y < 0 || x >= GRID.cols || y >= GRID.rows)) issue('extends off the plate.')
      if (cells.some(c => blocked.has(c.join(',')))) issue('crosses a blocked corner cell.')
      if (cells.some(c => taken.has(c.join(',')))) issue('collides with another footprint.')
      for (const cell of cells) taken.set(cell.join(','), p.id)
    }
  }
  for (const [sku, n] of Object.entries(requiredInventory(project.design))) if (n > (project.inventory[sku] ?? 0)) issues.push({ message: `${inventoryLabel(sku)}: need ${n}, own ${project.inventory[sku] ?? 0}.` })
  return issues
}
/** Validate and apply a batch atomically. Replacements release their original footprints. */
export function attemptPlacements(project: Project, layerId: string, placements: Placement[], replaceIds: string[] = []): { project?: Project; error?: string; errors: string[] } {
  const errors: string[] = []
  const fail = (message: string) => { if (!errors.includes(message)) errors.push(message) }
  const active = project.design.layers.find(l => l.id === layerId)
  if (!active) return { error: 'The destination pass no longer exists.', errors: ['The destination pass no longer exists.'] }
  if (!placements.length) fail('The group is empty.')
  const replacements = new Set(replaceIds)
  if (replaceIds.some(id => !active.placements.some(p => p.id === id))) fail('A selected piece no longer exists on this pass.')
  const existingIds = new Set(project.design.layers.flatMap(l => l.placements).filter(p => !replacements.has(p.id)).map(p => p.id))
  const incomingIds = new Set<string>()
  const blocked = new Set(GRID.blocked_cells.map(c => c.join(',')))
  const existing = new Map<string, string>()
  for (const p of active.placements.filter(p => !replacements.has(p.id))) {
    for (const cell of occupied(p)) existing.set(cell.join(','), p.sku)
  }
  const incoming = new Map<string, string>()
  for (const p of placements) {
    if (existingIds.has(p.id) || incomingIds.has(p.id)) fail('Placement IDs must be unique.')
    incomingIds.add(p.id)
    if (!Object.hasOwn(BY_SKU, p.sku) || !BY_SKU[p.sku].svg) { fail(`${p.sku} has no artwork and cannot be placed.`); continue }
    if (!Number.isInteger(p.col) || !Number.isInteger(p.row) || ![0,90,180,270].includes(p.rotation)) { fail('Pieces must snap to whole cells with quarter-turn rotations.'); continue }
    const cells = occupied(p)
    if (cells.some(([x,y]) => x < 0 || y < 0 || x >= GRID.cols || y >= GRID.rows)) fail(`${p.sku} extends off the plate.`)
    if (cells.some(c => blocked.has(c.join(',')))) fail(`${p.sku} crosses a blocked corner cell.`)
    for (const cell of cells) {
      const key = cell.join(',')
      if (existing.has(key)) fail(`${p.sku} overlaps existing ${existing.get(key)} on this pass.`)
      if (incoming.has(key)) fail(`${p.sku} collides with ${incoming.get(key)} inside the group; their physical footprints overlap.`)
      incoming.set(key, p.sku)
    }
  }
  const next = structuredClone(project)
  const layer = next.design.layers.find(l => l.id === layerId)!
  // Keep existing z-order when moving; append newly imported pieces.
  const updates = new Map(placements.map(p => [p.id, p]))
  layer.placements = layer.placements.flatMap(p => replacements.has(p.id) ? (updates.has(p.id) ? [updates.get(p.id)!] : []) : [p])
  const retainedIds = new Set(layer.placements.map(p => p.id))
  layer.placements.push(...placements.filter(p => !retainedIds.has(p.id)))
  if (layer.placements.length > 1000) fail('A pass can contain at most 1,000 placements.')
  const before = requiredInventory(project.design), after = requiredInventory(next.design)
  const beforePass = layerCounts(active), afterPass = layerCounts(layer)
  for (const [sku, n] of Object.entries(after)) {
    // Unchanged shortages should not prevent moving existing pieces to repair a design.
    if (n > (project.inventory[sku] ?? 0) && (n > (before[sku] ?? 0) || (afterPass[sku] ?? 0) > (beforePass[sku] ?? 0))) fail(`Inventory exhausted for ${inventoryLabel(sku)}: need ${n}, own ${project.inventory[sku] ?? 0}.`)
  }
  return errors.length ? { error: errors[0], errors } : { project: next, errors }
}
export function attemptPlacement(project: Project, layerId: string, placement: Placement): { project?: Project; error?: string } {
  const replaceIds = project.design.layers.find(l => l.id === layerId)?.placements.some(p => p.id === placement.id) ? [placement.id] : []
  return attemptPlacements(project, layerId, [placement], replaceIds)
}

const hex = (v: unknown): v is string => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
/** Whitelist imported fields. Never insert user markup into SVG. */
export function parseProject(text: string): Project {
  if (text.length > 2_000_000) throw new Error('This file is too large (maximum 2 MB).')
  const root: unknown = JSON.parse(text)
  if (!object(root) || !object(root.design) || !object(root.inventory)) throw new Error('Expected a PRIXEL project with design and inventory.')
  const d = root.design
  if (d.schemaVersion !== 1 && d.schemaVersion !== 2) throw new Error('Unsupported project version.')
  if (typeof d.name !== 'string' || d.name.length > 150 || !hex(d.paperColor) || !['landscape','portrait'].includes(String(d.orientation)) || !['concurrent','reuse'].includes(String(d.inventoryMode))) throw new Error('Invalid design settings.')
  if (!object(d.plateProfile) || d.plateProfile.id !== GRID.id || !Number.isInteger(d.plateProfile.version)) throw new Error('Unknown plate profile.')
  if (!Array.isArray(d.layers) || !d.layers.length || d.layers.length > 50) throw new Error('A project must contain 1–50 passes.')
  const ids = new Set<string>()
  const id = (v: unknown): string => { if (typeof v !== 'string' || !v || v.length > 150 || ids.has(v)) throw new Error('Missing or duplicate ID.'); ids.add(v); return v }
  const layers = d.layers.map((l): Layer => {
    if (!object(l) || typeof l.name !== 'string' || l.name.length > 100 || !hex(l.ink) || !Array.isArray(l.placements) || l.placements.length > 1000) throw new Error('Invalid pass.')
    if (l.inkSku !== undefined && (typeof l.inkSku !== 'string' || !/^VS-000-\d{3}$/.test(l.inkSku))) throw new Error('Invalid ink SKU.')
    return { id: id(l.id), name: l.name, ink: l.ink, ...(typeof l.inkSku === 'string' ? { inkSku: l.inkSku } : {}), placements: l.placements.map((p): Placement => {
      if (!object(p) || typeof p.sku !== 'string' || !Object.hasOwn(BY_SKU, p.sku) || !Number.isInteger(p.col) || !Number.isInteger(p.row) || Math.abs(Number(p.col)) > 100 || Math.abs(Number(p.row)) > 100 || ![0,90,180,270].includes(Number(p.rotation)) || typeof p.rotation !== 'number' || 'flipped' in p) throw new Error('Invalid placement; only quarter-turn rotations are supported.')
      return { id: id(p.id), sku: p.sku, col: Number(p.col), row: Number(p.row), rotation: p.rotation as Rotation }
    }) }
  })
  const inventory: Inventory = {}
  for (const p of INVENTORY_ITEMS) {
    const n = root.inventory[p.code] ?? (d.schemaVersion === 1 && p.glyph ? p.qty_in_kit : 0)
    if (!Number.isSafeInteger(n) || Number(n) < 0 || Number(n) > 10000) throw new Error(`Invalid inventory for ${p.code}.`)
    inventory[p.code] = Number(n)
  }
  return { design: { schemaVersion: 2, name: d.name, layers, activeLayerId: layers.some(l => l.id === d.activeLayerId) ? String(d.activeLayerId) : layers[0].id,
    orientation: d.orientation as Design['orientation'], inventoryMode: d.inventoryMode as Design['inventoryMode'], paperColor: d.paperColor,
    plateProfile: { id: GRID.id, version: Number(d.plateProfile.version) } }, inventory }
}
export function negroniProject(): Project {
  const project = blankProject()
  const yellow = newLayer('01 · Lemon arc', '#F2C230'), orange = newLayer('02 · Orange slice', '#F07E26'), red = newLayer('03 · Red glass', '#C0392B'), text = newLayer('04 · Negroni', '#37392E')
  // Author the example in portrait view; persist every placement on the canonical 24×16 plate.
  const add = (layer: Layer, sku: string, x: number, y: number, rotation: Rotation = 0) => {
    const p = { id: uid(), sku, col: 0, row: 0, rotation }
    const { w } = bounds(p)
    layer.placements.push({ ...p, col: y, row: GRID.rows - x - w, rotation: ((rotation + 270) % 360) as Rotation })
  }
  add(yellow, 'PX-017', 8, 7, 180)
  add(orange, 'PX-012', 8, 8, 0)
  for (let y = 9; y < 13; y += 2) for (let x = 4; x < 12; x += 2) add(red, 'PX-003', x, y)
  for (let y = 13; y < 15; y++) { add(red, 'PX-004', 4, y); add(red, 'PX-004', 8, y) }
  add(red, 'PX-012', 4, 15, 180); add(red, 'PX-012', 10, 15, 90)
  add(red, 'PX-004', 6, 15); add(red, 'PX-004', 6, 16)
  ;[...'Negroni'].forEach((glyph, i) => add(text, `MONO-${glyph}`, 4 + i, 19))
  project.design = { ...project.design, name: 'Negroni study', orientation: 'portrait', layers: [yellow, orange, red, text], activeLayerId: red.id }
  return project
}
