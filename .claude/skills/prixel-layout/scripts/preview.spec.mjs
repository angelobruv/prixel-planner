import { test } from '@playwright/test'
import fs from 'node:fs'

/* Imports a project into the running planner, reports what the app itself says
 * about it, and screenshots the plate. The app is the authority on whether a
 * layout is legal — re-deriving the overlap and inventory rules here would give
 * you a second opinion that can quietly drift from the real one. */
test('preview', async ({ page }) => {
  const file = process.env.PRIXEL_JSON, out = process.env.PRIXEL_OUT
  const text = fs.readFileSync(file, 'utf8')
  await page.goto('/')

  const report = await page.evaluate(async src => {
    const m = await import('/src/model.ts')
    const project = m.parseProject(src)
    return {
      issues: m.validate(project).map(i => i.message),
      short: Object.entries(m.requiredInventory(project.design))
        .filter(([k, n]) => (project.inventory[k] ?? 0) < n)
        .map(([k, n]) => `${k} needs ${n}, kit has ${project.inventory[k] ?? 0}`),
      passes: project.design.layers.map(l => `${l.name} ${l.placements.length}`),
    }
  }, text)

  await page.setInputFiles('input[aria-label="Import project JSON"]', file)
  await page.getByRole('button', { name: 'Replace composition' }).click()
  if (process.env.PRIXEL_VIEW === 'build')
    await page.getByRole('button', { name: 'Build sheet \u21c4' }).click()
  if (process.env.PRIXEL_GRID !== '1')
    await page.locator('label:has-text("Grid") input').uncheck()

  const svg = page.locator('svg.plate')
  await page.screenshot({ path: out, clip: (await svg.boundingBox()) ?? undefined })

  console.log('\n  passes   ' + report.passes.join('  |  '))
  console.log('  plate    ' + (await page.locator('.canvas-footer').innerText()).split('\n').pop())
  if (report.issues.length) console.log('  INVALID  ' + report.issues.join('  |  '))
  else console.log('  valid    no overlaps, everything on the plate')
  if (report.short.length) console.log('  SHORT    ' + report.short.join('  |  '))
  console.log('  wrote    ' + out + '\n')
})
