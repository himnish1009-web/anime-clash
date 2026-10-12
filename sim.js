// ---------------------------------------------------------------------------
// Deterministic lockstep fighting-game simulation.
//
// `createMatch()` builds the world, `stepMatch(match, inputs)` advances it by
// exactly one tick (1/60s). Nothing in here touches the DOM, canvas, React or
// `Math.random()` — that is what makes the same code run identically on two
// different browsers for online PvP.
// ---------------------------------------------------------------------------

import {
  GRAVITY,
  GROUND_Y,
  MAX_FALL,
  MAX_METER,
  MOVES,
  ROUND_TIME,
  ROUNDS_TO_WIN,
  TICK,
  WALL_PAD,
  WORLD_W,
  BODY_W,
  STAND_H,
  CROUCH_H,
  B_LEFT,
  B_RIGHT,
  B_UP,
  B_DOWN,
  B_LIGHT,
  B_HEAVY,
  B_SPECIAL,
  B_SUPER,
} from './constants.js'
import { byId } from './characters.js'

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

// mulberry32 — tiny, fast, deterministic PRNG
export function makeRng(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ---------------------------------------------------------------------------

function makeFighter(charId, playerIndex, facing) {
  const ch = byId(charId)
  return {
    charId,
    ch,
    p: playerIndex,
    x: playerIndex === 0 ? WORLD_W * 0.3 : WORLD_W * 0.7,
    y: GROUND_Y,
    vx: 0,
    vy: 0,
    facing,
    hp: ch.hp,
    maxHp: ch.hp,
    meter: 0,
    state: 'idle', // idle | walk | crouch | jump | attack | block | hit | ko | super | intro
    move: null,
    moveTimer: 0,
    phase: 'none', // startup | active | recovery
    hitFlag: false,
    hitCount: 0,
    stun: 0,
    blockStun: 0,
    airborne: false,
    launched: false,
    invuln: 0,
    freezeOnHit: 0,
    crouching: false,
    blocking: false,
    anim: 0,
    flash: 0,
    superFlash: 0,
    combo: 0, // combo this fighter is RECEIVING
    comboTimer: 0,
    dealt: 0, // combo this fighter is DEALING
    dealtTimer: 0,
    wins: 0,
    taunt: 0,
    dashTrail: [],
  }
}

export function createMatch(charA, charB, seed = 12345) {
  const match = {
    frame: 0,
    seed,
    rng: makeRng(seed),
    fighters: [makeFighter(charA, 0, 1), makeFighter(charB, 1, -1)],
    round: 1,
    roundWins: [0, 0],
    roundTimer: ROUND_TIME * TICK,
    phase: 'intro', // intro | fight | roundEnd | matchEnd
    phaseTimer: TICK * 2,
    roundWinner: -1,
    matchWinner: -1,
    projectiles: [],
    particles: [],
    numbers: [],
    shake: 0,
    hitStop: 0,
    flash: 0,
    slowmo: 0,
    announce: { text: '', sub: '', timer: 0 },
    stats: { hits: [0, 0], maxCombo: [0, 0], damage: [0, 0], supers: [0, 0] },
    inputs: [0, 0],
    log: [],
  }
  match.announce = { text: 'ROUND 1', sub: `${byId(charA).name}  vs  ${byId(charB).name}`, timer: TICK * 2 }
  return match
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function bodyHeight(f) {
  return f.crouching ? CROUCH_H : STAND_H
}

function hurtbox(f) {
  const h = bodyHeight(f)
  return { x: f.x - BODY_W / 2, y: f.y - h, w: BODY_W, h }
}

function hitbox(f) {
  const m = MOVES[f.move]
  if (!m) return null
  const yTop = f.y - m.yOffset - m.height / 2
  const x = f.facing === 1 ? f.x + BODY_W / 2 - 12 : f.x - BODY_W / 2 - m.reach + 12
  return { x, y: yTop, w: m.reach, h: m.height }
}

export const overlap = (a, b) =>
  a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

function pushLog(match, text) {
  match.log.push({ frame: match.frame, text })
  if (match.log.length > 40) match.log.shift()
}

function spark(match, x, y, color, count, power = 1) {
  const rng = match.rng
  for (let i = 0; i < count; i++) {
    const a = rng() * Math.PI * 2
    const sp = (1.4 + rng() * 5.2) * power
    match.particles.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.2 * power,
      life: 18 + Math.floor(rng() * 26),
      max: 44,
      size: 2 + rng() * 4.5 * power,
      color,
      kind: rng() > 0.72 ? 'spark' : 'dust',
      grav: 0.16,
    })
  }
}

