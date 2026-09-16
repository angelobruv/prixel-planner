import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs/promises'
import { blankProject, negroniProject } from '../../src/model'
import type { Project } from '../../src/types'
const key = 'prixel-planner-v1'
async function open(page: Page, project = blankProject()) {
  await page.addInitScript(({key,project}) => { if (!localStorage.getItem(key)) localStorage.setItem(key,JSON.stringify(project)) }, {key,project})
  await page.goto('/')
}
async function stored(page: Page): Promise<Project> { return page.evaluate(key => JSON.parse(localStorage.getItem(key)!),key) }
async function count(page: Page, n: number) { await expect.poll(async () => (await stored(page)).design.layers.reduce((n,l) => n+l.placements.length,0)).toBe(n) }
async function point(page: Page, col: number, row: number, w=24,h=16) { const box = (await page.getByTestId('plate').boundingBox())!; return {x:box.x+box.width*col/w,y:box.y+box.height*row/h} }
async function clickCell(page: Page,col: number,row: number) { const p = await point(page,col+.5,row+.5); await page.mouse.click(p.x,p.y) }

test('place, rotate, move, drag, delete, undo/redo, persistence and read-only mirror', async ({page}) => {
  const errors: string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await open(page)
  await page.getByRole('button',{name:'PX-004 rectangle, 12 remaining'}).click()
  await clickCell(page,4,4); await count(page,1)
  await page.getByTestId('plate').focus();await page.keyboard.press('r')
  await expect.poll(async ()=>(await stored(page)).design.layers[0].placements[0].rotation).toBe(90)
  await page.keyboard.press('ArrowRight')
  await expect.poll(async ()=>(await stored(page)).design.layers[0].placements[0].col).toBe(5)
  const start=await point(page,5.5,4.5),end=await point(page,8.5,5.5)
  await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:8});await page.mouse.up()
  await expect.poll(async ()=>(await stored(page)).design.layers[0].placements[0].col).toBe(8)
  await page.getByRole('button',{name:'Delete selected piece'}).click();await count(page,0)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await count(page,1)
  await page.getByRole('button',{name:'Redo',exact:true}).click();await count(page,0)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await count(page,1)
  await page.reload();await expect(page.locator('[data-placement]')).toHaveCount(1)
  const before=await stored(page)
  await page.getByRole('button',{name:'Build sheet ⇄',exact:true}).click()
  await clickCell(page,10,5); await page.keyboard.press('Delete')
  expect(await stored(page)).toEqual(before)
  expect(errors).toEqual([])
})

test('collision, corner rejection, inventory editing and unsupported shapes',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'PX-004 rectangle, 12 remaining'}).click()
  await clickCell(page,23,4);await expect(page.getByRole('status')).toContainText('off the plate');await count(page,0)
  await page.getByRole('button',{name:'PX-001 square, 16 remaining'}).click()
  await clickCell(page,0,1);await expect(page.getByRole('status')).toContainText('blocked');await count(page,0)
  await clickCell(page,5,5);await count(page,1)
  await page.getByRole('button',{name:'PX-004 rectangle, 12 remaining'}).click()
  await clickCell(page,3,5);await expect(page.getByRole('status')).toContainText('overlap');await count(page,1)
  await page.getByRole('button',{name:'Inventory',exact:true}).click()
  await page.getByLabel('Owned PX-001',{exact:true}).fill('1')
  await page.getByLabel('Owned PX-030',{exact:true}).fill('12')
  await page.getByRole('button',{name:'Pieces',exact:true}).click()
  await expect(page.getByRole('button',{name:/PX-001 square, 0 remaining/})).toBeDisabled()
  await expect(page.getByRole('button',{name:/PX-030 .* no artwork/})).toBeDisabled()
})

