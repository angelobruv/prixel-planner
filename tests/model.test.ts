import { describe, expect, it } from 'vitest'
import { BY_SKU, GRID, PIECES, binHex, attemptPlacement, blankProject, bounds, fromView, negroniProject, occupied, parseProject, plateSize, requiredInventory, remaining, validate } from '../src/model'
import { buildSheetHtml, plateSvg } from '../src/export'
import { artwork } from '../src/art'
import type { Placement, Rotation } from '../src/types'
const place = (sku = 'PX-004', col = 3, row = 3, rotation: Rotation = 0): Placement => ({ id: 'one', sku, col, row, rotation })

describe('physical model', () => {
  it('preserves the catalogue contract, 31 artworks and 7 families', () => {
    const kit = PIECES.filter(p => p.code.startsWith('PX-'))
    expect(kit.reduce((n,p) => n + p.qty_in_kit, 0)).toBe(316)
    expect(kit.filter(p => p.svg)).toHaveLength(31)
    expect(new Set(kit.filter(p => p.svg).map(p => p.family)).size).toBe(7)
    expect(BY_SKU['PX-029'].family).toBe(BY_SKU['PX-018'].family)
    expect(GRID.cols * GRID.rows - GRID.blocked_cells.length).toBe(372)
    expect(new Set(GRID.blocked_cells.map(c => c.join(','))).size).toBe(12)
  })
  it('rotates a vendor 1×4 as four wide then four tall, anchored at the bounding box', () => {
    expect(bounds(place())).toEqual({ w: 4, h: 1 })
    expect(bounds(place('PX-004',3,3,90))).toEqual({ w: 1, h: 4 })
    expect(occupied(place('PX-004',3,3,90))).toEqual([[3,3],[3,4],[3,5],[3,6]])
    for (const r of [0,90,180,270] as Rotation[]) for (const p of PIECES) {
      const pos = place(p.code,3,3,r), cells = occupied(pos), b = bounds(pos)
      expect(cells).toHaveLength(p.cells_w * p.cells_h)
      expect(Math.min(...cells.map(c => c[0]))).toBe(3)
      expect(Math.max(...cells.map(c => c[1]))).toBe(3+b.h-1)
      expect(Math.max(...cells.map(c => c[0]))).toBe(3+b.w-1)
    }
  })
  it('rejects boundary and configured corner violations and treats empty ink as occupied', () => {
    const pj = blankProject(), layer = pj.design.activeLayerId
    expect(attemptPlacement(pj, layer, place('PX-004',22,4)).error).toMatch(/off the plate/)
    expect(attemptPlacement(pj, layer, place('PX-001',0,1)).error).toMatch(/blocked/)
    const arc = attemptPlacement(pj,layer,place('PX-017')).project!
    expect(attemptPlacement(arc,layer,{...place('PX-001',4,4),id:'two'}).error).toMatch(/overlap|collid/)
    expect(attemptPlacement(arc,layer,{...place('PX-001',6,4),id:'two'}).project).toBeDefined()
  })
  it('rejects moving an earlier placement into a later one and rotating through another piece', () => {
    const pj = blankProject(), layer = pj.design.layers[0]
    layer.placements = [place(),{...place('PX-001',3,5),id:'two'}]
    expect(attemptPlacement(pj,layer.id,place('PX-004',3,3,90)).error).toBeDefined()
    expect(attemptPlacement(pj,layer.id,place('PX-004',3,5)).error).toBeDefined()
  })
  it('allows cross-pass overlaps, with sum/max inventory and active-pass headroom', () => {
    const pj = blankProject(); pj.inventory['PX-001'] = 1
    pj.design.layers[0].placements = [place('PX-001')]
    pj.design.layers.push({id:'second',name:'second',ink:'#cc2211',placements:[{...place('PX-001'),id:'two'}]})
    expect(requiredInventory(pj.design)['PX-001']).toBe(2)
    expect(validate(pj)).toHaveLength(1)
    pj.design.inventoryMode = 'reuse'
    expect(requiredInventory(pj.design)['PX-001']).toBe(1)
    expect(validate(pj)).toEqual([])
    expect(remaining(pj,'second','PX-001')).toBe(0)
    expect(attemptPlacement(pj,'second',{...place('PX-001',5,5),id:'three'}).error).toMatch(/need 2/)
  })
  it('never enables pieces with no SVG, even when owned', () => {
    for (const sku of ['PX-030','PX-031','PX-032']) {
      const pj = blankProject(); pj.inventory[sku] = 10
      expect(attemptPlacement(pj,pj.design.activeLayerId,place(sku)).error).toMatch(/no artwork/)
    }
  })
  it('inverts whole-plate portrait and mirror transforms without changing placements', () => {
    const pj = blankProject(), d = pj.design
    expect(plateSize(d)).toEqual({w:24,h:16})
    expect(fromView(d,19.5,3.5,true)).toEqual([4.5,3.5])
    d.orientation = 'portrait'
    expect(plateSize(d)).toEqual({w:16,h:24})
    expect(fromView(d,12.5,4.5)).toEqual([4.5,3.5])
    expect(fromView(d,3.5,4.5,true)).toEqual([4.5,3.5])
  })
})

