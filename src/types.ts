export type Rotation = 0 | 90 | 180 | 270
export type Cell = [number, number]
export interface Piece {
  code: string; cells_w: number; cells_h: number; mm_w: number; mm_h: number
  description: string; qty_in_kit: number; fill: string | null; viewBox: string | null
  svg: string | null; size_label: string; family: string; footprint_cells: Cell[]
  name_expansion_page?: string; glyph?: string; inventory_key?: string
}
export interface Grid {
  id: string; version: number; cols: number; rows: number; pitch_mm: number
  print_area_mm: [number, number]; corner_holes_removed_per_corner: number
  corner_cutout_shape: string; usable_cells: number; blocked_cells: Cell[]
}
export interface Catalogue {
  grid: Grid; pieces: Piece[]; _provenance: Record<string, string>; _units: string; _naming: string
}
/** Zero-based anchor at the rotated footprint's top-left; clockwise rotations. */
export interface Placement { id: string; sku: string; col: number; row: number; rotation: Rotation }
export interface Layer { id: string; name: string; ink: string; inkSku?: string; placements: Placement[] }
export type InventoryMode = 'concurrent' | 'reuse'
export interface Design {
  schemaVersion: 2; name: string; layers: Layer[]; activeLayerId: string
  plateProfile: { id: string; version: number }
  orientation: 'landscape' | 'portrait'; paperColor: string; inventoryMode: InventoryMode
}
export type Inventory = Record<string, number>
export interface Project { design: Design; inventory: Inventory }
