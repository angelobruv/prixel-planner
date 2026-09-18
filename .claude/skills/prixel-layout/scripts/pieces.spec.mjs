import { test } from '@playwright/test'

/* Contact sheet: every placeable piece at every rotation, on the cell grid.
 * Descriptions like "quarter circle" do not tell you which corner the piece
 * hugs or which edge a line sits on, and guessing costs more than looking. */
test('pieces', async ({ page }) => {
  await page.goto('/')
  const only = (process.env.PRIXEL_SKUS || '').split(',').filter(Boolean)
  const html = await page.evaluate(async skus => {
    const art = await import('/src/art.ts'), m = await import('/src/model.ts')
    const cell = skus.length ? 74 : 38
    const list = (skus.length ? skus.map(s => m.BY_SKU[s]) : m.PIECES).filter(p => p?.svg && !p.glyph)
    return list.map(p => {
      const cells = [0, 90, 180, 270].map(r => {
        const b = r % 180 ? { w: p.cells_h, h: p.cells_w } : { w: p.cells_w, h: p.cells_h }
        const t = m.placementTransform({ id: 'x', sku: p.code, col: 0, row: 0, rotation: r })
        const grid = [...Array(b.w + 1)].map((_, i) => `<path d="M${i} 0V${b.h}"/>`).join('')
          + [...Array(b.h + 1)].map((_, i) => `<path d="M0 ${i}H${b.w}"/>`).join('')
        return `<div class="c"><svg width="${b.w * cell}" height="${b.h * cell}"
          viewBox="-.04 -.04 ${b.w + .08} ${b.h + .08}">
          <g transform="${t}" color="${p.fill || '#333'}">
            <g transform="scale(${art.artworkScale(p.code)})">${art.artwork(p.code)}</g></g>
          <g stroke="#c33" stroke-width=".012" fill="none" opacity=".75">${grid}</g>
          </svg><i>r${r}</i></div>`
      }).join('')
      return `<section><h3>${p.code} &middot; ${p.cells_w}&times;${p.cells_h} &middot; ${p.description}
        <em>${p.family}</em></h3><div class="row">${cells}</div></section>`
    }).join('')
  }, only)
  await page.setContent(`<style>
    body{background:#fff;font:13px system-ui;margin:20px}
    section{margin:0 0 14px;border-top:1px solid #eee;padding-top:8px}
    h3{font:600 12px ui-monospace,monospace;margin:0 0 6px}
    h3 em{color:#888;font-style:normal;font-weight:400;margin-left:8px}
    .row{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
    .c{text-align:center}.c svg{background:#f6eedc;outline:1px solid #ddd;display:block}
    i{font:10px ui-monospace,monospace;color:#999;font-style:normal}
  </style>${html}`)
  await page.screenshot({ path: process.env.PRIXEL_OUT, fullPage: true })
  console.log('\n  wrote    ' + process.env.PRIXEL_OUT + '\n')
})
