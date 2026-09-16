import { expect,test,type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import { blankProject } from '../../src/model'
import { monoPool } from '../../src/mono'
import type { Project } from '../../src/types'
const key='prixel-planner-v1'
async function open(page:Page,p=blankProject()) {await page.addInitScript(({key,p})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(p))},{key,p});await page.goto('/');return p}
async function saved(page:Page):Promise<Project>{return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)}
async function begin(page:Page,text:string){await page.getByRole('button',{name:'Text',exact:true}).click();await page.getByRole('textbox',{name:'Text to place'}).fill(text)}
async function cell(page:Page,x:number,y:number){await page.getByTestId('plate').scrollIntoViewIfNeeded();const b=(await page.getByTestId('plate').boundingBox())!;const vb=(await page.getByTestId('plate').getAttribute('viewBox'))!.split(' ').map(Number);await page.mouse.click(b.x+(x+.5)/vb[2]*b.width,b.y+(y+.5)/vb[3]*b.height)}

test('text stays live and uncommitted until placement, with alignment, physical census and one undo',async({page})=>{
  const original=await open(page);await begin(page,'MINIMUM')
  await expect(page.locator('.text-census-summary')).toContainText('7 pieces')
  await page.getByText('Physical-piece census',{exact:true}).click()
  await expect(page.locator('.text-census')).toContainText('Mono M / W3 of 22')
  await expect(page.locator('.text-census')).toContainText('Mono H / I2 of 16')
  expect(await saved(page)).toEqual(original)
  await cell(page,9,4)
  await expect(page.getByLabel('Start column',{exact:true})).toHaveValue('10')
  await expect(page.getByLabel('Start row',{exact:true})).toHaveValue('5')
  await page.getByLabel('Alignment',{exact:true}).selectOption('centre')
  await expect(page.getByTestId('group-bounds')).toHaveAttribute('x','6')
  await expect(page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'})).toBeEnabled()
  await page.getByRole('textbox',{name:'Text to place'}).press('Control+Enter')
  await expect(page.getByTestId('text-preview')).toHaveCount(0)
  await expect.poll(async()=>(await saved(page)).design.layers[0].placements.length).toBe(7)
  const result=await saved(page);expect(result.design.layers[0].placements.every(p=>p.row===4)).toBe(true)
  expect(new Set(result.design.layers[0].placements.map(p=>p.id)).size).toBe(7)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(result)
  await page.reload();await expect(page.locator('[data-placement]')).toHaveCount(7)
})

test('unsupported glyphs, shared-pool exhaustion, blocked cells and bounds prevent text commit',async({page})=>{
  const p=blankProject();p.inventory[monoPool('HI')]=1
  const original=await open(page,p);await begin(page,'A,B')
  await expect(page.getByRole('status')).toContainText('COMMA')
  await expect(page.locator('.text-composer .text-errors')).toContainText('COMMA')
  await expect(page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'})).toBeDisabled()
  const input=page.getByRole('textbox',{name:'Text to place'})
  await input.press('Control+Enter');expect(await saved(page)).toEqual(original)
  await input.fill('hi');await expect(page.getByRole('status')).toContainText('Mono H / I: need 2, own 1')
  await input.fill('A');await cell(page,0,0);await expect(page.getByRole('status')).toContainText('blocked corner')
  await input.fill('ABCDEFGHIJKLMNOPQRSTUVWXY');await expect(page.getByRole('status')).toContainText('hard limit is 24')
  await input.fill('A\n'.repeat(16)+'A');await expect(page.getByRole('status')).toContainText('hard limit is 16')
  await input.press('Escape');expect(await saved(page)).toEqual(original)
  await expect(page.getByTestId('text-preview')).toHaveCount(0)
})

test('accented text occupies an extra row, checks mark pools, and exports an honest acute warning',async({page})=>{
  await open(page);await begin(page,'Crème brûlée')
  await expect(page.locator('.text-census-summary')).toContainText('14 pieces')
  await expect(page.locator('.text-census-summary')).toContainText('2 / 16 rows')
  await expect(page.locator('.text-composer .ink-caution')).toContainText('4.1 mm')
  await page.getByLabel('Start row',{exact:true}).fill('16')
  await expect(page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'})).toBeDisabled()
  await page.getByLabel('Start row',{exact:true}).fill('4')
  await page.getByRole('textbox',{name:'Text to place'}).fill('èèè')
  await expect(page.getByRole('status')).toContainText('Mono Grave accent: need 3, own 2')
  await page.getByRole('textbox',{name:'Text to place'}).fill('Crème brûlée')
  await page.screenshot({path:'test-results/text-accents.png',fullPage:true})
  await page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'}).click()
  await expect.poll(async()=>(await saved(page)).design.layers[0].placements.length).toBe(14)
  const placements=(await saved(page)).design.layers[0].placements
  expect(placements.filter(p=>p.row===3)).toHaveLength(3)
  expect(placements.filter(p=>p.row===4)).toHaveLength(11)
  const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Build sheets ↗'}).click()
  const html=await fs.readFile((await(await downloaded).path())!,'utf8')
  expect(html).toContain('Mono Grave accent');expect(html).toContain('Mono Quotes / acute substitute')
  expect(html).toContain('print noticeably high')
})

test('text checks actual footprints against existing artwork on the pass',async({page})=>{
  const original=blankProject();original.design.layers[0].placements=[{id:'existing',sku:'PX-017',col:2,row:2,rotation:0}]
  await open(page,original);await begin(page,'HI')
  await expect(page.getByRole('status')).toContainText('overlaps existing PX-017')
  await page.getByLabel('Start column',{exact:true}).fill('8')
  await expect(page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'})).toBeEnabled()
  await page.getByRole('button',{name:'Cancel text Esc'}).click();expect(await saved(page)).toEqual(original)
})

test('a legacy project is backed up before its new physical-pool inventory is saved',async({page})=>{
  const p=blankProject();const old={...p,design:{...p.design,schemaVersion:1},inventory:{'PX-001':7,'MONO-N':1}}
  const text=JSON.stringify(old)
  await page.addInitScript(({key,text})=>{localStorage.setItem(key,text)},{key,text});await page.goto('/')
  await expect(page.getByRole('status')).toContainText('Mono inventory upgraded')
  await expect.poll(async()=>(await saved(page)).design.schemaVersion).toBe(2)
  expect(await page.evaluate(key=>localStorage.getItem(`${key}-before-mono-v2`),key)).toBe(text)
  expect((await saved(page)).inventory[monoPool('NZ')]).toBe(15)
  expect((await saved(page)).inventory['PX-001']).toBe(7)
})

test('mobile text controls and portrait start-cell picking fit the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});const p=blankProject();p.design.orientation='portrait'
  await open(page,p);await begin(page,'café')
  await cell(page,4,5)
  await expect(page.getByLabel('Start column',{exact:true})).toHaveValue('5')
  await expect(page.getByLabel('Start row',{exact:true})).toHaveValue('6')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/text-mobile.png',fullPage:true})
  await page.getByRole('button',{name:'Place text ⌘/Ctrl Enter'}).click()
  await expect.poll(async()=>(await saved(page)).design.layers[0].placements.length).toBe(5)
  expect((await saved(page)).design.layers[0].placements.every(p=>p.rotation===270)).toBe(true)
})
