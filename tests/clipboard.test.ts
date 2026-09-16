import { describe, expect, it } from 'vitest'
import { attemptPlacements, blankProject, newLayer, uid } from '../src/model'
import type { Layer, Placement, Project } from '../src/types'

/** The paste rule the UI applies: land in place, else offset one cell. */
function paste(project: Project, layerId: string, clip: Placement[]) {
  for (const [dx, dy] of [[0, 0], [1, 1]]) {
    const fresh = clip.map(p => ({ ...p, id: uid(), col: p.col + dx, row: p.row + dy }))
    const r = attemptPlacements(project, layerId, fresh)
    if (r.project) return { project: r.project, fresh, offset: dx === 1 }
  }
  return null
}
const at = (sku: string, col: number, row: number): Placement => ({ id: uid(), sku, col, row, rotation: 0 })
const clipOf = (l: Layer) => l.placements.map((x: Placement) => ({ ...x }))

function twoPasses() {
  let p = blankProject()
  p = attemptPlacements(p, p.design.layers[0].id, [at('PX-001', 4, 4)]).project!
  const second = newLayer('Second ink')
  p = { ...p, design: { ...p.design, layers: [...p.design.layers, second] } }
  return { p, a: p.design.layers[0], b: second }
}

describe('cut and paste between passes', () => {
  it('pastes into another pass at the SAME coordinates', () => {
    let { p, a, b } = twoPasses()
    const clip = clipOf(p.design.layers[0])
    p = { ...p, design: { ...p.design, layers: p.design.layers.map((l: Layer) => l.id === a.id ? { ...l, placements: [] } : l) } }
    const out = paste(p, b.id, clip)!
    expect(out.offset).toBe(false)
    expect(out.fresh[0]).toMatchObject({ col: 4, row: 4 })
    expect(out.project.design.layers[1].placements).toHaveLength(1)
    expect(out.project.design.layers[0].placements).toHaveLength(0)
  })

  it('mints fresh ids so a paste never collides with its source', () => {
    const { p } = twoPasses()
    const clip = clipOf(p.design.layers[0])
    const out = paste(p, p.design.layers[0].id, clip)!
    expect(out.fresh[0].id).not.toBe(clip[0].id)
  })

  it('offsets when pasting back into an occupied pass', () => {
    const { p, a } = twoPasses()
    const out = paste(p, a.id, clipOf(p.design.layers[0]))!
    expect(out.offset).toBe(true)
    expect(out.fresh[0]).toMatchObject({ col: 5, row: 5 })
  })

  it('refuses a paste that would leave the plate', () => {
    const { p, a } = twoPasses()
    expect(paste(p, a.id, [at('PX-001', 99, 99)])).toBeNull()
  })
})
