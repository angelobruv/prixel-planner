import { describe, expect, it } from 'vitest'
import { GLYPH_BY_CHAR, MONO_CASE, MONO_GLYPHS, MONO_INVENTORY, monoPool, monoSku } from '../src/mono'
import { artwork, artworkScale } from '../src/art'
import { attemptPlacements, blankProject, inventoryKey, layerCounts, parseProject, remaining, requiredInventory, validate } from '../src/model'
import { layoutText } from '../src/text'
import { groupPlacements, importGroup } from '../src/groups'
import type { TextOptions } from '../src/text'
const layout = (text:string,overrides:Partial<TextOptions>={}) => layoutText({text,col:2,row:2,alignment:'left',...overrides},blankProject().design)

describe('Mono physical case',()=>{
  it('uses all 120 supplied outlines at vendor cell scale and 323 pieces in 56 pools',()=>{
    expect(MONO_GLYPHS).toHaveLength(120)
    expect(MONO_GLYPHS.filter(g=>g.printable===false)).toHaveLength(17)
    expect(MONO_INVENTORY).toHaveLength(56)
    expect(Object.values(MONO_CASE).reduce((n,c)=>n+c,0)).toBe(323)
    expect(artworkScale('MONO-N')).toBe(1/14.1732)
    expect(artwork('MONO-N')).toContain(GLYPH_BY_CHAR.N.path)
    for(const char of 'abcdefghijklmnopqrstuvwxyz') {
      expect(GLYPH_BY_CHAR[char].path).toBe(GLYPH_BY_CHAR[char.toUpperCase()].path)
      expect(inventoryKey(monoSku(char))).toBe(inventoryKey(monoSku(char.toUpperCase())))
    }
  })
  it('counts rotational variants, zero, quotes and arrows by the shared physical pool',()=>{
    const l=layout('CU HI MW NZ O0 69')
    for(const group of ['CU','HI','MW','NZ','OO','69'])expect(l.census[monoPool(group)]).toBe(2)
    const marks=layout('←↑→↓↖↗↘↙()‘’“”:')
    expect(marks.census[monoPool('↑')]).toBe(4)
    expect(marks.census[monoPool('↗')]).toBe(4)
    expect(marks.census[monoPool('(')]).toBe(2)
    expect(marks.census[monoPool("'’")]).toBe(4)
    expect(marks.census[monoPool(':..')]).toBe(1)
    expect(layout('MINIMUM').census).toEqual({[monoPool('MW')]:3,[monoPool('HI')]:2,[monoPool('NZ')]:1,[monoPool('CU')]:1})
  })
  it('migrates legacy per-letter projects without changing placements or shape ownership',()=>{
    const old=blankProject()
    old.design.layers[0].placements=[{id:'legacy',sku:'MONO-N',col:3,row:4,rotation:90}]
    const raw={...old,design:{...old.design,schemaVersion:1},inventory:{'PX-001':7,'MONO-N':1}}
    const migrated=parseProject(JSON.stringify(raw))
    expect(migrated.design.schemaVersion).toBe(2)
    expect(migrated.design.layers).toEqual(old.design.layers)
    expect(migrated.inventory['PX-001']).toBe(7)
    expect(migrated.inventory[monoPool('NZ')]).toBe(15)
    expect(migrated.inventory['MONO-N']).toBeUndefined()
    migrated.inventory[monoPool('NZ')]=4
    expect(parseProject(JSON.stringify(migrated))).toEqual(migrated)
  })
})

