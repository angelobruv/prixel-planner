export type Rotation = 0 | 90 | 180 | 270

/** A piece SKU as it appears in assets/catalogue.json. Sizes are HEIGHT x WIDTH in cells. */
export interface Piece {
  code: string
  cells_w: number
  cells_h: number
  mm_w: number
  mm_h: number
  description: string
  qty_in_kit: number
  fill: string | null
  viewBox: string | null
  svg: string | null
  size_label: string
  /** PRIXEL's other name for this piece on the expansion-packs page, where it differs. */
  name_expansion_page?: string
}

export interface Grid {
  cols: number
  rows: number
  pitch_mm: number
  print_area_mm: [number, number]
  corner_holes_removed_per_corner: number
  corner_cutout_shape: string
  usable_cells: number
}

export interface Catalogue {
  grid: Grid
  pieces: Piece[]
  _provenance: Record<string, string>
  _units: string
  _naming: string
}

/**
 * One piece on one plate. Stores {sku, cell, rotation} — never a pre-rotated
 * sprite variant. There is deliberately no `flipped`: reflecting a chiral piece
 * may produce an orientation the physical stamp cannot make, and that has not
 * been verified. See docs/plan-review-request.md.
 */
export interface Placement {
  id: string
  sku: string
  col: number
  row: number
  rotation: Rotation
}

/** One layer = one setup plate = one ink pass. */
export interface Layer {
  id: string
  name: string
  ink: string
  placements: Placement[]
}

export interface Design {
  schemaVersion: 1
  name: string
  layers: Layer[]
  activeLayerId: string
}
