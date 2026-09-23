import { chromium } from 'playwright'

const BASE = 'http://localhost:5199/'
const errors = []

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } })
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push('console: ' + msg.text())
})
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message))
page.on('dialog', (d) => d.accept())

await page.goto(BASE, { waitUntil: 'networkidle' })

const cards = await page.locator('.card').count()
console.log('cards iniciales:', cards)
console.log('título h1 inicial:', await page.locator('.doc-title').first().innerText())
console.log('idioma default EN:', await page.locator('.view-toggle button.on').innerText())

// toggle a ES (placeholder cambia)
await page.locator('.lang-toggle button', { hasText: 'ES' }).click()
await page.waitForTimeout(200)
console.log('placeholder EN->ES:', (await page.locator('.search').getAttribute('placeholder')).includes('Buscar'))
console.log('vista ES:', await page.locator('.view-toggle button.on').innerText())
await page.locator('.lang-toggle button', { hasText: 'EN' }).click()
await page.waitForTimeout(200)
console.log('placeholder ES->EN:', (await page.locator('.search').getAttribute('placeholder')).includes('Search'))

// navegar a SalseoGame -> recomendaciones (minúsculas)
await page.getByRole('button', { name: /SalseoGame/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /recomend/i }).first().click()
await page.waitForTimeout(400)
console.log('doc actual:', await page.locator('.crumb-doc').innerText())
console.log('chips de estado (filtro):', await page.locator('.fchip.on, .fchip').count())
console.log('summary rows:', await page.locator('.summary-row').count())

// cambiar a Impostor-Game -> RECOMENDACIONES (mayúsculas)
await page.getByRole('button', { name: /Impostor-Game/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /RECOMEND/i }).first().click()
await page.waitForTimeout(300)
console.log('impostor doc:', await page.locator('.crumb-doc').innerText())
console.log('chips de estado (sin|con filtros):', await page.locator('.fchip').count())

// ---- Canvas ----
await page.getByRole('button', { name: '◧ Canvas' }).click()
await page.waitForTimeout(500)
console.log('canvas cards:', await page.locator('.canvas-card').count())
await page.locator('.canvas-card').first().click()
await page.waitForTimeout(400)
console.log('inspector abierto:', (await page.locator('.inspector').count()) === 1)
await page.locator('.inspector .btn-icon').click()
await page.waitForTimeout(200)

// ---- Tablero + edición ----
await page.getByRole('button', { name: '⧉ Board' }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /SalseoGame/ }).click()
await page.waitForTimeout(300)
await page.getByRole('button', { name: /recomend/i }).first().click()
await page.waitForTimeout(300)

const editBtn = page.locator('.card:not(.intro):not(.summary) .btn-icon[aria-label="Edit section"]').first()
await editBtn.click()
await page.waitForTimeout(200)
const ta = page.locator('.editor textarea').first()
console.log('textarea editable:', (await ta.count()) === 1)
const edited = await ta.inputValue()
await ta.fill(`${edited}\n\n> Editado desde el board`)
await page.getByRole('button', { name: 'Save', exact: true }).click()
await page.waitForTimeout(300)
console.log('card marcada como editada:', (await page.locator('.card.edited').count()) > 0)
const storage = await page.evaluate(() => ({
  edits: localStorage.getItem('pb:edits'),
  ui: localStorage.getItem('pb:ui'),
}))
console.log('localStorage pb:edits:', storage.edits)
console.log('localStorage pb:ui:', storage.ui)

const dlPromise = page.waitForEvent('download')
await page.getByRole('button', { name: '⬇️ Export' }).click()
const download = await dlPromise
const dlPath = await download.path()
const fs = await import('fs')
const content = fs.readFileSync(dlPath, 'utf8')
console.log('export contiene edición:', content.includes('Editado desde el board'))
console.log('export mantiene tabla resumen:', content.includes('| # | Tema | Estado |'))
const ri = content.indexOf('Resumen')
let content0 = content
console.log('snippet resumen:', ri === -1 ? 'SIN RESUMEN' : JSON.stringify(content.slice(ri, ri + 120)).replace(/\\n/g, '\n'))
fs.writeFileSync('/tmp/opencode/exported.md', content0)

await page.getByRole('button', { name: '↺ Reset' }).click()
await page.waitForTimeout(300)
console.log('tras reset, cards editadas:', await page.locator('.card.edited').count())

// phone preview
await page.getByRole('button', { name: /App/ }).click()
await page.waitForTimeout(400)
console.log('phone preview visible:', (await page.locator('.phone-frame').count()) === 1)
await page.getByRole('button', { name: '✕ Close preview' }).click()

// búsqueda
await page.locator('.search').fill('GameContext')
await page.waitForTimeout(300)
const boardCards = await page.locator('.board > .card').count()
console.log('cards tras búsqueda GameContext:', boardCards)

await page.screenshot({ path: '/tmp/opencode/board.png' })
await browser.close()

if (errors.length) {
  console.log('ERRORES:', errors)
  process.exitCode = 1
} else {
  console.log('ERRORES: ninguno')
}