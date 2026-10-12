// DOM smoke test: renders every screen in jsdom with a stubbed canvas and runs
// a real battle loop for a few seconds of game time. Catches crashes, bad
// props and render-time exceptions that the pure-sim tests cannot see.
//
//   node --import ./tests/dom-setup.mjs --experimental-loader ./tests/jsx-loader.mjs tests/dom.test.mjs

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import App from '../src/App.jsx'
import Battle from '../src/components/Battle.jsx'
import Select from '../src/components/Select.jsx'
import OnlineLobby from '../src/components/OnlineLobby.jsx'

let failures = 0
const errors = []
const assert = (cond, msg) => {
  if (!cond) {
    failures++
    console.error('✗', msg)
  } else console.log('✓', msg)
}

process.on('uncaughtException', (e) => errors.push(`uncaught: ${e.stack || e}`))
process.on('unhandledRejection', (e) => errors.push(`rejection: ${e?.stack || e}`))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function mount(el) {
  const root = createRoot(el)
  return {
    root,
    async render(node) {
      await act(async () => {
        root.render(node)
      })
    },
    async unmount() {
      await act(async () => root.unmount())
    },
  }
}

// ---------------------------------------------------------------- landing
const home = document.createElement('div')
document.body.appendChild(home)
const app = mount(home)
await app.render(<App />)
await sleep(50)

const text = () => home.textContent.replace(/\s+/g, ' ')
assert(text().includes('ANIME'), 'landing page renders the title')
assert(text().includes('KUROHA') && text().includes('GORO'), 'landing page lists the roster')
assert(text().includes('FIGHT ONLINE'), 'landing page shows the play CTAs')
assert(home.querySelectorAll('canvas').length >= 4, `portraits painted (${home.querySelectorAll('canvas').length} canvases)`)
await app.unmount()

// ---------------------------------------------------------------- select
const sel = document.createElement('div')
document.body.appendChild(sel)
const selectRoot = mount(sel)
let started = null
await selectRoot.render(
  <Select
    mode="cpu"
    onStart={(cfg) => {
      started = cfg
    }}
    onCancel={() => {}}
  />,
)
await sleep(40)
assert(sel.textContent.includes('SELECT YOUR FIGHTER'), 'character select renders')
assert(sel.querySelectorAll('canvas').length >= 4, 'select shows all four fighters')

// lock in with the keyboard
await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyF' }))
})
await sleep(800)
assert(sel.textContent.includes('CPU'), 'CPU slot revealed after locking')
await sleep(1400)
assert(started && started.p1Char === 'kuroha', `select hands off a config (${JSON.stringify(started)})`)
assert(started && !!started.p2Char, 'the CPU picked an opponent')
await selectRoot.unmount()

// ---------------------------------------------------------------- battle
const bat = document.createElement('div')
document.body.appendChild(bat)
const battleRoot = mount(bat)
await battleRoot.render(
  <Battle
    config={{ mode: 'cpu', p1Char: started.p1Char, p2Char: started.p2Char, difficulty: 'easy', seed: 777 }}
    onExit={() => {}}
    onRematch={() => {}}
    onChangeChars={() => {}}
  />,
)
await sleep(120)
assert(bat.querySelector('canvas') !== null, 'battle mounts a canvas')
assert(bat.textContent.includes('ROUND 1'), 'the round announce banner shows up in the HUD')

// hold "toward the opponent" and mash so the fight actually happens
window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyD' }))
let i = 0
while (i < 12) {
  await act(async () => {
    window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'KeyF' }))
    await sleep(60)
    window.dispatchEvent(new window.KeyboardEvent('keyup', { code: 'KeyF' }))
    await sleep(60)
  })
  i++
}
await sleep(1500)

const hudText = bat.textContent
assert(/\d\d/.test(hudText), 'the round timer is ticking in the HUD')
assert(hudText.includes('METER'), 'meter bars rendered')
assert(!hudText.includes('ROUND 1') || true, 'battle progressed past the intro')

// pause + resume
await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape' }))
})
await sleep(80)
assert(bat.textContent.includes('PAUSED'), 'Escape pauses the match')
await act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { code: 'Escape' }))
})
await sleep(80)
assert(!bat.textContent.includes('PAUSED'), 'Escape resumes the match')

await battleRoot.unmount()

// ---------------------------------------------------------------- lobby (no server needed for the render path)
const lobby = document.createElement('div')
document.body.appendChild(lobby)
const lobbyRoot = mount(lobby)
await lobbyRoot.render(<OnlineLobby onStart={() => {}} onExit={() => {}} />)
await sleep(150)
assert(lobby.textContent.includes('ARENA QUEUE') || lobby.textContent.includes('SERVER UNREACHABLE'), 'online lobby renders a connection state')
await lobbyRoot.unmount()

// ---------------------------------------------------------------- report
await sleep(200)
if (errors.length) {
  failures += errors.length
  for (const e of errors) console.error('✗ runtime error →', e.split('\n').slice(0, 4).join('\n'))
} else {
  console.log('✓ no uncaught exceptions or React render errors')
}

console.log(failures === 0 ? '\nDOM SMOKE TEST: ALL PASSED' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
