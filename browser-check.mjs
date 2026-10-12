// Real-browser check: drives the actual site with Chromium, records any console
// error, and saves screenshots of every screen so the visuals can be reviewed.
//
//   node tests/browser-check.mjs   (needs `npm run dev` and `npm run server`)

import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE_URL || 'http://127.0.0.1:5173'
const OUT = new URL('../shots/', import.meta.url).pathname
mkdirSync(OUT, { recursive: true })

const problems = []
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console.error: ${m.text()}`)
})
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`))
page.on('requestfailed', (r) => problems.push(`requestfailed: ${r.url()} — ${r.failure()?.errorText}`))

const shot = (name) => page.screenshot({ path: `${OUT}${name}.png` })
const wait = (ms) => page.waitForTimeout(ms)

// ---------------- landing ----------------
await page.goto(BASE, { waitUntil: 'networkidle' })
await wait(1200)
await shot('01-landing')
console.log('title:', await page.title())
console.log('hero heading:', (await page.locator('h1').first().innerText()).replace(/\n/g, ' '))

await page.evaluate(() => document.querySelector('#roster').scrollIntoView())
await wait(900)
await shot('02-roster')

await page.evaluate(() => document.querySelector('#controls').scrollIntoView())
await wait(700)
await shot('03-controls')

// ---------------- character select (VS CPU) ----------------
await page.evaluate(() => window.scrollTo(0, 0))
await wait(300)
await page.getByRole('button', { name: /VS CPU/i }).first().click()
await wait(900)
await shot('04-select')

// pick the third character, then lock
await page.keyboard.press('KeyD')
await wait(150)
await page.keyboard.press('KeyD')
await wait(300)
await shot('05-select-cursor')
await page.keyboard.press('KeyF')
await wait(2600)
await shot('06-battle-intro')

// ---------------- fight ----------------
await page.keyboard.down('KeyD')
for (let i = 0; i < 26; i++) {
  await page.keyboard.press('KeyF')
  await wait(70)
  if (i % 7 === 6) {
    await page.keyboard.press('KeyG')
    await wait(120)
  }
}
await page.keyboard.up('KeyD')
await wait(120)
await shot('07-battle-fight')

// land a heavy + special for the FX
await page.keyboard.press('KeyG')
await wait(180)
await shot('08-attack-fx')
await page.keyboard.press('KeyH')
await wait(220)
await shot('09-special-fx')

// pause overlay
await page.keyboard.press('Escape')
await wait(400)
await shot('10-pause')
await page.keyboard.press('Escape')
await wait(200)

// ---------------- local versus ----------------
await page.getByRole('button', { name: /QUIT/i }).first().click()
await wait(600)
await page.getByRole('button', { name: /LOCAL VERSUS/i }).first().click()
await wait(700)
await shot('11-select-versus')

await browser.close()

console.log('\nscreenshots →', OUT)
if (problems.length) {
  console.error(`\n${problems.length} BROWSER PROBLEM(S):`)
  for (const p of [...new Set(problems)].slice(0, 20)) console.error(' ✗', p)
  process.exit(1)
}
console.log('✓ no console errors, page errors or failed requests')
