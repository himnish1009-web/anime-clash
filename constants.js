// ---------------------------------------------------------------------------
// Shared constants + input bit layout.
// Kept in its own module because BOTH the browser sim and (optionally) any
// server-side validation must agree on these numbers.
// ---------------------------------------------------------------------------

export const TICK = 60 // simulation ticks per second
export const WORLD_W = 1280
export const WORLD_H = 720
export const GROUND_Y = 612 // y coordinate of the floor (fighter feet)
export const WALL_PAD = 46
export const GRAVITY = 0.86
export const MAX_FALL = 21
export const ROUND_TIME = 60 // seconds per round
export const ROUNDS_TO_WIN = 2 // best of 3
export const MAX_METER = 100

export const BODY_W = 62
export const STAND_H = 188
export const CROUCH_H = 118

// input bits --------------------------------------------------------------
export const B_LEFT = 1
export const B_RIGHT = 2
export const B_UP = 4
export const B_DOWN = 8
export const B_LIGHT = 16
export const B_HEAVY = 32
export const B_SPECIAL = 64
export const B_SUPER = 128
export const B_TAUNT = 256

export const KEYMAP_P1 = {
  KeyA: B_LEFT,
  KeyD: B_RIGHT,
  KeyW: B_UP,
  KeyS: B_DOWN,
  KeyF: B_LIGHT,
  KeyG: B_HEAVY,
  KeyH: B_SPECIAL,
  KeyT: B_SUPER,
  KeyR: B_TAUNT,
}

export const KEYMAP_P2 = {
  ArrowLeft: B_LEFT,
  ArrowRight: B_RIGHT,
  ArrowUp: B_UP,
  ArrowDown: B_DOWN,
  KeyJ: B_LIGHT,
  KeyK: B_HEAVY,
  KeyL: B_SPECIAL,
  Semicolon: B_SUPER,
  KeyU: B_TAUNT,
}

// moves -------------------------------------------------------------------
// frames are in ticks (60/s). startup -> active -> recovery
// kb = knockback impulse, lift = vertical launch, hs = hitstun, bs = blockstun
export const MOVES = {
  light: {
    name: 'Jab',
    startup: 5,
    active: 4,
    recovery: 11, // 20f total vs 12f hitstun → no infinite jab loop
    damage: 48,
    kb: 4.2,
    lift: 0,
    hs: 12,
    bs: 9,
    meter: 7,
    reach: 96,
    height: 34,
    yOffset: 118,
    air: true,
  },
  heavy: {
    name: 'Smash',
    startup: 11,
    active: 6,
    recovery: 20,
    damage: 108,
    kb: 10.5,
    lift: -8.2,
    hs: 30,
    bs: 16,
    meter: 12,
    reach: 126,
    height: 46,
    yOffset: 104,
    air: true,
  },
  special: {
    name: 'Special',
    startup: 15,
    active: 8,
    recovery: 24,
    damage: 132,
    kb: 9.2,
    lift: -6.4,
    hs: 26,
    bs: 18,
    meter: 14,
    reach: 142,
    height: 58,
    yOffset: 96,
    air: false,
  },
  super: {
    name: 'Ultimate',
    startup: 20,
    active: 34,
    recovery: 30,
    damage: 0, // taken from character.superDamage
    kb: 13,
    lift: -11,
    hs: 46,
    bs: 24,
    meter: 0,
    reach: 172,
    height: 120,
    yOffset: 60,
    air: false,
    hits: 4,
  },
}