function ring(match, x, y, color, size = 40) {
  match.particles.push({ x, y, vx: 0, vy: 0, life: 16, max: 16, size, color, kind: 'ring', grav: 0 })
}

function damageNumber(match, x, y, value, color, label) {
  match.numbers.push({ x, y, vy: -2.4, life: 52, max: 52, value: Math.round(value), color, label })
}

function impact(match, attacker, defender, dmg, blocked, move, hx, hy) {
  const rng = match.rng
  const kb = move.kb
  const weight = defender.ch.weight

  if (blocked) {
    const chip = Math.max(2, Math.round(dmg * 0.11))
    defender.hp = Math.max(0, defender.hp - chip)
    defender.blockStun = move.bs
    defender.state = 'block'
    defender.vx = (attacker.facing * kb * 0.45) / weight
    attacker.meter = clamp(attacker.meter + move.meter * 0.35, 0, MAX_METER)
    defender.meter = clamp(defender.meter + move.meter * 0.5, 0, MAX_METER)
    spark(match, hx, hy, '#9fd8ff', 8, 0.7)
    ring(match, hx, hy, '#7fe9ff', 30)
    match.shake = Math.max(match.shake, 4)
    match.hitStop = Math.max(match.hitStop, 3)
    damageNumber(match, hx, hy - 26, chip, '#9fd8ff', 'GUARD')
    return
  }

  // combo scaling
  const scale = Math.max(0.45, 1 - defender.combo * 0.11)
  const variance = 0.96 + rng() * 0.08
  const finalDmg = Math.max(1, Math.round(dmg * scale * variance * attacker.ch.dmgScale))

  const counter = defender.state === 'attack' && defender.phase === 'startup'
  const mult = counter ? 1.22 : 1

  defender.hp = Math.max(0, defender.hp - finalDmg)
  defender.stun = move.hs + (defender.airborne ? 6 : 0)
  defender.state = 'hit'
  defender.move = null
  defender.hitCount = 0
  defender.flash = 8
  defender.combo += 1
  defender.comboTimer = 70
  defender.vx = (attacker.facing * kb) / weight
  if (move.lift !== 0) {
    defender.vy = move.lift / weight
    defender.airborne = true
    defender.launched = true
    defender.y = Math.min(defender.y, GROUND_Y - 1)
  }
  attacker.dealt += 1
  attacker.dealtTimer = 90
  attacker.meter = clamp(attacker.meter + move.meter * attacker.ch.meterGain * mult, 0, MAX_METER)
  defender.meter = clamp(defender.meter + move.meter * 0.6, 0, MAX_METER)

  match.stats.hits[attacker.p] += 1
  match.stats.damage[attacker.p] += finalDmg
  match.stats.maxCombo[attacker.p] = Math.max(match.stats.maxCombo[attacker.p], attacker.dealt)

  const color = attacker.ch.aura
  spark(match, hx, hy, color, counter ? 26 : 16, counter ? 1.5 : 1)
  spark(match, hx, hy, '#ffffff', 6, 0.8)
  ring(match, hx, hy, color, counter ? 62 : 44)
  match.shake = Math.max(match.shake, counter ? 15 : 9 + Math.min(8, finalDmg / 16))
  match.hitStop = Math.max(match.hitStop, move === MOVES.super ? 14 : counter ? 11 : 7)
  match.flash = Math.max(match.flash, counter ? 0.5 : 0.3)
  damageNumber(match, hx, hy - 34, finalDmg * mult, counter ? '#ffc857' : '#ffffff', counter ? 'COUNTER!' : '')

  if (attacker.dealt >= 2) {
    match.announce = { text: `${attacker.dealt} HIT COMBO`, sub: '', timer: 42 }
  }
}

