import { GRID, bounds, uid } from './model'
import type { Design, Placement, Rotation } from './types'

/** Ephemeral transaction. The project is never modified until this group commits. */
export interface PlacementGroup {
  placements: Placement[]
  centre: [number, number]
  rotation: Rotation
}
export function groupBounds(placements: Placement[]) {
  if (!placements.length) throw new Error('There are no pieces to place in this group.')
  const col = Math.min(...placements.map(p => p.col))
  const row = Math.min(...placements.map(p => p.row))
  return {
    col, row,
    w: Math.max(...placements.map(p => p.col + bounds(p).w)) - col,
    h: Math.max(...placements.map(p => p.row + bounds(p).h)) - row,
  }
}
export function createGroup(placements: Placement[], freshIds = false): PlacementGroup {
  const b = groupBounds(placements)
  return {
    placements: placements.map(p => ({ ...p, id: freshIds ? uid() : p.id, col: p.col - b.col, row: p.row - b.row })),
    centre: [b.col + b.w / 2, b.row + b.h / 2], rotation: 0,
  }
}
export function groupPlacements(group: PlacementGroup): Placement[] {
  const { w, h } = groupBounds(group.placements)
  const rotatedW = group.rotation % 180 ? h : w
  const rotatedH = group.rotation % 180 ? w : h
  // A mixed odd/even bounding box cannot rotate about its exact centre AND
  // remain on integer cells. Snap the whole group (never individual pieces).
  // Retain the unsnapped centre so four quarter-turns return exactly to start.
  const col = Math.floor(group.centre[0] - rotatedW / 2)
  const row = Math.floor(group.centre[1] - rotatedH / 2)
  return group.placements.map(p => {
    const b = bounds(p)
    const [x, y] = group.rotation === 90 ? [h - p.row - b.h, p.col]
      : group.rotation === 180 ? [w - p.col - b.w, h - p.row - b.h]
      : group.rotation === 270 ? [p.row, w - p.col - b.w] : [p.col, p.row]
    return { ...p, col: col + x, row: row + y, rotation: ((p.rotation + group.rotation) % 360) as Rotation }
  })
}
export function moveGroup(group: PlacementGroup, dx: number, dy: number): PlacementGroup {
  return { ...group, centre: [group.centre[0] + dx, group.centre[1] + dy] }
}
export function rotateGroup(group: PlacementGroup): PlacementGroup {
  return { ...group, rotation: ((group.rotation + 90) % 360) as Rotation }
}
/** Flatten intentionally: overlaps that were legal across ink passes are now collisions. */
export function importGroup(source: Design, destination: Design): PlacementGroup {
  const group = createGroup(source.layers.flatMap(l => l.placements), true)
  // Preserve the motif's visible orientation when the two plates differ.
  group.rotation = ((source.orientation === 'portrait' ? 90 : 0) - (destination.orientation === 'portrait' ? 90 : 0) + 360) % 360 as Rotation
  const b = groupBounds(groupPlacements(group))
  group.centre = [Math.floor((GRID.cols - b.w) / 2) + b.w / 2, Math.floor((GRID.rows - b.h) / 2) + b.h / 2]
  return group
}
