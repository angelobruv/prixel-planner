import { describe, expect, it } from 'vitest'
import { attemptPlacements, blankProject } from '../src/model'
import { createGroup, groupBounds, groupPlacements, importGroup, moveGroup, rotateGroup } from '../src/groups'
import type { Placement, Rotation } from '../src/types'
const p = (id: string, sku: string, col: number, row: number, rotation: Rotation = 0): Placement => ({ id, sku, col, row, rotation })
const noPosition = (pieces: Placement[]) => pieces.map(({ id: _id, ...piece }) => piece)

describe('group transforms', () => {
  it('normalises rotated footprints and mints fresh identities independently of source coordinates', () => {
    const original = [p('a','PX-004',-40,73,90),p('b','PX-003',-37,76)]
    const group = createGroup(original,true)
    expect(groupBounds(group.placements)).toEqual({col:0,row:0,w:5,h:5})
    expect(group.placements.map(p=>p.id)).not.toEqual(original.map(p=>p.id))
    const source=blankProject(), destination=blankProject()
    source.design.layers[0].placements=original
    const first=importGroup(source.design,destination.design)
    source.design.layers[0].placements=original.map(p=>({...p,col:p.col+50,row:p.row-80}))
    const second=importGroup(source.design,destination.design)
    expect(noPosition(groupPlacements(first))).toEqual(noPosition(groupPlacements(second)))
    expect(original[0].col).toBe(-40)
  })
  it('rotates positions and piece orientations clockwise about the group centre', () => {
    const group=createGroup([p('a','PX-002',4,5),p('b','PX-001',7,6)])
    expect(group.centre).toEqual([6,6])
    const turned=rotateGroup(group)
    expect(turned.centre).toEqual([6,6])
    expect(groupPlacements(turned)).toEqual([p('a','PX-002',6,4,90),p('b','PX-001',5,7,90)])
    expect(groupBounds(groupPlacements(turned))).toEqual({col:5,row:4,w:2,h:4})
  })
  it('snaps mixed-parity dimensions as one unit without drifting over four turns', () => {
    const original=[p('a','PX-002',3,3),p('b','PX-001',5,4)]
    let group=createGroup(original)
    for(let i=0;i<4;i++) {
      group=rotateGroup(group)
      for(const p of groupPlacements(group)) {expect(Number.isInteger(p.col)).toBe(true);expect(Number.isInteger(p.row)).toBe(true)}
    }
    expect(groupPlacements(group)).toEqual(original)
    expect(groupPlacements(moveGroup(group,2,-1))).toEqual(original.map(p=>({...p,col:p.col+2,row:p.row-1})))
  })
  it('preserves visible orientation across landscape/portrait imports', () => {
    const source=blankProject(),dest=blankProject()
    source.design.orientation='portrait'
    source.design.layers[0].placements=[p('a','PX-004',4,5,270)] // horizontal in portrait preview
    const incoming=groupPlacements(importGroup(source.design,dest.design))
    expect(incoming[0].rotation).toBe(0)
    dest.design.orientation='portrait'
    expect(groupPlacements(importGroup(source.design,dest.design))[0].rotation).toBe(270)
  })
  it('rejects an empty group',()=>expect(()=>createGroup([])).toThrow(/no pieces/))
})

describe('atomic group validation',()=>{
  it('rejects the Negroni arc/disc nesting when flattened onto a single pass',()=>{
    const source=blankProject(),dest=blankProject()
    source.design.layers[0].placements=[p('arc','PX-017',5,5)]
    source.design.layers.push({id:'other',name:'Orange',ink:'#F07E26',placements:[p('disc','PX-012',6,6)]})
    const before=structuredClone(dest)
    const group=groupPlacements(importGroup(source.design,dest.design))
    const result=attemptPlacements(dest,dest.design.activeLayerId,group)
    expect(result.error).toMatch(/PX-012 collides with PX-017 inside the group/)
    expect(result.project).toBeUndefined();expect(dest).toEqual(before)
  })
  it('finds collisions with existing pieces regardless of order and permits other ink passes',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    layer.placements=[p('old','PX-001',4,4)]
    expect(attemptPlacements(pj,layer.id,[p('new','PX-017',3,3)]).error).toMatch(/overlaps existing/)
    pj.design.layers.push({id:'other',name:'Second',ink:'#aabbcc',placements:[]})
    expect(attemptPlacements(pj,'other',[p('new','PX-017',3,3)]).project).toBeDefined()
  })
  it('reports blocked cells, bounds, unsupported artwork, and IDs without partial changes',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    layer.placements=[p('old','PX-001',3,3)]
    const before=structuredClone(pj)
    expect(attemptPlacements(pj,layer.id,[p('x','PX-004',22,3)]).error).toMatch(/off the plate/)
    expect(attemptPlacements(pj,layer.id,[p('x','PX-001',0,1)]).error).toMatch(/blocked corner/)
    pj.inventory['PX-030']=50
    expect(attemptPlacements(pj,layer.id,[p('x','PX-030',8,8)]).error).toMatch(/no artwork/)
    expect(attemptPlacements(pj,layer.id,[p('old','PX-001',8,8)]).error).toMatch(/IDs/)
    expect(attemptPlacements(pj,layer.id,[p('x','PX-001',8,8),p('x','PX-001',9,9)]).error).toMatch(/IDs/)
    expect(pj.design).toEqual(before.design)
  })
  it('counts repeated SKUs across the entire incoming group in both inventory modes',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    pj.inventory['PX-001']=2
    pj.design.layers.push({id:'other',name:'Second',ink:'#aabbcc',placements:[p('old','PX-001',3,3)]})
    const incoming=[p('a','PX-001',5,5),p('b','PX-001',6,5)]
    expect(attemptPlacements(pj,layer.id,incoming).error).toMatch(/Inventory exhausted.*need 3, own 2/)
    pj.design.inventoryMode='reuse'
    expect(attemptPlacements(pj,layer.id,incoming).project).toBeDefined()
    expect(attemptPlacements(pj,layer.id,[...incoming,p('c','PX-001',7,5)]).error).toMatch(/need 3, own 2/)
    // An existing shortage elsewhere must not mask a newly over-budget pass.
    pj.design.layers[1].placements.push(p('old2','PX-001',4,3),p('old3','PX-001',5,3))
    expect(attemptPlacements(pj,layer.id,[...incoming,p('c','PX-001',7,5)]).error).toMatch(/Inventory exhausted/)
  })
  it('releases selected footprints and counts, preserves IDs/order, and applies one transaction',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    pj.inventory['PX-001']=2
    layer.placements=[p('a','PX-001',3,3),p('b','PX-001',4,3)]
    const before=structuredClone(pj)
    const moved=groupPlacements(moveGroup(createGroup(layer.placements),1,0))
    const result=attemptPlacements(pj,layer.id,moved,['a','b'])
    expect(result.errors).toEqual([])
    expect(result.project!.design.layers[0].placements).toEqual(moved)
    expect(result.project!.inventory).toEqual(pj.inventory)
    expect(pj).toEqual(before)
  })
})