/**
 * Guard check. "Holding away" is measured against where the ATTACKER actually
 * is, not the defender's cached facing — otherwise a crossup (jumping over
 * someone) could not be blocked at all.
 */
function isGuarding(match, defender, attacker) {
  const bits = match.inputs ? match.inputs[defender.p] : defender.prevInput
  const away = attacker.x > defender.x ? B_LEFT : B_RIGHT
  return (bits & away) !== 0
}

function startMove(f, match, moveKey) {
  const m = MOVES[moveKey]
  if (!m) return false
  if (moveKey === 'special' && f.ch.projectile) {
    // zoning characters throw a projectile on special
    f.state = 'attack'
    f.move = 'special'
    f.moveTimer = m.startup + m.active + m.recovery
    f.phase = 'startup'
    f.hitFlag = false
    f.hitCount = 0
    f.spawnProjectileAt = m.startup
    return true
  }
  f.state = moveKey === 'super' ? 'super' : 'attack'
  f.move = moveKey
  f.moveTimer = m.startup + m.active + m.recovery
  f.phase = 'startup'
  f.hitFlag = false
  f.hitCount = 0
  if (moveKey === 'super') {
    f.meter = 0
    f.superFlash = 46
    f.invuln = m.startup + 8
    match.hitStop = Math.max(match.hitStop, 26)
    match.flash = 0.85
    match.shake = Math.max(match.shake, 12)
    match.announce = { text: f.ch.superName.toUpperCase(), sub: f.ch.name, timer: 90 }
    match.stats.supers[f.p] += 1
    ring(match, f.x, f.y - 90, f.ch.aura, 150)
    spark(match, f.x, f.y - 80, f.ch.aura, 40, 1.8)
    pushLog(match, `${f.ch.name} unleashes ${f.ch.superName}!`)
  } else if (moveKey === 'special') {
    spark(match, f.x + f.facing * 40, f.y - 96, f.ch.aura, 12, 1.1)
  }
  return true
}

function spawnProjectile(match, f) {
  const p = f.ch.projectile
  match.projectiles.push({
    owner: f.p,
    x: f.x + f.facing * 52,
    y: f.y - 108,
    vx: f.facing * p.speed,
    size: p.size,
    color: p.color,
    damage: p.damage,
    life: 200,
    spin: 0,
    element: f.ch.element,
  })
  spark(match, f.x + f.facing * 52, f.y - 108, p.color, 14, 1)
  ring(match, f.x + f.facing * 52, f.y - 108, p.color, 46)
  match.shake = Math.max(match.shake, 5)
}

// ---------------------------------------------------------------------------
// one tick
// ---------------------------------------------------------------------------

