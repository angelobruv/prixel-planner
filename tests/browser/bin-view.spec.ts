import { expect, test } from '@playwright/test'

/** In the build-sheet view you are at the box, not at the press: the plate has
 *  to show the colours the pieces are actually moulded in, not the pass ink. */
test.describe('piece colours in the build-sheet view', () => {
  const groupFor = (page: import('@playwright/test').Page, sku: string) =>
    page.locator(`.plate g[transform][data-sku="${sku}"]`)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Load the Negroni study' }).click()
    await page.getByRole('button', { name: 'Build sheet ⇄' }).click()
  })

  test('defaults to the sort-bin colour, and the ink is one click away', async ({ page }) => {
    const square = groupFor(page, 'PX-003').first()
    const arc = groupFor(page, 'PX-012').first()
    await expect(page.getByLabel('Piece colours')).toBeChecked()
    await expect(square).toHaveCSS('color', 'rgb(252, 238, 33)')   // Square bin, yellow
    await expect(arc).toHaveCSS('color', 'rgb(63, 169, 245)')      // Circle & Arc bin, blue

    await page.getByLabel('Piece colours').uncheck()
    const ink = await square.evaluate(el => getComputedStyle(el).color)
    expect(ink).not.toBe('rgb(252, 238, 33)')
    expect(await arc.evaluate(el => getComputedStyle(el).color)).toBe(ink)  // one pass, one ink
  })

  test('is offered only where it means something', async ({ page }) => {
    await page.getByRole('button', { name: 'Design' }).click()
    await expect(page.getByLabel('Piece colours')).toHaveCount(0)
  })
})
