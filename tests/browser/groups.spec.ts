import { expect, test, type Page } from '@playwright/test'
import { blankProject } from '../../src/model'
import type { Placement, Project } from '../../src/types'
const key='prixel-planner-v1'
const piece=(id:string,sku:string,col:number,row:number):Placement=>({id,sku,col,row,rotation:0})
const sourceProject=()=>{const p=blankProject();p.design.name='Motif';p.design.layers[0].placements=[piece('a','PX-002',-35,60),piece('b','PX-001',-33,61)];return p}
async function open(page:Page,p=blankProject()){
  await page.addInitScript(({key,p})=>localStorage.setItem(key,JSON.stringify(p)),{key,p});await page.goto('/')
}
async function saved(page:Page):Promise<Project>{return page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key)}
async function importFile(page:Page,p:Project){await page.getByLabel('Import project JSON').setInputFiles({name:'motif.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(p))})}
async function add(page:Page,p=sourceProject()) {await importFile(page,p);await page.getByRole('button',{name:'Add to current pass',exact:true}).click();await expect(page.getByTestId('floating-group')).toBeVisible()}
async function point(page:Page,x:number,y:number){const box=(await page.getByTestId('plate').boundingBox())!;const vb=(await page.getByTestId('plate').getAttribute('viewBox'))!.split(' ').map(Number);return{x:box.x+x/vb[2]*box.width,y:box.y+y/vb[3]*box.height}}
async function rect(page:Page){const g=page.getByTestId('group-bounds');return{x:Number(await g.getAttribute('x')),y:Number(await g.getAttribute('y')),w:Number(await g.getAttribute('width')),h:Number(await g.getAttribute('height'))}}
async function dragBy(page:Page,dx:number,dy:number){const r=await rect(page);const a=await point(page,r.x+.5,r.y+.5),b=await point(page,r.x+.5+dx,r.y+.5+dy);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up()}
async function cell(page:Page,x:number,y:number){const p=await point(page,x+.5,y+.5);await page.mouse.click(p.x,p.y)}

test('add imports a movable normalised transaction with fresh IDs and a single undo',async({page})=>{
  const original=blankProject();original.design.name='Existing wordmark';original.design.layers[0].placements=[piece('a','PX-004',3,3)]
  await open(page,original);await add(page)
  const start=await rect(page);expect(start).toEqual({x:10,y:7,w:3,h:2})
  expect(await saved(page)).toEqual(original)
  await dragBy(page,2,2);expect(await rect(page)).toEqual({...start,x:12,y:9})
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('r')
  expect((await rect(page)).w).toBe(2);expect((await rect(page)).h).toBe(3)
  expect(await saved(page)).toEqual(original)
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('floating-group')).toHaveCount(0)
  await expect.poll(async()=>(await saved(page)).design.layers[0].placements.length).toBe(3)
  const result=await saved(page)
  expect(result.inventory).toEqual(original.inventory);expect(result.design.name).toBe('Existing wordmark')
  expect(result.design.layers[0].placements[0]).toEqual(original.design.layers[0].placements[0])
  expect(result.design.layers[0].placements.slice(1).every(p=>!['a','b'].includes(p.id))).toBe(true)
  expect(new Set(result.design.layers[0].placements.map(p=>p.id)).size).toBe(3)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Redo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(result)
})

test('live corner, bounds and existing-footprint errors block Enter and click; Esc cancels',async({page})=>{
  const original=blankProject();original.design.layers[0].placements=[piece('old','PX-001',10,7)]
  await open(page,original);await add(page)
  await expect(page.getByRole('status')).toContainText('overlaps existing')
  await expect(page.getByRole('button',{name:'Place group Enter'})).toBeDisabled()
  await page.keyboard.press('Enter');await cell(page,12,7)
  expect(await saved(page)).toEqual(original)
  await dragBy(page,-10,-6)
  await expect(page.getByRole('status')).toContainText('blocked corner')
  await page.keyboard.press('ArrowLeft')
  await expect(page.getByRole('status')).toContainText('off the plate')
  await page.screenshot({path:'test-results/group-invalid.png',fullPage:true})
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('floating-group')).toHaveCount(0)
  expect(await saved(page)).toEqual(original)
  await expect(page.getByRole('button',{name:'Undo',exact:true})).toBeDisabled()
})

test('arc and disc that nest on separate source passes collide when added to one pass',async({page})=>{
  const original=blankProject();const source=blankProject()
  source.design.layers[0].placements=[piece('arc','PX-017',5,5)]
  source.design.layers.push({id:'disc-pass',name:'Orange',ink:'#F07E26',placements:[piece('disc','PX-012',6,6)]})
  await open(page,original);await add(page,source)
  await expect(page.getByRole('status')).toContainText('PX-012 collides with PX-017 inside the group')
  await page.keyboard.press('r');await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button',{name:'Place group Enter'})).toBeDisabled()
  await page.keyboard.press('Enter');expect(await saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Cancel Esc'}).click()
  expect(await saved(page)).toEqual(original)
})

for(const mode of ['concurrent','reuse'] as const)test(`group inventory uses current ${mode} policy, never the imported inventory`,async({page})=>{
  const pj=blankProject();pj.inventory['PX-001']=2;pj.design.inventoryMode=mode
  pj.design.layers.push({id:'other',name:'Other',ink:'#112233',placements:[piece('old','PX-001',3,3)]})
  const source=blankProject();source.inventory['PX-001']=100;source.design.layers[0].placements=[piece('x','PX-001',70,70),piece('y','PX-001',71,70)]
  await open(page,pj);await add(page,source)
  const commit=page.getByRole('button',{name:'Place group Enter'})
  if(mode==='concurrent'){await expect(commit).toBeDisabled();await expect(page.getByRole('status')).toContainText('Inventory exhausted for PX-001: need 3, own 2')}
  else {await expect(commit).toBeEnabled();await cell(page,11,7);await expect.poll(async()=>(await saved(page)).design.layers[0].placements.length).toBe(2)}
})

test('Shift-click existing pieces uses the same transaction and does not double-count owned pieces',async({page})=>{
  const original=blankProject();original.inventory['PX-001']=2;original.design.layers[0].placements=[piece('a','PX-001',4,4),piece('b','PX-001',5,4)]
  await open(page,original)
  await cell(page,4,4);await page.keyboard.down('Shift');await cell(page,5,4);await page.keyboard.up('Shift')
  await page.getByRole('button',{name:'Move selection (2)'}).click()
  await page.keyboard.press('ArrowRight');expect(await saved(page)).toEqual(original)
  await expect(page.getByRole('button',{name:'Place group Enter'})).toBeEnabled()
  await page.keyboard.press('Escape');expect(await saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Move selection (2)'}).click();await dragBy(page,2,2)
  await page.getByRole('button',{name:'Place group Enter'}).click()
  const expected=structuredClone(original);expected.design.layers[0].placements=expected.design.layers[0].placements.map(p=>({...p,col:p.col+2,row:p.row+2}))
  await expect.poll(()=>saved(page)).toEqual(expected)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(original)
})

test('import replacement is explicit and empty additions are disabled',async({page})=>{
  const original=blankProject();await open(page,original);const empty=blankProject();empty.design.name='Replacement'
  await importFile(page,empty)
  await expect(page.getByRole('button',{name:'Add to current pass',exact:true})).toBeDisabled()
  expect(await saved(page)).toEqual(original)
  await page.getByRole('button',{name:'Replace composition',exact:true}).click()
  await expect.poll(()=>saved(page)).toEqual(empty)
  await page.getByRole('button',{name:'Undo',exact:true}).click();await expect.poll(()=>saved(page)).toEqual(original)
})

test('portrait nudge follows the screen and mobile group controls fit',async({page})=>{
  await page.setViewportSize({width:390,height:844})
  const original=blankProject();original.design.orientation='portrait'
  await open(page,original);await add(page)
  const before=await rect(page);await page.keyboard.press('ArrowRight')
  expect(await rect(page)).toEqual({...before,y:before.y-1})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true)
  await page.screenshot({path:'test-results/group-mobile.png',fullPage:true})
  await page.keyboard.press('Escape');expect(await saved(page)).toEqual(original)
})