export function stepMatch(match, inputs) {
  match.frame += 1

  // freeze-frame on big impacts (skips everything except decay)
  if (match.hitStop > 0) {
    match.hitStop -= 1
    match.shake *= 0.9
    match.flash *= 0.86
    decayFx(match)
    return
  }

  const [a, b] = match.fighters

  if (match.phase === 'intro') {
    match.phaseTimer -= 1
    a.anim += 1
    b.anim += 1
    if (match.phaseTimer === 40) match.announce = { text: 'FIGHT!', sub: '', timer: 46 }
    if (match.phaseTimer <= 0) match.phase = 'fight'
    decayFx(match)
    return
  }

  if (match.phase === 'roundEnd' || match.phase === 'matchEnd') {
    match.phaseTimer -= 1
    updateFighterPhysics(a)
    updateFighterPhysics(b)
    a.anim += 1
    b.anim += 1
    decayFx(match)
    if (match.phase === 'roundEnd' && match.phaseTimer <= 0) startRound(match, match.round + 1)
    return
  }

  // ---- fight ----
  if (match.slowmo > 0) {
    match.slowmo -= 1
    if (match.frame % 3 !== 0) {
      decayFx(match)
      return
    }
  }

  match.roundTimer -= 1
  match.inputs = [inputs[0] | 0, inputs[1] | 0]

  handleFighter(match, a, match.inputs[0])
  handleFighter(match, b, match.inputs[1])

  // keep fighters from overlapping / push apart
  separate(a, b)

  // facing (only when free to act)
  if (a.state !== 'attack' && a.state !== 'super') a.facing = b.x >= a.x ? 1 : -1
  if (b.state !== 'attack' && b.state !== 'super') b.facing = a.x >= b.x ? 1 : -1

  updateFighterPhysics(a)
  updateFighterPhysics(b)

  resolveAttacks(match, a, b)
  resolveAttacks(match, b, a)
  updateProjectiles(match)

  // combo counters decay
  for (const f of match.fighters) {
    if (f.comboTimer > 0 && --f.comboTimer === 0) f.combo = 0
    if (f.dealtTimer > 0 && --f.dealtTimer === 0) f.dealt = 0
    f.anim += 1
    if (f.taunt > 0) f.taunt -= 1
  }

  // round end conditions
  const koA = a.hp <= 0
  const koB = b.hp <= 0
  if (koA || koB) {
    endRound(match, koA && koB ? -1 : koA ? 1 : 0, koA && koB ? 'DOUBLE K.O.' : 'K.O.!')
  } else if (match.roundTimer <= 0) {
    match.roundTimer = 0
    const w = a.hp / a.maxHp === b.hp / b.maxHp ? -1 : a.hp / a.maxHp > b.hp / b.maxHp ? 0 : 1
    endRound(match, w, 'TIME UP')
  }

  decayFx(match)
}

function decayFx(match) {
  match.shake *= 0.86
  match.flash *= 0.84
  if (match.announce.timer > 0) match.announce.timer -= 1

  const ps = match.particles
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i]
    p.life -= 1
    p.x += p.vx
    p.y += p.vy
    p.vy += p.grav
    p.vx *= 0.97
    if (p.kind === 'ring') p.size += 5.5
    if (p.life <= 0) ps.splice(i, 1)
  }
  const ns = match.numbers
  for (let i = ns.length - 1; i >= 0; i--) {
    const n = ns[i]
    n.life -= 1
    n.y += n.vy
    n.vy *= 0.93
    if (n.life <= 0) ns.splice(i, 1)
  }
}

