// End-to-end netcode test: two real WebSocket clients go through the Vite
// proxy into the arena server, get matched, pick characters, then verify that
// both browsers end up simulating a byte-identical fight.
//
//   node tests/online.test.mjs   (requires `npm run dev` + `npm run server`)

import WebSocket from 'ws'
import { createMatch, stepMatch } from '../src/game/sim.js'
import { B_RIGHT, B_LIGHT, B_LEFT } from '../src/game/constants.js'

const URL = process.env.ARENA_URL || 'ws://127.0.0.1:5173/ws'

function client(name) {
  const ws = new WebSocket(URL)
  const c = {
    name,
    ws,
    log: [],
    state: null,
    picks: null,
    seed: null,
    player: -1,
    inbox: new Map(),
    open: new Promise((res, rej) => {
      ws.on('open', res)
      ws.on('error', rej)
    }),
  }
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString())
    c.log.push(msg.t)
    if (msg.t === 'welcome') c.player = msg.player
    if (msg.t === 'matched') {
      c.state = 'matched'
      c.seed = msg.seed
      c.player = msg.player
    }
    if (msg.t === 'start') {
      c.state = 'start'
      c.picks = msg.picks
      c.seed = msg.seed
    }
    if (msg.t === 'in') put(c.inbox, msg.f, msg.i, msg.b)
    if (msg.t === 'batch') for (const e of msg.list) put(c.inbox, e.f, e.i, e.b)
  })
  return c
}

function put(map, frame, idx, bits) {
  if (!map.has(frame)) map.set(frame, [null, null])
  map.get(frame)[idx] = bits
}

const send = (c, obj) => c.ws.send(JSON.stringify(obj))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let failures = 0
const assert = (cond, msg) => {
  if (!cond) {
    failures++
    console.error('✗', msg)
  } else console.log('✓', msg)
}

const a = client('A')
const b = client('B')

await Promise.all([a.open, b.open])
assert(true, 'both clients connected through the Vite /ws proxy')

send(a, { t: 'hello' })
send(b, { t: 'hello' })
await sleep(120)

send(a, { t: 'queue' })
await sleep(150)
assert(a.state !== 'matched', 'a lone player waits in the queue')

send(b, { t: 'queue' })
await sleep(250)
assert(a.state === 'matched' && b.state === 'matched', 'the second player triggers matchmaking')
assert(a.seed === b.seed && a.seed != null, `both sides received the same seed (${a.seed})`)
assert(a.player !== b.player, `sides were assigned (A=${a.player}, B=${b.player})`)

send(a, { t: 'ready', charId: 'kuroha' })
await sleep(100)
assert(b.log.includes('pick'), 'the opponent sees your pick in real time')
send(b, { t: 'ready', charId: 'renji' })
await sleep(250)
assert(a.state === 'start' && b.state === 'start', 'the match starts once both players are ready')
assert(JSON.stringify(a.picks) === JSON.stringify(b.picks), `both got the same picks (${a.picks})`)

// --- run an identical lockstep fight on both "browsers" -------------------
const simA = createMatch(a.picks[0], a.picks[1], a.seed)
const simB = createMatch(b.picks[0], b.picks[1], b.seed)
const script = (f, side) => {
  let bits = f % 2 === 0 ? (side === 0 ? B_RIGHT : B_LEFT) : 0
  if (f % 19 === side * 3) bits |= B_LIGHT
  return bits
}

let frame = 0
const FRAMES = 900
while (frame < FRAMES && simA.phase !== 'matchEnd') {
  const ia = script(frame, 0)
  const ib = script(frame, 1)
  send(a, { t: 'in', list: [{ f: frame, b: a.player === 0 ? ia : ib }] })
  send(b, { t: 'in', list: [{ f: frame, b: b.player === 0 ? ia : ib }] })

  stepMatch(simA, [ia, ib])
  stepMatch(simB, [ia, ib])
  frame++
  if (frame % 60 === 0) await sleep(8) // let the sockets breathe
}

await sleep(300)

const sig = (m) =>
  [m.frame, m.phase, m.roundWins.join('-'), m.roundTimer.toFixed(3),
   m.fighters[0].x.toFixed(6), m.fighters[0].hp, m.fighters[0].meter.toFixed(6), m.fighters[0].state,
   m.fighters[1].x.toFixed(6), m.fighters[1].hp, m.fighters[1].meter.toFixed(6), m.fighters[1].state,
  ].join('|')

assert(sig(simA) === sig(simB), `both browsers simulated ${frame} identical frames`)
assert(a.inbox.size > 0 && b.inbox.size > 0, `inputs were relayed both ways (A received ${a.inbox.size}, B received ${b.inbox.size})`)
const relayed = [...a.inbox.values()].flat().filter((x) => x !== null).length
assert(relayed > frame * 0.9, `${relayed}/${frame} relayed inputs arrived for A`)

a.ws.close()
b.ws.close()
await sleep(150)

console.log(failures === 0 ? '\nONLINE NETCODE: ALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
