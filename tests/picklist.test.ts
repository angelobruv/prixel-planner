import { describe, expect, it } from 'vitest'
import { buildSheetHtml } from '../src/export'
import { attemptPlacements, blankProject, uid } from '../src/model'
import type { Placement } from '../src/types'

const at = (sku: string, col: number, row: number): Placement => ({ id: uid(), sku, col, row, rotation: 0 })

describe('pick-list groups by physical sort bin', () => {
  it('names the bin and shows the piece colour, not the ink colour', () => {
    let p = blankProject()
    p = attemptPlacements(p, p.design.layers[0].id, [
      at('PX-003', 4, 4),   // 2x2 square  -> Square bin, yellow #fcee21
      at('PX-005', 8, 4),   // right triangle -> Triangle bin, red #ff1d25
    ]).project!
    p.design.layers[0].ink = '#0000ff'          // ink deliberately unlike either bin
    const html = buildSheetHtml(p)
    expect(html).toContain('Square')
    expect(html).toContain('Triangle')
    expect(html).toContain('#fcee21')           // square pieces are yellow
    expect(html).toContain('#ff1d25')           // triangle pieces are red
    expect(html).toContain('bin-dot')
  })

  it('puts every piece in exactly one bin row', () => {
    let p = blankProject()
    p = attemptPlacements(p, p.design.layers[0].id, [
      at('PX-003', 4, 4), at('PX-003', 6, 4), at('PX-001', 8, 4),
    ]).project!
    const html = buildSheetHtml(p)
    const body = html.slice(html.indexOf('Pick-list'))
    // two SKUs from the Square bin -> one bin cell spanning two rows
    expect(body).toContain('rowspan="2"')
  })

  it('still lists pieces that have no family', () => {
    let p = blankProject()
    const mono = Object.keys(p.inventory).find(k => k.startsWith('MONO-'))
    if (!mono) return
    p.design.layers[0].placements.push({ id: uid(), sku: mono, col: 3, row: 3, rotation: 0 })
    expect(buildSheetHtml(p)).toContain('Type / other')
  })
})