function handleFighter(match, f, input) {
  const prev = f.prevInput | 0
  const hold = (bit) => (input & bit) !== 0
  const pressed = (bit) => (input & bit) !== 0 && (prev & bit) === 0

  if (f.hp <= 0) {
    f.state = 'ko'
    f.move = null
    f.stun = 0
    f.prevInput = input
    return
  }

  if (f.superFlash > 0) f.superFlash -= 1
  if (f.invuln > 0) f.invuln -= 1
  if (f.flash > 0) f.flash -= 1
  if (f.freezeOnHit > 0) f.freezeOnHit -= 1

  // hitstun / blockstun
  if (f.stun > 0) {
    f.stun -= 1
    if (f.stun === 0 && !f.airborne) {
      f.state = 'idle'
      f.vx *= 0.2
    }
    f.prevInput = input
    return
  }
  if (f.blockStun > 0) {
    f.blockStun -= 1
    if (f.blockStun === 0) f.state = 'idle'
    f.prevInput = input
    return
  }

  // in the middle of a move
  if (f.state === 'attack' || f.state === 'super') {
    const m = MOVES[f.move]
    f.moveTimer -= 1
    const total = m.startup + m.active + m.recovery
    const elapsed = total - f.moveTimer
    f.phase = elapsed <= m.startup ? 'startup' : elapsed <= m.startup + m.active ? 'active' : 'recovery'
    if (f.spawnProjectileAt && elapsed === f.spawnProjectileAt) {
      spawnProjectile(match, f)
      f.spawnProjectileAt = 0
    }
    if (f.moveTimer <= 0) {
      f.state = 'idle'
      f.move = null
      f.phase = 'none'
      f.hitFlag = false
    }
    f.prevInput = input
    return
  }

  f.prevInput = input

  // ---- free to act ----
  const back = f.facing === 1 ? B_LEFT : B_RIGHT
  const fwd = f.facing === 1 ? B_RIGHT : B_LEFT
  const holdingBack = hold(back)

  f.crouching = hold(B_DOWN) && !f.airborne
  f.blocking = holdingBack && !f.airborne && !f.crouching

  if (pressed(B_SUPER) && f.meter >= MAX_METER) {
    startMove(f, match, 'super')
    return
  }
  if (pressed(B_SPECIAL)) {
    startMove(f, match, 'special')
    return
  }
  if (pressed(B_HEAVY)) {
    startMove(f, match, 'heavy')
    return
  }
  if (pressed(B_LIGHT)) {
    startMove(f, match, 'light')
    return
  }

  if (!f.airborne) {
    if (hold(B_UP)) {
      f.vy = -f.ch.jump
      f.airborne = true
      f.state = 'jump'
      spark(match, f.x, f.y, '#6f7fb5', 8, 0.7)
    } else if (f.blocking) {
      f.state = 'block'
      f.vx *= 0.6
    } else if (f.crouching) {
      f.state = 'crouch'
      f.vx *= 0.6
    } else if (hold(fwd)) {
      f.state = 'walk'
      f.vx = f.ch.walk
    } else if (holdingBack) {
      f.state = 'walk'
      f.vx = -f.ch.backWalk
    } else {
      f.state = 'idle'
      f.vx *= 0.55
    }
  } else {
    f.state = 'jump'
    if (hold(fwd)) f.vx = clamp(f.vx + 0.4, -f.ch.walk, f.ch.walk)
    else if (holdingBack) f.vx = clamp(f.vx - 0.4, -f.ch.walk, f.ch.walk)
  }
}

function updateFighterPhysics(f) {
  if (f.airborne || f.y < GROUND_Y) {
    f.vy = Math.min(f.vy + GRAVITY, MAX_FALL)
    f.airborne = true
  } else {
    f.vy = 0
  }

  f.x += f.vx
  f.y += f.vy

  if (!f.airborne || f.state === 'hit') f.vx *= 0.86

  if (f.y >= GROUND_Y) {
    if (f.airborne && f.vy > 6) {
      // landing impact
      f.landDust = 8
    }
    f.y = GROUND_Y
    f.vy = 0
    f.airborne = false
    if (f.state === 'jump') f.state = 'idle'
    else if (f.hp <= 0) f.state = 'ko'
    else if (f.launched) {
      f.launched = false
      f.stun = Math.max(f.stun, 16)
      f.state = 'hit'
    }
    if (f.state === 'hit' && f.stun <= 0) f.state = 'idle'
  }

  f.x = clamp(f.x, WALL_PAD, WORLD_W - WALL_PAD)
  if (f.landDust > 0) f.landDust -= 1

  // dash trail for motion blur
  f.dashTrail.push({ x: f.x, y: f.y, facing: f.facing, state: f.state, move: f.move, phase: f.phase })
  if (f.dashTrail.length > 4) f.dashTrail.shift()
}

