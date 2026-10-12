// ---------------------------------------------------------------------------
// CPU opponent. Deterministic (uses the match RNG) so replays/training stay
// reproducible, and difficulty-scaled by reaction time + aggression.
// ---------------------------------------------------------------------------

import { B_HEAVY, B_LEFT, B_LIGHT, B_RIGHT, B_SPECIAL, B_SUPER, B_UP, MAX_METER } from './constants.js'

const DIFFICULTIES = {
  easy: { reaction: 26, aggression: 0.35, blockChance: 0.25, superDelay: 90 },
  normal: { reaction: 14, aggression: 0.6, blockChance: 0.5, superDelay: 40 },
  hard: { reaction: 7, aggression: 0.85, blockChance: 0.78, superDelay: 12 },
}

export function createAi(difficulty = 'normal') {
  const cfg = DIFFICULTIES[difficulty] || DIFFICULTIES.normal
  const brain = {
    timer: 0,
    intent: 'approach',
    intentTimer: 0,
    jumpCd: 0,
    attackCd: 0,
    blockHold: 0,
    superHold: 0,
  }

  return function think(match, me, foe) {
    const rng = match.rng
    let bits = 0

    if (me.hp <= 0 || match.phase !== 'fight') return 0
    if (brain.jumpCd > 0) brain.jumpCd--
    if (brain.attackCd > 0) brain.attackCd--
    if (brain.blockHold > 0) brain.blockHold--

    const dist = Math.abs(foe.x - me.x)
    const toward = foe.x > me.x ? B_RIGHT : B_LEFT
    const away = foe.x > me.x ? B_LEFT : B_RIGHT

    // ---- decide a new intent every so often ----
    brain.intentTimer--
    if (brain.intentTimer <= 0) {
      const r = rng()
      if (me.ch.projectile && dist > 380) brain.intent = r < 0.6 ? 'zoner' : 'approach'
      else if (dist > 260) brain.intent = r < 0.72 ? 'approach' : r < 0.86 ? 'jumpIn' : 'wait'
      else if (dist > 130) brain.intent = r < cfg.aggression ? 'attack' : r < cfg.aggression + 0.2 ? 'approach' : 'defend'
      else brain.intent = r < cfg.aggression + 0.15 ? 'attack' : r < 0.85 ? 'defend' : 'retreat'
      brain.intentTimer = cfg.reaction + Math.floor(rng() * 22)
    }

    // ---- react to incoming attacks ----
    const foeAttacking =
      (foe.state === 'attack' || foe.state === 'super') && dist < 220 && (foe.phase === 'startup' || foe.phase === 'active')
    if (foeAttacking && rng() < cfg.blockChance && brain.blockHold <= 0 && me.state !== 'attack') {
      brain.blockHold = 18 + Math.floor(rng() * 14)
    }
    if (brain.blockHold > 0) {
      bits |= away
      return bits
    }

    // ---- super when available ----
    if (me.meter >= MAX_METER && dist < 190 && brain.attackCd <= 0) {
      brain.superHold = 2
      brain.attackCd = cfg.superDelay + 40
    }
    if (brain.superHold > 0) {
      brain.superHold--
      bits |= B_SUPER
      return bits
    }

    switch (brain.intent) {
      case 'approach':
        bits |= toward
        if (dist < 150 && brain.attackCd <= 0 && rng() < cfg.aggression * 0.5) bits |= B_LIGHT
        break
      case 'retreat':
        bits |= away
        break
      case 'wait':
        if (rng() < 0.05) bits |= toward
        break
      case 'jumpIn':
        if (brain.jumpCd <= 0 && !me.airborne) {
          bits |= B_UP
          brain.jumpCd = 70
        }
        bits |= toward
        if (me.airborne && dist < 170 && rng() < 0.5) bits |= B_HEAVY
        break
      case 'zoner': {
        if (brain.attackCd <= 0 && rng() < 0.16) {
          bits |= B_SPECIAL
          brain.attackCd = 46
        } else if (dist < 160) {
          bits |= away
          if (rng() < 0.1) bits |= B_UP
        } else if (dist > 520) {
          bits |= toward
        }
        break
      }
      case 'defend':
        if (dist > 190) bits |= toward
        else if (rng() < 0.4) bits |= away
        break
      case 'attack':
      default: {
        if (dist > 132) {
          bits |= toward
        } else if (brain.attackCd <= 0) {
          const r = rng()
          if (me.ch.projectile && r < 0.22) {
            bits |= B_SPECIAL
            brain.attackCd = 44
          } else if (r < 0.55) {
            bits |= B_LIGHT
            brain.attackCd = 16 + Math.floor(rng() * 12)
          } else if (r < 0.85) {
            bits |= B_HEAVY
            brain.attackCd = 26 + Math.floor(rng() * 16)
          } else {
            bits |= B_SPECIAL
            brain.attackCd = 40 + Math.floor(rng() * 20)
          }
        }
        // punish a whiffed attack
        if (foe.state === 'attack' && foe.phase === 'recovery' && dist < 160 && brain.attackCd <= 4) {
          bits |= B_HEAVY
          brain.attackCd = 24
        }
        break
      }
    }

    // anti-air
    if (foe.airborne && foe.y < 500 && dist < 180 && rng() < cfg.aggression * 0.5 && brain.attackCd <= 0) {
      bits |= B_HEAVY
      brain.attackCd = 22
    }

    return bits
  }
}