describe('persistence and sample', () => {
  it('round trips all settings and preserves the four-pass Negroni study', () => {
    const pj = negroniProject()
    expect(parseProject(JSON.stringify(pj))).toEqual(pj)
    expect(pj.design.layers).toHaveLength(4)
    expect(pj.design.orientation).toBe('portrait')
    expect(pj.design.layers[3].placements).toHaveLength(7)
    expect(validate(pj)).toHaveLength(0) // published Mono case counts seed shared pools
    expect(validate(pj)).toEqual([])
    expect(artwork('MONO-N')).toContain('<path')
  })
  it('rejects invalid imports without inventing a physical flip or unknown SKU', () => {
    const original = negroniProject()
    for (const mutation of [
      (p: any) => { p.design.schemaVersion = 99 },
      (p: any) => { p.design.layers[0].placements[0].flipped = true },
      (p: any) => { p.design.layers[0].placements[0].rotation = '90' },
      (p: any) => { p.design.layers[0].placements[0].col = 2.2 },
      (p: any) => { p.design.layers[0].placements[0].sku = 'UNKNOWN' },
      (p: any) => { p.design.layers[0].placements[0].sku = '__proto__' },
      (p: any) => { p.inventory['PX-001'] = -1 },
      (p: any) => { p.design.layers[1].id = p.design.layers[0].id },
      (p: any) => { p.design.paperColor = '<script>' },
    ]) { const pj = structuredClone(original); mutation(pj); expect(() => parseProject(JSON.stringify(pj))).toThrow() }
  })
  it('keeps invalid geometry importable for repair and revalidates older profile versions', () => {
    const pj = blankProject(); pj.design.plateProfile.version = 0
    pj.design.layers[0].placements.push(place('PX-004',23,15))
    const restored = parseProject(JSON.stringify(pj))
    expect(restored.design.plateProfile.version).toBe(0)
    expect(validate(restored).length).toBeGreaterThan(0)
  })
})

describe('build exports', () => {
  it('exports exact physical SVG dimensions with mirrored geometry in both orientations', () => {
    const pj = blankProject(); pj.design.layers[0].placements.push(place('PX-006'))
    const svg = plateSvg(pj,pj.design.layers[0])
    expect(svg).toContain('width="120mm" height="80mm"')
    expect(svg).toContain('translate(24 0) scale(-1 1)')
    expect(svg).toContain('Concurrent assembly')
    pj.design.orientation = 'portrait'; pj.design.inventoryMode = 'reuse'
    expect(plateSvg(pj,pj.design.layers[0])).toContain('width="80mm" height="120mm"')
    expect(plateSvg(pj,pj.design.layers[0])).toContain('translate(16 0) scale(-1 1) translate(16 0) rotate(90)')
  })
  it('creates one sheet per pass, with unmirrored external pick-lists and calibration', () => {
    const pj = negroniProject(); pj.design.name = '<img src=x onerror=alert(1)>'
    const html = buildSheetHtml(pj)
    expect(html.match(/<section>/g)).toHaveLength(4)
    expect(html.match(/<svg /g)).toHaveLength(4)
    expect(html).toContain('</svg></div><div class="ruler">50 mm calibration')
    expect(html).toContain('Checks pass under provisional assumptions.')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('<script')
    expect(html).toContain('width:50mm')
  })
})

describe('binHex — the colour a piece is moulded in', () => {
  it('reads the piece fill, which is not the ink', () => {
    expect(binHex('PX-001')).toBe('#fcee21')   // Square bin, yellow
    expect(binHex('PX-005')).toBe('#ff1d25')   // Triangle bin, red
  })
  it('falls back to the family for SKUs the catalogue leaves unfilled', () => {
    const orphan = PIECES.find(p => p.family && !p.fill)
    if (!orphan) return
    expect(binHex(orphan.code)).toBe(PIECES.find(p => p.family === orphan.family && p.fill)!.fill)
  })
  it('gives type pieces their own near-black, not the pass ink', () => {
    expect(binHex('MONO-A')).toBe('#30302c')
  })
})