function separate(a, b) {
  const minDist = BODY_W * 0.86
  const dx = b.x - a.x
  const dist = Math.abs(dx)
  if (dist < minDist && !a.airborne && !b.airborne) {
    const push = (minDist - dist) / 2
    const dir = dx >= 0 ? 1 : -1
    a.x -= push * dir
    b.x += push * dir
    a.x = clamp(a.x, WALL_PAD, WORLD_W - WALL_PAD)
    b.x = clamp(b.x, WALL_PAD, WORLD_W - WALL_PAD)
  }
}

function resolveAttacks(match, attacker, defender) {
  if ((attacker.state !== 'attack' && attacker.state !== 'super') || attacker.phase !== 'active') return
  const m = MOVES[attacker.move]
  if (!m) return

  if (defender.invuln > 0 || defender.hp <= 0) return

  const isSuper = attacker.state === 'super'
  const maxHits = isSuper ? m.hits : 1
  if (attacker.hitCount >= maxHits) return
  if (!isSuper && attacker.hitFlag) return

  const hb = hitbox(attacker)
  const hurt = hurtbox(defender)
  if (!overlap(hb, hurt)) return

  const hx = clamp((Math.max(hb.x, hurt.x) + Math.min(hb.x + hb.w, hurt.x + hurt.w)) / 2, 0, WORLD_W)
  const hy = hb.y + hb.h / 2

  const blocked =
    isGuarding(match, defender, attacker) &&
    !defender.airborne &&
    !defender.crouching &&
    defender.stun <= 0 &&
    defender.state !== 'hit' &&
    defender.state !== 'ko' &&
    defender.state !== 'super' &&
    !isSuper

  const baseDmg = isSuper ? attacker.ch.superDamage / m.hits : m.damage
  impact(match, attacker, defender, baseDmg, blocked, m, hx, hy)
  attacker.hitFlag = true
  attacker.hitCount += 1
}