describe('text layout',()=>{
  it('lays one glyph per cell, preserves spaces and aligns each line around the starting cell',()=>{
    expect(layout('ab c').placements.map(p=>[p.col,p.row])).toEqual([[2,2],[3,2],[5,2]])
    expect(layout('AB\nC',{col:10,alignment:'right'}).placements.map(p=>[p.col,p.row])).toEqual([[9,2],[10,2],[10,3]])
    expect(layout('ABC\nAB',{col:10,alignment:'centre'}).placements.map(p=>[p.col,p.row])).toEqual([[9,2],[10,2],[11,2],[9,3],[10,3]])
    expect(layout('A\n\nB').depth).toBe(3)
  })
  it('refuses every digital-only glyph explicitly, plus missing glyphs and orphan marks',()=>{
    for(const glyph of MONO_GLYPHS.filter(g=>g.printable===false)) {
      const result=layout(`A${glyph.char}B`)
      expect(result.errors.join(' ')).toContain('has no physical piece')
      expect(result.errors.join(' ')).toContain(glyph.name)
    }
    expect(layout('A🦊B').errors.join(' ')).toContain('U+1F98A')
    expect(layout('\u0300A').errors.join(' ')).toContain('needs a letter')
    expect(layout('A\tB').errors.length).toBeGreaterThan(0)
  })
  it('allocates accent rows and physical marks, warning about the high acute substitute',()=>{
    const text=layout('Crème brûlée')
    expect(text.width).toBe(12);expect(text.depth).toBe(2);expect(text.pieces).toBe(14)
    expect(text.errors).toEqual([]);expect(text.warnings.join(' ')).toContain('4.1 mm')
    expect(text.census[monoPool('\u0300')]).toBe(1)
    expect(text.census[monoPool('\u0302')]).toBe(1)
    expect(text.census[monoPool("'’")]).toBe(1)
    expect(text.placements.filter(p=>['MONO-\u0300','MONO-\u0302','MONO-’'].includes(p.sku)).map(p=>p.row)).toEqual([2,2,2])
    expect(text.placements.filter(p=>!['MONO-\u0300','MONO-\u0302','MONO-’'].includes(p.sku)).every(p=>p.row===3)).toBe(true)
    expect(layout('CRE\u0300ME BRU\u0302LE\u0301E').census).toEqual(text.census)
    const cedilla=layout('Çç');expect(cedilla.depth).toBe(1);expect(cedilla.pieces).toBe(2);expect(cedilla.census[monoPool('Ç')]).toBe(2)
    expect(layout('ñü').census).toEqual({[monoPool('NZ')]:1,[monoPool('˜')]:1,[monoPool('CU')]:1,[monoPool(':..')]:1})
  })
  it('enforces row and column limits including blank lines and accent headroom',()=>{
    expect(layout('ABCDEFGHIJKLMNOPQRSTUVWX',{col:0,row:3}).errors).toEqual([])
    expect(layout('ABCDEFGHIJKLMNOPQRSTUVWXY',{col:0,row:3}).errors.join(' ')).toContain('hard limit is 24')
    expect(layout(Array(16).fill('A').join('\n'),{row:0}).depth).toBe(16)
    expect(layout(Array(16).fill('A').join('\n'),{row:0}).errors).toEqual([])
    expect(layout(Array(15).fill('A').join('\n')+'\nè',{row:0}).errors.join(' ')).toContain('17 rows')
    expect(layout('è',{row:15}).errors.join(' ')).toContain('extend off the plate')
    expect(layout('AB',{col:0,alignment:'right'}).errors.join(' ')).toContain('off the plate')
  })
  it('renders upright on portrait plates while respecting their narrower width',()=>{
    const p=blankProject();p.design.orientation='portrait'
    const t=layoutText({text:'AB',col:3,row:5,alignment:'left'},p.design)
    expect(t.placements.map(p=>[p.col,p.row,p.rotation])).toEqual([[5,12,270],[5,11,270]])
    expect(layoutText({text:'ABCDEFGHIJKLMNOPQ',col:0,row:3,alignment:'left'},p.design).errors.join(' ')).toContain('off the plate')
  })
})

describe('text buildability uses the shared placement validator',()=>{
  it('blocks accent footprint overlaps and physical-pool exhaustion',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    layer.placements=[{id:'shape',sku:'PX-001',col:2,row:2,rotation:0}]
    const accented=layout('è')
    expect(attemptPlacements(pj,layer.id,accented.placements).error).toMatch(/overlaps existing/)
    layer.placements=[]
    expect(attemptPlacements(pj,layer.id,layout('èèè').placements).error).toContain('Mono Grave accent')
    expect(attemptPlacements(pj,layer.id,layout('éééé').placements).project).toBeDefined()
    expect(attemptPlacements(pj,layer.id,layout('éééé’').placements).error).toContain('Quotes / acute substitute')
    expect(attemptPlacements(pj,layer.id,layout(':::ü').placements).error).toContain('Colon / diaeresis')
  })
  it('counts text, manual pieces and imported groups in the same sum/max pool',()=>{
    const pj=blankProject(),layer=pj.design.layers[0];pj.inventory[monoPool('HI')]=2
    layer.placements=[{id:'old',sku:'MONO-H',col:8,row:8,rotation:0}]
    const incoming=layout('ii')
    expect(attemptPlacements(pj,layer.id,incoming.placements).error).toContain('need 3, own 2')
    expect(remaining(pj,layer.id,'MONO-i')).toBe(1)
    pj.design.layers.push({id:'second',name:'Second',ink:'#aabbcc',placements:[]})
    expect(attemptPlacements(pj,'second',incoming.placements).error).toContain('need 3, own 2')
    pj.design.inventoryMode='reuse'
    const next=attemptPlacements(pj,'second',incoming.placements).project!
    expect(requiredInventory(next.design)[monoPool('HI')]).toBe(2)
    expect(validate(next)).toEqual([])
    const source=blankProject();source.design.layers[0].placements=incoming.placements
    expect(attemptPlacements(pj,layer.id,groupPlacements(importGroup(source.design,pj.design))).error).toContain('need 3, own 2')
    expect(layerCounts(layer)[monoPool('HI')]).toBe(1)
  })
})
