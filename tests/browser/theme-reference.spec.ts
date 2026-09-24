import { expect, test } from '@playwright/test'
import path from 'node:path'

const SHOT = process.env.SHOT_DIR
const fixture = path.resolve('tests/browser/fixtures/reference.png')
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (SHOT) await page.screenshot({ path: `${SHOT}/${name}.png` })
}

test.describe('theme', () => {
  test('cycles Auto → Light → Dark, and a pinned theme survives reload', async ({ page }) => {
    await page.goto('/')
    const toggle = page.locator('.theme-toggle')
    await expect(toggle).toHaveText(/Auto/)
    await toggle.click(); await expect(toggle).toHaveText(/Light/)
    await toggle.click(); await expect(toggle).toHaveText(/Dark/)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    const ground = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor)).toBe(ground)
    await shot(page, 'dark')
    await toggle.click()
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /./)
  })

  test('Auto follows the operating system', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' })
    const page = await ctx.newPage()
    await page.goto('/')
    const dark = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)
    expect(dark).toBe('dark')
    await ctx.close()
  })

  test('the paper keeps its real colour in dark mode', async ({ page }) => {
    await page.goto('/')
    const paper = () => page.locator('.paper').evaluate(el => getComputedStyle(el).backgroundColor)
    const light = await paper()
    await page.locator('.theme-toggle').click(); await page.locator('.theme-toggle').click()
    expect(await paper()).toBe(light)
  })
})

test.describe('reference image', () => {
  test('sits behind the pieces, adjusts, stays out of the build sheet, and persists', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Load the Negroni study' }).click()
    await page.setInputFiles('input[aria-label="Choose a reference image"]', fixture)
    const img = page.getByTestId('reference-image')
    await expect(img).toBeVisible()
    // Behind: it must come before the first design layer in paint order.
    const behind = await page.evaluate(() => {
      const i = document.querySelector('[data-testid="reference-image"]')!
      const layer = document.querySelector('svg.plate g[color]')!
      return !!(i.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING)
    })
    expect(behind).toBe(true)

    await page.locator('#ref-opacity').fill('0.8')
    await expect(img).toHaveAttribute('opacity', '0.8')
    const before = Number(await img.getAttribute('width'))
    await page.locator('#ref-scale').fill('2')
    expect(Number(await img.getAttribute('width'))).toBeCloseTo(before * 2)
    await shot(page, 'reference-light')

    await page.getByRole('button', { name: 'Build sheet ⇄' }).click()
    await expect(img).toHaveCount(0)
    await page.getByRole('button', { name: 'Design' }).click()

    await page.reload()
    await expect(page.getByTestId('reference-image')).toHaveAttribute('opacity', '0.8')
    await page.getByRole('button', { name: 'Remove image' }).click()
    await expect(page.getByTestId('reference-image')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Add reference image' })).toBeVisible()
  })

  test('refuses a file that is not an image', async ({ page }) => {
    await page.goto('/')
    await page.setInputFiles('input[aria-label="Choose a reference image"]',
      { name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') })
    await expect(page.locator('.feedback')).toContainText('notes.txt is not an image')
    await expect(page.getByTestId('reference-image')).toHaveCount(0)
  })
})

test('an enlarged reference is cropped to the paper', async ({ page }) => {
  await page.goto('/')
  await page.setInputFiles('input[aria-label="Choose a reference image"]', path.resolve('tests/browser/fixtures/reference.png'))
  await page.locator('#ref-scale').fill('3')
  // Bounding boxes report an SVG's content whether or not it is clipped, so
  // assert the mechanism: the image sits in a hidden-overflow viewport exactly
  // the size of the plate.
  const crop = await page.getByTestId('reference-image').evaluate(img => {
    const box = img.parentElement as unknown as SVGSVGElement
    const [, , w, h] = (document.querySelector('svg.plate')!.getAttribute('viewBox') ?? '').split(' ').map(Number)
    return { overflow: box.getAttribute('overflow'), w: Number(box.getAttribute('width')), h: Number(box.getAttribute('height')), plateW: w, plateH: h }
  })
  expect(crop.overflow).toBe('hidden')
  expect([crop.w, crop.h]).toEqual([crop.plateW, crop.plateH])
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/reference-cropped.png` })
})
