// Headless smoke test for the simulation. Run with: node tests/sim.test.mjs
// Verifies determinism (two runs of the same inputs match exactly), that a
// match terminates, and that damage/blocking/meter all behave.

import { createMatch, stepMatch, snapshot } from '../src/game/sim.js'
import { CHARACTERS } from '../src/game/characters.js'
import { B_LEFT, B_RIGHT, B_LIGHT, B_HEAVY, B_SPECIAL, B_SUPER, B_UP, TICK } from '../src/game/constants.js'

function runMatch(seed, chars, scriptA, scriptB, maxFrames = 60 * 240) {
  const m = createMatch(chars[0], chars[1], seed)
  let f = 0
  const trace = []
  while (m.phase !== 'matchEnd' && f < maxFrames) {
    stepMatch(m, [scriptA(f), scriptB(f)])
    if (f % 37 === 0) trace.push(`${m.fighters[0].hp},${m.fighters[1].hp},${m.particles.length}`)
    f++
  }
  return { m, f, snap: snapshot(m), trace: trace.join('|') }
}

// a dumb but legal "AI" script: walk forward, mash attacks
const masher = (offset) => (f) => {
  let b = f % 2 === 0 ? B_RIGHT : 0
  if (offset) b = f % 2 === 0 ? B_LEFT : 0
  if (f % 23 === 0) b |= B_LIGHT
  if (f % 61 === 0) b |= B_HEAVY
  if (f % 97 === 0) b |= B_SPECIAL
  if (f % 140 === 0) b |= B_SUPER
  if (f % 211 === 0) b |= B_UP
  return b
}

let failures = 0
const assert = (cond, msg) => {
  if (!cond) {
    failures++
    console.error('✗', msg)
  } else console.log('✓', msg)
}

// --- determinism -----------------------------------------------------------
const sig = (m) => {
  const f = m.fighters
  return [
    m.frame, m.phase, m.roundWins.join(','), m.roundTimer,
    f[0].x.toFixed(4), f[0].y.toFixed(4), f[0].hp, f[0].meter.toFixed(4), f[0].state,
    f[1].x.toFixed(4), f[1].y.toFixed(4), f[1].hp, f[1].meter.toFixed(4), f[1].state,
    m.particles.length, m.projectiles.length,
  ].join('|')
}

const a = runMatch(4242, ['kuroha', 'renji'], masher(0), masher(1))
const b = runMatch(4242, ['kuroha', 'renji'], masher(0), masher(1))
assert(sig(a.m) === sig(b.m), 'same seed + same inputs → identical simulation (lockstep safe)')

const c = runMatch(9999, ['kuroha', 'renji'], masher(0), masher(1))
assert(a.trace !== c.trace, 'different seed → different damage rolls (RNG is actually seeded)')

// --- match flow ------------------------------------------------------------
assert(a.m.phase === 'matchEnd', `match reaches a conclusion (took ${(a.f / TICK).toFixed(1)}s of game time)`)
assert(a.snap.roundWins[0] === 2 || a.snap.roundWins[1] === 2, 'someone wins two rounds')
assert(a.snap.stats.damage[0] + a.snap.stats.damage[1] > 0, 'damage was dealt')
assert(a.snap.stats.hits[0] + a.snap.stats.hits[1] > 0, 'hits connected')

// --- blocking --------------------------------------------------------------
{
  const run = (guard) => {
    const m = createMatch('kuroha', 'goro', 7)
    for (let i = 0; i < TICK * 2 + 5; i++) stepMatch(m, [0, 0])
    const [p1, p2] = m.fighters
    let f = 0
    while (Math.abs(p1.x - p2.x) > 92 && f < 400) {
      // walk toward each other, computed per frame so sides never flip
      stepMatch(m, [p1.x < p2.x ? B_RIGHT : B_LEFT, p2.x < p1.x ? B_RIGHT : B_LEFT])
      f++
    }
    const start = p2.hp
    let blockFrames = 0
    for (let i = 0; i < 160; i++) {
      const p1Bits = i % 30 === 0 ? B_LIGHT : 0
      const p2Bits = guard ? (p2.x < p1.x ? B_LEFT : B_RIGHT) : 0
      stepMatch(m, [p1Bits, p2Bits])
      if (p2.state === 'block') blockFrames++
    }
    return { dmg: start - p2.hp, blockFrames }
  }

  const guarded = run(true)
  const unguarded = run(false)
  assert(guarded.blockFrames > 20, `guarding is a real state (${guarded.blockFrames} frames spent blocking)`)
  assert(guarded.dmg > 0 && guarded.dmg < 90, `blocked hits only chip (${guarded.dmg} damage over 5 guarded jabs)`)
  assert(unguarded.dmg > guarded.dmg * 2, `unguarded hits hurt far more (${unguarded.dmg} vs ${guarded.dmg})`)
}

// --- meter / super ---------------------------------------------------------
{
  const m = createMatch('renji', 'yuki', 11)
  for (let i = 0; i < TICK * 2 + 5; i++) stepMatch(m, [0, 0])
  let w = 0
  while (Math.abs(m.fighters[0].x - m.fighters[1].x) > 105 && w < 400) {
    stepMatch(m, [B_RIGHT, 0])
    w++
  }
  m.fighters[0].meter = 100
  const before = m.fighters[1].hp
  stepMatch(m, [B_SUPER, 0])
  assert(m.fighters[0].meter === 0, 'super consumes the full meter')
  for (let i = 0; i < 120; i++) stepMatch(m, [0, 0])
  assert(m.fighters[1].hp < before, 'super damages the opponent')
  assert(before - m.fighters[1].hp > 150, 'super hits for real damage (multi-hit ultimate)')
}

// --- projectile ------------------------------------------------------------
{
  const m = createMatch('yuki', 'goro', 13)
  for (let i = 0; i < TICK * 2 + 5; i++) stepMatch(m, [0, 0])
  stepMatch(m, [B_SPECIAL, 0])
  for (let i = 0; i < 20; i++) stepMatch(m, [0, 0])
  assert(m.projectiles.length > 0, 'Yuki-Onna spawns a projectile on special')
}

// --- full roster sanity ----------------------------------------------------
for (const x of CHARACTERS) {
  for (const y of CHARACTERS) {
    const r = runMatch(1234, [x.id, y.id], masher(0), masher(1), 60 * 400)
    if (r.m.phase !== 'matchEnd') {
      failures++
      console.error(`✗ ${x.id} vs ${y.id} never finished (phase=${r.m.phase})`)
    }
  }
}
console.log(`✓ all ${CHARACTERS.length * CHARACTERS.length} roster matchups complete`)

console.log(failures === 0 ? '\nALL TESTS PASSED' : `\n${failures} TEST(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)
