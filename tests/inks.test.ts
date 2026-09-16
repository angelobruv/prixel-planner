import { describe, expect, it } from 'vitest'
import { OWNED_INKS, hexToOklab, inkDescription, layerInkHex, nearestOwnedInks, selectedOwnedInk, swatchHex, swatchSource } from '../src/inks'
import { blankProject, parseProject } from '../src/model'
import { buildSheetHtml, plateSvg } from '../src/export'

describe('owned ink data and provenance',()=>{
  it('offers exactly the owned 21 colours / 22 pads and marks Bronze chemistry and reinker availability',()=>{
    expect(OWNED_INKS).toHaveLength(21)
    expect(OWNED_INKS.reduce((n,i)=>n+i.qty,0)).toBe(22)
    expect(OWNED_INKS.find(i=>i.code==='174')!.qty).toBe(2)
    expect(OWNED_INKS.filter(i=>i.base==='oil').map(i=>i.code)).toEqual(['094'])
    expect(OWNED_INKS.find(i=>i.code==='094')!.hasReinker).toBe(false)
    expect(OWNED_INKS.every(i=>swatchSource(i)==='Approximate vendor swatch')).toBe(true)
  })
  it('uses measured print, then vendor, and never promotes a pad photograph',()=>{
    const ink={printed_hex:'#123456',vendor_hex:'#abcdef',pad_sample_hex:'#fedcba'}
    expect(swatchHex(ink)).toBe('#123456')
    expect(swatchSource(ink)).toBe('Measured printed swatch')
    expect(swatchHex({...ink,printed_hex:null})).toBe('#abcdef')
    expect(swatchHex({...ink,printed_hex:null,vendor_hex:null})).toBeNull()
    expect(swatchHex(OWNED_INKS.find(i=>i.code==='080')!)).toBe('#ffffff')
    expect(swatchHex(OWNED_INKS.find(i=>i.code==='082')!)).toBe('#000000')
    expect(swatchHex(OWNED_INKS.find(i=>i.code==='013')!)).toBe('#f08300')
  })
  it('preserves off-palette legacy hexes until an owned ink is explicitly chosen',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    expect(layerInkHex(layer)).toBe('#C0392B')
    expect(selectedOwnedInk(layer)).toBeUndefined()
    expect(nearestOwnedInks(layer.ink).map(i=>i.name)).toEqual(['Scarlet','Camellia'])
    expect(parseProject(JSON.stringify(pj))).toEqual(pj)
  })
  it('retains stock identity through JSON and lets a later measured swatch supersede its preview',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    layer.ink='#e83836';layer.inkSku='VS-000-014'
    expect(parseProject(JSON.stringify(pj))).toEqual(pj)
    const ink=OWNED_INKS.find(i=>i.sku===layer.inkSku)!,before=ink.printed_hex
    try {
      ink.printed_hex='#ca302d'
      expect(layerInkHex(layer)).toBe('#ca302d')
      expect(inkDescription(layer)).toContain('Measured printed swatch')
      expect(layerInkHex({...layer,inkSku:undefined})).toBe('#e83836')
      expect(nearestOwnedInks('#ca302d')[0].name).toBe('Scarlet')
    } finally {ink.printed_hex=before}
  })
  it('includes selected ink identity and oil restrictions in physical setup outputs',()=>{
    const pj=blankProject(),layer=pj.design.layers[0]
    layer.ink='#a86d54';layer.inkSku='VS-000-094'
    expect(buildSheetHtml(pj)).toContain('Bronze · VS-000-094 · Approximate vendor swatch')
    expect(buildSheetHtml(pj)).toContain('do not mix with water-based inks; no reinker')
    expect(plateSvg(pj,layer)).toContain('Bronze')
    expect(()=>parseProject(JSON.stringify({...pj,design:{...pj.design,layers:[{...layer,inkSku:'<script>'}]}}))).toThrow('Invalid ink SKU')
  })
  it('uses a perceptual screen distance with known neutral endpoints and exact matches',()=>{
    const white=hexToOklab('#ffffff'),black=hexToOklab('#000000')
    expect(white[0]).toBeCloseTo(1,6);expect(white[1]).toBeCloseTo(0,6);expect(white[2]).toBeCloseTo(0,6)
    expect(black).toEqual([0,0,0])
    expect(nearestOwnedInks('#e83836')[0].name).toBe('Scarlet')
    expect(nearestOwnedInks('invalid')).toEqual([])
  })
})