function updateProjectiles(match) {
  for (let i = match.projectiles.length - 1; i >= 0; i--) {
    const p = match.projectiles[i]
    p.x += p.vx
    p.spin += 0.3
    p.life -= 1
    if (match.frame % 2 === 0) {
      match.particles.push({
        x: p.x,
        y: p.y,
        vx: p.vx > 0 ? -0.7 : 0.7,
        vy: 0,
        life: 14,
        max: 14,
        size: p.size * 0.5,
        color: p.color,
        kind: 'dust',
        grav: 0,
      })
    }

    const shooter = match.fighters[p.owner]
    const target = match.fighters[1 - p.owner]
    const box = { x: p.x - p.size, y: p.y - p.size, w: p.size * 2, h: p.size * 2 }

    if (p.x < -60 || p.x > WORLD_W + 60 || p.life <= 0) {
      match.projectiles.splice(i, 1)
      continue
    }

    if (target.invuln <= 0 && target.hp > 0 && overlap(box, hurtbox(target))) {
      const blocked =
        isGuarding(match, target, shooter) &&
        !target.airborne &&
        !target.crouching &&
        target.stun <= 0 &&
        target.state !== 'hit' &&
        target.state !== 'super'
      const fakeMove = { kb: 7, lift: 0, hs: 22, bs: 14, meter: 9, name: 'Shard' }
      impact(match, shooter, target, p.damage, blocked, fakeMove, p.x, p.y)
      spark(match, p.x, p.y, p.color, 20, 1.3)
      ring(match, p.x, p.y, p.color, 70)
      match.projectiles.splice(i, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// rounds
// ---------------------------------------------------------------------------

function endRound(match, winner, text) {
  if (match.phase !== 'fight') return
  match.phase = 'roundEnd'
  match.phaseTimer = TICK * 2.6
  match.roundWinner = winner
  match.hitStop = 18
  match.shake = 20
  match.flash = 0.7
  match.slowmo = 40

  const [a, b] = match.fighters
  if (winner >= 0) {
    match.roundWins[winner] += 1
    const loser = match.fighters[1 - winner]
    loser.state = 'ko'
    loser.stun = 999
    loser.vy = -9
    loser.vx = -loser.facing * 6
    loser.airborne = true
    loser.launched = true
    spark(match, loser.x, loser.y - 90, match.fighters[winner].ch.aura, 46, 2)
  } else {
    a.state = 'ko'
    b.state = 'ko'
  }

  const winnerFighter = winner >= 0 ? match.fighters[winner] : null
  const wins = winner >= 0 ? match.roundWins[winner] : 0

  if (wins >= ROUNDS_TO_WIN) {
    match.phase = 'matchEnd'
    match.phaseTimer = TICK * 3
    match.matchWinner = winner
    match.announce = {
      text: winner >= 0 ? `${winnerFighter.ch.name} WINS` : 'DRAW GAME',
      sub: winner >= 0 ? winnerFighter.ch.quote : 'No victor this night',
      timer: TICK * 3,
    }
    pushLog(match, `${winner >= 0 ? winnerFighter.ch.name : 'Nobody'} takes the match ${match.roundWins[0]}-${match.roundWins[1]}`)
  } else {
    match.announce = {
      text,
      sub: winner >= 0 ? `${winnerFighter.ch.name} takes round ${match.round}` : 'Both fighters fall',
      timer: TICK * 2.4,
    }
    pushLog(match, `Round ${match.round}: ${text}`)
  }
}

function startRound(match, roundNumber) {
  match.round = roundNumber
  match.phase = 'intro'
  match.phaseTimer = TICK * 1.8
  match.roundTimer = ROUND_TIME * TICK
  match.roundWinner = -1
  match.projectiles.length = 0
  match.particles.length = 0
  match.numbers.length = 0
  match.slowmo = 0
  match.hitStop = 0
  match.shake = 0
  match.flash = 0

  const [a, b] = match.fighters
  for (const f of [a, b]) {
    f.hp = f.maxHp
    f.meter = Math.min(f.meter, 40) // carry a little meter over, fighting-game style
    f.x = f.p === 0 ? WORLD_W * 0.3 : WORLD_W * 0.7
    f.y = GROUND_Y
    f.vx = 0
    f.vy = 0
    f.facing = f.p === 0 ? 1 : -1
    f.state = 'idle'
    f.move = null
    f.phase = 'none'
    f.stun = 0
    f.blockStun = 0
    f.airborne = false
    f.launched = false
    f.invuln = 0
    f.combo = 0
    f.dealt = 0
    f.comboTimer = 0
    f.dealtTimer = 0
    f.flash = 0
    f.superFlash = 0
    f.taunt = 0
    f.prevInput = 0
  }
  match.announce = { text: `ROUND ${roundNumber}`, sub: 'Best of three', timer: TICK * 1.8 }
}

// ---------------------------------------------------------------------------
// lightweight snapshot for the React HUD (avoid re-rendering on full state)
// ---------------------------------------------------------------------------

export function snapshot(match) {
  const [a, b] = match.fighters
  return {
    frame: match.frame,
    phase: match.phase,
    round: match.round,
    roundWins: [...match.roundWins],
    time: Math.max(0, Math.ceil(match.roundTimer / TICK)),
    matchWinner: match.matchWinner,
    roundWinner: match.roundWinner,
    announce: { ...match.announce },
    stats: { hits: [...match.stats.hits], maxCombo: [...match.stats.maxCombo], damage: [...match.stats.damage], supers: [...match.stats.supers] },
    fighters: [a, b].map((f) => ({
      charId: f.charId,
      name: f.ch.name,
      hp: f.hp,
      maxHp: f.maxHp,
      meter: f.meter,
      state: f.state,
      combo: f.dealt,
      aura: f.ch.aura,
    })),
  }
}

export const matchKey = (m) => hashStr(`${m.fighters[0].charId}|${m.fighters[1].charId}|${m.seed}`)
