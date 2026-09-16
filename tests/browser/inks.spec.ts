import { expect,test,type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import { blankProject } from '../../src/model'
import type { Project } from '../../src/types'
const key='prixel-planner-v1'
async function open(page:Page){const p=blankProject();p.design.layers[0].placements=[{id:'square',sku:'PX-003',col:5,row:5,rotation:0}];await page.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p))},{key,p});await page.goto('/');return p}
async function saved(page:Page):Promise<Project>{return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)}

test('legacy red stays custom until a nearest-owned suggestion is selected; undo/redo and reload preserve identity',async({page})=>{
  const before=await open(page)
  await expect(page.locator('.current-ink')).toContainText('Custom colour')
  const nearest=page.getByRole('group',{name:'Nearest owned colours'})
  await expect(nearest.getByRole('button')).toHaveCount(2)
  await expect(nearest.getByRole('button').first()).toContainText('Scarlet')
  await expect(nearest.getByRole('button').nth(1)).toContainText('Camellia')
  expect(await saved(page)).toEqual(before)
  await nearest.getByRole('button',{name:'Use Scarlet VS-000-014',exact:true}).click()
  await expect.poll(async()=>(await saved(page)).design.layers[0].inkSku).toBe('VS-000-014')
  await expect(page.getByLabel('Ink colour',{exact:true})).toHaveValue('#e83836')
  await expect(page.getByTestId('plate').locator('g[color="#e83836"]')).toHaveCount(1)
  await expect(page.locator('.ink-provenance')).toHaveText('Approximate vendor swatch')
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(before)
  await page.getByRole('button',{name:'Redo',exact:true}).click()
  await expect.poll(async()=>(await saved(page)).design.layers[0].inkSku).toBe('VS-000-014')
  await page.reload();await expect(page.locator('.current-ink')).toContainText('Scarlet')
})

test('owned palette exposes all 21 inks with vendor swatches, distinct pad quantities and Bronze caution',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'Choose owned ink (21)'}).click()
  const palette=page.getByRole('group',{name:'Owned ink palette'})
  await expect(palette.locator('.owned-ink-option')).toHaveCount(21)
  await expect(palette).toContainText('21 colours · 22 pads')
  await expect(palette.getByRole('button',{name:'Use Charcoal VS-000-174'})).toContainText('×2')
  await expect(palette.getByRole('button',{name:'Use Orange VS-000-013'})).toContainText('#F08300')
  await expect(palette.getByRole('button',{name:'Use White VS-000-080'})).toContainText('#FFFFFF')
  await expect(palette.getByRole('button',{name:'Use Black VS-000-082'})).toContainText('#000000')
  await expect(palette).not.toContainText('#FC4705')
  await page.getByRole('searchbox',{name:'Search owned inks'}).fill('094')
  const bronze=palette.getByRole('button',{name:'Use Bronze VS-000-094, oil-based, no reinker'})
  await expect(bronze).toContainText('Oil-based · no reinker')
  await page.screenshot({path:'test-results/owned-ink-bronze.png',fullPage:true})
  await bronze.click()
  await expect(page.locator('.ink-caution')).toContainText('Do not mix with your water-based inks. No reinker is available.')
  await expect.poll(async()=>(await saved(page)).design.layers[0].inkSku).toBe('VS-000-094')
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Build sheets ↗'}).click()
  const html=await fs.readFile((await(await downloaded).path())!,'utf8')
  expect(html).toContain('Bronze · VS-000-094 · Approximate vendor swatch')
  expect(html).toContain('do not mix with water-based inks; no reinker')
})

test('custom hex validates input, clears stock identity and updates preview without relabelling it measured',async({page})=>{
  await open(page);await page.getByRole('button',{name:'Use Scarlet VS-000-014',exact:true}).click()
  await expect.poll(async()=>(await saved(page)).design.layers[0].inkSku).toBe('VS-000-014')
  const before=await saved(page)
  const custom=page.getByRole('textbox',{name:'Custom mix / hex'})
  await custom.fill('xyz');await page.getByRole('button',{name:'Apply',exact:true}).click()
  await expect(page.getByRole('alert')).toContainText('Use six hex digits')
  expect(await saved(page)).toEqual(before)
  await custom.fill('#123456');await custom.press('Enter')
  await expect.poll(async()=>(await saved(page)).design.layers[0].ink).toBe('#123456')
  expect((await saved(page)).design.layers[0].inkSku).toBeUndefined()
  await expect(page.locator('.ink-provenance')).toHaveText('Custom preview, not a measured print.')
  await expect(page.getByRole('group',{name:'Nearest owned colours'})).toBeVisible()
})

test('owned picker remains usable on mobile and pass changes do not leak custom drafts',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page)
  await page.getByRole('textbox',{name:'Custom mix / hex'}).fill('abcdef')
  await page.getByRole('button',{name:'Add ink pass'}).click()
  await expect(page.getByRole('textbox',{name:'Custom mix / hex'})).toHaveValue('#456A64')
  await page.getByRole('button',{name:'Choose owned ink (21)'}).click()
  await page.getByRole('searchbox',{name:'Search owned inks'}).fill('Scarlet')
  await expect(page.getByRole('button',{name:'Use Scarlet VS-000-014',exact:true})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/owned-ink-mobile.png',fullPage:true})
})