test('four-pass sample, policy switching, correct portrait display and safe exports',async({page})=>{
  await open(page,negroniProject())
  await expect(page.getByRole('textbox',{name:'Design name'})).toHaveValue('Negroni study')
  await expect(page.getByText('Checks pass*',{exact:true})).toBeVisible()
  await expect(page.getByText('Checks pass*',{exact:true})).toBeVisible()
  await page.getByLabel('How will you use your pieces?').selectOption('reuse')
  await expect(page.getByText('4 passes can be prepared sequentially using your two plates.')).toBeVisible()
  await page.getByRole('button',{name:'Pieces',exact:true}).click()
  const svgDownload=page.waitForEvent('download')
  await page.getByRole('button',{name:'Export this pass as SVG ↓'}).click()
  const svg=await fs.readFile((await(await svgDownload).path())!,'utf8')
  expect(svg).toContain('width="80mm" height="120mm"');expect(svg).toContain('scale(-1 1)')
  const htmlDownload=page.waitForEvent('download')
  await page.getByRole('button',{name:'Build sheets ↗'}).click()
  const html=await fs.readFile((await(await htmlDownload).path())!,'utf8')
  expect(html.match(/<section>/g)).toHaveLength(4);expect(html).toContain('Reuse pieces')
  const sheet=await page.context().newPage();await sheet.setContent(html)
  await expect(sheet.locator('section')).toHaveCount(4)
  const box=(await sheet.locator('svg').first().boundingBox())!
  expect(box.width).toBeCloseTo(80*96/25.4,0);expect(box.height).toBeCloseTo(120*96/25.4,0)
  const ruler=(await sheet.locator('.ruler').first().boundingBox())!;expect(ruler.width).toBeCloseTo(50*96/25.4,0)
  const pdf = await sheet.pdf({path:'test-results/negroni-build-sheets.pdf',preferCSSPageSize:true,printBackground:true})
  expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(4)
  await sheet.close()
  await page.screenshot({path:'test-results/desktop.png',fullPage:true})
})

test('portrait keyboard movement follows screen direction; JSON import errors preserve project',async({page})=>{
  const pj=blankProject();pj.design.orientation='portrait'
  await open(page,pj)
  await page.getByRole('button',{name:'PX-001 square, 16 remaining'}).click()
  await page.getByTestId('plate').focus();await page.keyboard.press('Enter');await count(page,1)
  const before=(await stored(page)).design.layers[0].placements[0]
  await page.keyboard.press('ArrowRight')
  await expect.poll(async()=>(await stored(page)).design.layers[0].placements[0].row).toBe(before.row-1)
  await page.getByLabel('Import project JSON').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"design":{}}')})
  await expect(page.getByRole('status')).toContainText('Import failed');await count(page,1)
  const sample=negroniProject()
  await page.getByLabel('Import project JSON').setInputFiles({name:'sample.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sample))})
  await page.getByRole('button',{name:'Replace composition',exact:true}).click()
  await expect(page.getByRole('textbox',{name:'Design name'})).toHaveValue('Negroni study')
  await page.getByRole('button',{name:'Undo',exact:true}).click();await count(page,1)
})

test('pass management, reordering and hidden layers still reserve inventory',async({page})=>{
  await open(page)
  await page.getByRole('button',{name:'PX-001 square, 16 remaining'}).click();await clickCell(page,5,5);await count(page,1)
  await page.getByRole('button',{name:'Hide Red ink'}).click()
  await expect(page.getByRole('button',{name:'PX-001 square, 15 remaining'})).toBeVisible()
  await page.getByRole('button',{name:'Add ink pass'}).click()
  await page.getByLabel('Pass name',{exact:true}).fill('Blue')
  await page.getByLabel('Ink colour',{exact:true}).fill('#123456')
  await page.getByRole('button',{name:'PX-001 square, 15 remaining'}).click();await clickCell(page,5,5);await count(page,2)
  await page.getByRole('button',{name:'↑ Earlier'}).click()
  await expect.poll(async()=>(await stored(page)).design.layers[0].name).toBe('Blue')
  await page.getByRole('button',{name:'Remove',exact:true}).click();await count(page,1)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await count(page,2)
})

test('mobile layout remains usable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});await open(page,negroniProject())
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await expect(page.getByTestId('plate')).toBeVisible()
  await page.screenshot({path:'test-results/mobile.png',fullPage:true})
  await page.getByLabel('Orientation',{exact:true}).selectOption('landscape')
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
})
