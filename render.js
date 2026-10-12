// ---------------------------------------------------------------------------
// Canvas renderer. Everything is drawn procedurally (no image assets), so the
// whole game ships as a few kilobytes of code and scales to any resolution.
// ---------------------------------------------------------------------------

import { GROUND_Y, MOVES, WORLD_H, WORLD_W } from './constants.js'

const TAU = Math.PI * 2

// small colour helpers -------------------------------------------------------
export function shade(hex, amt) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  r = Math.max(0, Math.min(255, Math.round(r + amt)))
  g = Math.max(0, Math.min(255, Math.round(g + amt)))
  b = Math.max(0, Math.min(255, Math.round(b + amt)))
  return `rgb(${r},${g},${b})`
}

function rgba(hex, a) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/(.)/g, '$1$1') : h, 16)
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
}

function quadLimb(ctx, x1, y1, mx, my, x2, y2, w, color) {
  ctx.strokeStyle = color
  ctx.lineWidth = w
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(mx, my)
  ctx.lineTo(x2, y2)
  ctx.stroke()
}

// ---------------------------------------------------------------------------
// POSE — where every joint sits for the current state/frame
// ---------------------------------------------------------------------------

function poseOf(f, t) {
  const s = f.ch.id === 'goro' ? 1.13 : f.ch.id === 'renji' ? 0.95 : 1
  const bob = Math.sin(t * 0.09) * 3
  const p = {
    s,
    hipY: -92 * s,
    shoulderY: -152 * s,
    headY: -172 * s,
    headR: 21 * s,
    lean: 0,
    armF: { sh: [9 * s, -148 * s], el: [24 * s, -120 * s], hd: [30 * s, -96 * s] },
    armB: { sh: [-9 * s, -148 * s], el: [-22 * s, -120 * s], hd: [-26 * s, -96 * s] },
    legF: { hp: [9 * s, -92 * s], kn: [16 * s, -48 * s], ft: [20 * s, 0] },
    legB: { hp: [-9 * s, -92 * s], kn: [-16 * s, -48 * s], ft: [-22 * s, 0] },
    weaponAngle: -0.5,
    weaponOut: 0,
    crouchAmount: 0,
    hairSway: Math.sin(t * 0.06) * 0.12,
    fx: null,
  }

  const st = f.state
  const m = f.move ? MOVES[f.move] : null
  const prog = m ? 1 - f.moveTimer / (m.startup + m.active + m.recovery) : 0

  if (st === 'idle') {
    p.hipY += bob * 0.6
    p.shoulderY += bob
    p.headY += bob * 1.15
    p.armF.hd[1] += bob
    p.armB.hd[1] += bob
    p.armF.el[1] += bob * 0.7
    p.armB.el[1] += bob * 0.7
    p.armF = { sh: [10 * s, -148 * s + bob], el: [26 * s, -116 * s + bob], hd: [34 * s, -104 * s + bob] }
    p.armB = { sh: [-10 * s, -148 * s + bob], el: [-24 * s, -118 * s + bob], hd: [-20 * s, -100 * s + bob] }
  } else if (st === 'walk') {
    const sw = Math.sin(t * 0.32)
    p.legF.kn[0] = (16 + sw * 16) * s
    p.legF.ft[0] = (20 + sw * 26) * s
    p.legF.ft[1] = -Math.max(0, sw) * 16
    p.legB.kn[0] = (16 - sw * 16) * s
    p.legB.ft[0] = (-22 - sw * 20) * s
    p.legB.ft[1] = -Math.max(0, -sw) * 16
    p.hipY += Math.abs(sw) * -3
    p.armF.hd[0] = (30 - sw * 14) * s
    p.armB.hd[0] = (-26 + sw * 14) * s
    p.lean = f.vx > 0 ? 0.06 : -0.06
  } else if (st === 'crouch') {
    p.crouchAmount = 1
    p.hipY = -58 * s
    p.shoulderY = -108 * s
    p.headY = -126 * s
    p.legF = { hp: [9 * s, -58 * s], kn: [30 * s, -34 * s], ft: [22 * s, 0] }
    p.legB = { hp: [-9 * s, -58 * s], kn: [-30 * s, -34 * s], ft: [-24 * s, 0] }
    p.armF = { sh: [10 * s, -104 * s], el: [26 * s, -84 * s], hd: [32 * s, -70 * s] }
    p.armB = { sh: [-10 * s, -104 * s], el: [-24 * s, -84 * s], hd: [-28 * s, -70 * s] }
  } else if (st === 'jump') {
    const rising = f.vy < 0
    p.legF = { hp: [9 * s, -92 * s], kn: [30 * s, -66 * s], ft: [18 * s, rising ? -34 * s : -12 * s] }
    p.legB = { hp: [-9 * s, -92 * s], kn: [-26 * s, -62 * s], ft: [-34 * s, rising ? -20 * s : -6 * s] }
    p.armF = { sh: [10 * s, -150 * s], el: [30 * s, -176 * s], hd: [36 * s, -200 * s] }
    p.armB = { sh: [-10 * s, -150 * s], el: [-30 * s, -172 * s], hd: [-38 * s, -194 * s] }
    p.hairSway = rising ? -0.5 : 0.55
  } else if (st === 'block') {
    p.lean = -0.12
    p.armF = { sh: [10 * s, -150 * s], el: [26 * s, -140 * s], hd: [12 * s, -124 * s] }
    p.armB = { sh: [-10 * s, -148 * s], el: [6 * s, -136 * s], hd: [-6 * s, -118 * s] }
    p.legF.ft[0] = 26 * s
    p.legB.ft[0] = -30 * s
    p.hipY = -86 * s
    p.fx = 'shield'
  } else if (st === 'hit') {
    p.lean = -0.3
    p.headY = -166 * s
    p.armF = { sh: [8 * s, -146 * s], el: [-6 * s, -160 * s], hd: [-24 * s, -150 * s] }
    p.armB = { sh: [-10 * s, -146 * s], el: [-30 * s, -156 * s], hd: [-46 * s, -138 * s] }
    p.legF.ft[0] = 26 * s
    p.legB.ft[0] = -34 * s
  } else if (st === 'ko') {
    const air = f.airborne
    p.lieDown = !air
    if (!air) {
      p.hipY = -26 * s
      p.shoulderY = -30 * s
      p.headY = -26 * s
      p.legF = { hp: [10 * s, -26 * s], kn: [44 * s, -30 * s], ft: [76 * s, -12 * s] }
      p.legB = { hp: [-10 * s, -26 * s], kn: [30 * s, -14 * s], ft: [62 * s, -4 * s] }
      p.armF = { sh: [6 * s, -30 * s], el: [34 * s, -40 * s], hd: [58 * s, -30 * s] }
      p.armB = { sh: [-14 * s, -28 * s], el: [-40 * s, -20 * s], hd: [-62 * s, -10 * s] }
      p.headOffsetX = -34 * s
    } else {
      p.lean = -0.7
      p.armF = { sh: [8 * s, -146 * s], el: [-16 * s, -168 * s], hd: [-40 * s, -160 * s] }
      p.armB = { sh: [-10 * s, -146 * s], el: [-34 * s, -166 * s], hd: [-54 * s, -150 * s] }
    }
  } else if (st === 'attack' || st === 'super') {
    const key = f.move
    const wind = Math.min(1, prog / Math.max(0.001, m.startup / (m.startup + m.active + m.recovery)))
    const act = f.phase === 'active'
    const rec = f.phase === 'recovery'

    if (key === 'light') {
      const ext = act ? 1 : rec ? 0.55 : wind * 0.4
      p.armF = {
        sh: [10 * s, -148 * s],
        el: [(24 + ext * 34) * s, -140 * s],
        hd: [(30 + ext * 72) * s, -134 * s],
      }
      p.armB = { sh: [-10 * s, -146 * s], el: [-26 * s, -128 * s], hd: [-22 * s, -112 * s] }
      p.lean = act ? 0.14 : -0.05
      if (act) p.fx = 'jab'
    } else if (key === 'heavy') {
      const ext = act ? 1 : rec ? 0.5 : wind * 0.3
      p.legF = { hp: [9 * s, -92 * s], kn: [(20 + ext * 40) * s, (-70 + ext * 8) * s], ft: [(24 + ext * 92) * s, (-96 + ext * 6) * s] }
      p.legB = { hp: [-9 * s, -92 * s], kn: [-24 * s, -46 * s], ft: [-30 * s, 0] }
      p.hipY = -86 * s
      p.shoulderY = -146 * s
      p.headY = -166 * s
      p.lean = act ? 0.22 : -0.14
      p.armF = { sh: [10 * s, -144 * s], el: [-8 * s, -152 * s], hd: [-26 * s, -140 * s] }
      p.armB = { sh: [-10 * s, -144 * s], el: [-32 * s, -136 * s], hd: [-44 * s, -118 * s] }
      if (act) p.fx = 'kick'
    } else if (key === 'special') {
      const ext = act ? 1 : rec ? 0.6 : wind * 0.35
      if (f.ch.projectile) {
        p.armF = { sh: [10 * s, -150 * s], el: [(26 + ext * 30) * s, -146 * s], hd: [(34 + ext * 58) * s, -140 * s] }
        p.armB = { sh: [-10 * s, -148 * s], el: [(4 + ext * 26) * s, -140 * s], hd: [(16 + ext * 48) * s, -134 * s] }
        p.lean = act ? 0.1 : -0.1
        if (act || wind > 0.6) p.fx = 'cast'
      } else {
        p.lean = act ? 0.34 : -0.22
        p.armF = {
          sh: [10 * s, -150 * s],
          el: [(18 + ext * 46) * s, (-160 + ext * 18) * s],
          hd: [(22 + ext * 96) * s, (-150 + ext * 12) * s],
        }
        p.armB = { sh: [-12 * s, -146 * s], el: [-34 * s, -128 * s], hd: [-46 * s, -110 * s] }
        p.legF = { hp: [9 * s, -92 * s], kn: [(20 + ext * 26) * s, -50 * s], ft: [(24 + ext * 56) * s, -6 * s] }
        p.weaponOut = act ? 1 : wind * 0.4
        p.weaponAngle = act ? 0.15 : -1.5 + wind * 0.8
        if (act) p.fx = 'slashBig'
      }
    } else if (key === 'super') {
      const ext = act ? 1 : wind * 0.5
      p.lean = act ? 0.4 : -0.3
      p.armF = { sh: [10 * s, -152 * s], el: [(24 + ext * 40) * s, (-168 + ext * 26) * s], hd: [(30 + ext * 92) * s, (-158 + ext * 20) * s] }
      p.armB = { sh: [-12 * s, -150 * s], el: [(-26 + ext * 30) * s, (-156 + ext * 22) * s], hd: [(-34 + ext * 74) * s, (-146 + ext * 18) * s] }
      p.legF = { hp: [9 * s, -92 * s], kn: [(20 + ext * 30) * s, -48 * s], ft: [(24 + ext * 62) * s, -4 * s] }
      p.weaponOut = ext
      p.weaponAngle = act ? 0.2 : -1.8 + wind
      p.fx = 'super'
    }
  }
  return p
}

// ---------------------------------------------------------------------------
// FIGHTER
// ---------------------------------------------------------------------------

export function drawFighter(ctx, f, ghostAlpha = 1) {
  const p = poseOf(f, f.anim)
  const ch = f.ch
  ctx.save()
  ctx.translate(f.x, f.y)
  ctx.scale(f.facing, 1)
  ctx.globalAlpha = ghostAlpha

  if (p.lieDown) {
    // body already posed for the ground
  }
  if (p.lean) {
    ctx.translate(0, p.hipY * 0.1)
    ctx.rotate(p.lean * 0.25)
    ctx.translate(0, -p.hipY * 0.1)
  }

  const skin = f.flash > 0 && f.flash % 2 === 0 ? '#ffffff' : ch.skin
  const outfit = f.flash > 0 && f.flash % 2 === 0 ? '#ffffff' : ch.outfit
  const accent = ch.outfitAccent

  // ---- aura / energy ----
  if (f.state === 'super' || f.superFlash > 0 || f.meter >= 100) {
    const pulse = 0.5 + Math.sin(f.anim * 0.35) * 0.5
    const r = 120 + pulse * 26
    const g = ctx.createRadialGradient(0, -95, 10, 0, -95, r)
    g.addColorStop(0, rgba(ch.aura, 0.42))
    g.addColorStop(0.5, rgba(ch.aura, 0.16))
    g.addColorStop(1, rgba(ch.aura, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, -95, r, 0, TAU)
    ctx.fill()
  }

  // ---- shadow ----
  ctx.save()
  ctx.scale(1 / f.facing, 1)
  const airFactor = clamp01((GROUND_Y - f.y) / 260)
  ctx.fillStyle = `rgba(0,0,0,${0.42 * (1 - airFactor * 0.6)})`
  ctx.beginPath()
  ctx.ellipse(0, 2, 46 * (1 - airFactor * 0.35), 11 * (1 - airFactor * 0.4), 0, 0, TAU)
  ctx.fill()
  ctx.restore()

  // ---- back leg & arm ----
  const legW = 17 * p.s * (ch.id === 'goro' ? 1.25 : 1)
  quadLimb(ctx, p.legB.hp[0], p.legB.hp[1], p.legB.kn[0], p.legB.kn[1], p.legB.ft[0], p.legB.ft[1], legW, shade(outfit, -26))
  drawBoot(ctx, p.legB.ft, shade(accent, -60), p.s)

  const armW = 13 * p.s
  quadLimb(ctx, p.armB.sh[0], p.armB.sh[1], p.armB.el[0], p.armB.el[1], p.armB.hd[0], p.armB.hd[1], armW, shade(skin, -34))

  // ---- hair (back layer) ----
  drawHairBack(ctx, p, ch)

  // ---- torso ----
  drawTorso(ctx, p, outfit, accent)

  // ---- head ----
  drawHead(ctx, p, ch, skin, f)

  // ---- front leg ----
  quadLimb(ctx, p.legF.hp[0], p.legF.hp[1], p.legF.kn[0], p.legF.kn[1], p.legF.ft[0], p.legF.ft[1], legW + 1, outfit)
  drawBoot(ctx, p.legF.ft, accent, p.s)

  // ---- weapon ----
  if (ch.weapon !== 'none') drawWeapon(ctx, p, ch, f)

  // ---- front arm ----
  quadLimb(ctx, p.armF.sh[0], p.armF.sh[1], p.armF.el[0], p.armF.el[1], p.armF.hd[0], p.armF.hd[1], armW + 1, skin)
  ctx.fillStyle = shade(skin, -12)
  ctx.beginPath()
  ctx.arc(p.armF.hd[0], p.armF.hd[1], 8 * p.s, 0, TAU)
  ctx.fill()
  if (ch.weapon === 'gauntlet') {
    ctx.fillStyle = accent
    ctx.beginPath()
    ctx.arc(p.armF.hd[0], p.armF.hd[1], 11 * p.s, 0, TAU)
    ctx.fill()
  }

  // ---- hair (front layer) ----
  drawHairFront(ctx, p, ch)
  drawHairOverShoulder(ctx, p, ch)

  // ---- pose FX ----
  drawPoseFx(ctx, p, ch)

  // ---- block shield ----
  if (p.fx === 'shield' || f.blockStun > 0) {
    ctx.strokeStyle = rgba('#8fd6ff', 0.85)
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.ellipse(24 * p.s, -100, 46, 84, 0, -1.1, 1.1)
    ctx.stroke()
    ctx.fillStyle = rgba('#8fd6ff', 0.14)
    ctx.fill()
  }

  ctx.restore()
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)

function drawBoot(ctx, foot, color, s) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(foot[0] + 3 * s, foot[1] - 4 * s, 12 * s, 7 * s, 0, 0, TAU)
  ctx.fill()
}

function drawTorso(ctx, p, outfit, accent) {
  const s = p.s
  const top = p.shoulderY
  const bot = p.hipY
  ctx.save()
  const g = ctx.createLinearGradient(0, top, 0, bot)
  g.addColorStop(0, shade(outfit, 26))
  g.addColorStop(1, shade(outfit, -14))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.moveTo(-20 * s, top)
  ctx.quadraticCurveTo(-25 * s, (top + bot) / 2, -17 * s, bot)
  ctx.lineTo(17 * s, bot)
  ctx.quadraticCurveTo(25 * s, (top + bot) / 2, 20 * s, top)
  ctx.quadraticCurveTo(0, top - 8 * s, -20 * s, top)
  ctx.closePath()
  ctx.fill()

  // chest emblem / sash
  ctx.fillStyle = accent
  ctx.beginPath()
  ctx.moveTo(-19 * s, top + 12 * s)
  ctx.lineTo(19 * s, top + 26 * s)
  ctx.lineTo(19 * s, top + 36 * s)
  ctx.lineTo(-19 * s, top + 22 * s)
  ctx.closePath()
  ctx.fill()

  // belt
  ctx.fillStyle = shade(accent, -30)
  ctx.fillRect(-19 * s, bot - 10 * s, 38 * s, 11 * s)
  ctx.fillStyle = '#fff8'
  ctx.fillRect(-5 * s, bot - 10 * s, 10 * s, 11 * s)

  // shoulders
  ctx.fillStyle = shade(outfit, 34)
  ctx.beginPath()
  ctx.ellipse(-16 * s, top + 3 * s, 13 * s, 10 * s, 0, 0, TAU)
  ctx.ellipse(16 * s, top + 3 * s, 13 * s, 10 * s, 0, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawHead(ctx, p, ch, skin, f) {
  const s = p.s
  const hx = p.headOffsetX || 0
  const hy = p.headY
  const r = p.headR
  ctx.save()
  ctx.translate(hx, hy)

  // neck
  ctx.fillStyle = shade(skin, -30)
  ctx.fillRect(-6 * s, r * 0.6, 12 * s, 16 * s)

  // face shape (anime: rounded top, tapered chin)
  ctx.fillStyle = skin
  ctx.beginPath()
  ctx.moveTo(-r * 0.92, -r * 0.25)
  ctx.quadraticCurveTo(-r, -r * 1.15, 0, -r * 1.18)
  ctx.quadraticCurveTo(r, -r * 1.15, r * 0.92, -r * 0.25)
  ctx.quadraticCurveTo(r * 0.8, r * 0.75, 0, r * 1.05)
  ctx.quadraticCurveTo(-r * 0.8, r * 0.75, -r * 0.92, -r * 0.25)
  ctx.closePath()
  ctx.fill()

  // eyes
  const eyeY = -r * 0.05
  const blink = f.anim % 190 < 6
  if (f.state === 'ko') {
    ctx.strokeStyle = '#2a2035'
    ctx.lineWidth = 2.6
    for (const ex of [-r * 0.42, r * 0.42]) {
      ctx.beginPath()
      ctx.moveTo(ex - 5, eyeY - 5)
      ctx.lineTo(ex + 5, eyeY + 5)
      ctx.moveTo(ex + 5, eyeY - 5)
      ctx.lineTo(ex - 5, eyeY + 5)
      ctx.stroke()
    }
  } else if (f.state === 'hit') {
    ctx.strokeStyle = '#2a2035'
    ctx.lineWidth = 2.6
    for (const ex of [-r * 0.42, r * 0.42]) {
      ctx.beginPath()
      ctx.moveTo(ex - 6, eyeY - 3)
      ctx.lineTo(ex + 6, eyeY - 3)
      ctx.stroke()
    }
  } else {
    for (const ex of [-r * 0.42, r * 0.42]) {
      if (blink) {
        ctx.strokeStyle = '#2a2035'
        ctx.lineWidth = 2.4
        ctx.beginPath()
        ctx.moveTo(ex - 6, eyeY)
        ctx.lineTo(ex + 6, eyeY)
        ctx.stroke()
        continue
      }
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.ellipse(ex, eyeY, 6.2, blink ? 1 : 7.4, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = ch.eye
      ctx.beginPath()
      ctx.ellipse(ex + 1.4, eyeY + 0.6, 4.4, 6, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = '#140e1e'
      ctx.beginPath()
      ctx.ellipse(ex + 1.8, eyeY + 1, 2.3, 3.6, 0, 0, TAU)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.arc(ex - 0.6, eyeY - 2.6, 1.7, 0, TAU)
      ctx.fill()
      // brow
      ctx.strokeStyle = shade(ch.hairColor, -10)
      ctx.lineWidth = 2.4
      ctx.beginPath()
      const angry = f.state === 'attack' || f.state === 'super'
      ctx.moveTo(ex - 6, eyeY - 10 + (angry ? 2 : 0))
      ctx.lineTo(ex + 6, eyeY - 11 + (angry ? -2 : 0))
      ctx.stroke()
    }
  }

  // mouth
  ctx.strokeStyle = '#8a4a52'
  ctx.lineWidth = 2
  ctx.beginPath()
  const open = f.state === 'attack' || f.state === 'super' || f.state === 'hit'
  if (open) {
    ctx.moveTo(-4, r * 0.52)
    ctx.quadraticCurveTo(0, r * 0.78, 5, r * 0.5)
  } else {
    ctx.moveTo(-4, r * 0.56)
    ctx.quadraticCurveTo(0, r * 0.66, 4, r * 0.56)
  }
  ctx.stroke()

  ctx.restore()
}

function drawHairBack(ctx, p, ch) {
  const hy = p.headY + (p.headOffsetX ? 0 : 0)
  const hx = p.headOffsetX || 0
  const r = p.headR
  ctx.save()
  ctx.translate(hx, hy)
  ctx.fillStyle = shade(ch.hairColor, -18)
  const sway = p.hairSway

  if (ch.hair === 'long') {
    ctx.beginPath()
    ctx.moveTo(-r * 1.05, -r * 0.5)
    ctx.quadraticCurveTo(-r * 1.9 + sway * 24, r * 1.4, -r * 1.05 + sway * 34, r * 3.6)
    ctx.quadraticCurveTo(-r * 0.3 + sway * 20, r * 2.6, -r * 0.2, r * 0.8)
    ctx.closePath()
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(r * 1.05, -r * 0.5)
    ctx.quadraticCurveTo(r * 1.7 + sway * 18, r * 1.2, r * 0.95 + sway * 26, r * 3.2)
    ctx.quadraticCurveTo(r * 0.35 + sway * 14, r * 2.4, r * 0.25, r * 0.8)
    ctx.closePath()
    ctx.fill()
  } else if (ch.hair === 'spiky') {
    for (let i = -3; i <= 3; i++) {
      const ang = -Math.PI / 2 + i * 0.34 + sway * 0.2
      ctx.beginPath()
      ctx.moveTo(Math.cos(ang + 0.3) * r * 0.9, Math.sin(ang + 0.3) * r * 0.9 - r * 0.1)
      ctx.lineTo(Math.cos(ang) * r * (2.0 + Math.abs(i % 2) * 0.5), Math.sin(ang) * r * (2.0 + Math.abs(i % 2) * 0.5))
      ctx.lineTo(Math.cos(ang - 0.3) * r * 0.9, Math.sin(ang - 0.3) * r * 0.9 - r * 0.1)
      ctx.closePath()
      ctx.fill()
    }
  } else {
    ctx.beginPath()
    ctx.ellipse(0, -r * 0.1, r * 1.18, r * 1.12, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

/** long styles get a front lock so the hair reads over the outfit */
function drawHairOverShoulder(ctx, p, ch) {
  if (ch.hair !== 'long') return
  const r = p.headR
  ctx.save()
  ctx.translate(p.headOffsetX || 0, p.headY)
  ctx.fillStyle = shade(ch.hairColor, 6)
  ctx.beginPath()
  ctx.moveTo(-r * 1.02, r * 0.3)
  ctx.quadraticCurveTo(-r * 1.6 + p.hairSway * 18, r * 2.4, -r * 0.95 + p.hairSway * 26, r * 4.6)
  ctx.quadraticCurveTo(-r * 0.42 + p.hairSway * 14, r * 3.4, -r * 0.62, r * 1.2)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawHairFront(ctx, p, ch) {
  const hy = p.headY
  const hx = p.headOffsetX || 0
  const r = p.headR
  ctx.save()
  ctx.translate(hx, hy)
  const g = ctx.createLinearGradient(0, -r * 1.4, 0, r * 0.6)
  g.addColorStop(0, shade(ch.hairColor, 40))
  g.addColorStop(1, ch.hairColor)
  ctx.fillStyle = g

  // fringe
  ctx.beginPath()
  ctx.moveTo(-r * 1.02, -r * 0.2)
  ctx.quadraticCurveTo(-r * 1.1, -r * 1.35, 0, -r * 1.3)
  ctx.quadraticCurveTo(r * 1.1, -r * 1.35, r * 1.02, -r * 0.2)
  ctx.quadraticCurveTo(r * 0.72, -r * 0.72, r * 0.34, -r * 0.22)
  ctx.quadraticCurveTo(r * 0.12, -r * 0.8, -r * 0.18, -r * 0.16)
  ctx.quadraticCurveTo(-r * 0.44, -r * 0.78, -r * 0.72, -r * 0.2)
  ctx.closePath()
  ctx.fill()

  // highlight streak
  ctx.strokeStyle = rgba(ch.hairAccent, 0.75)
  ctx.lineWidth = 3.2
  ctx.beginPath()
  ctx.moveTo(-r * 0.5, -r * 1.02)
  ctx.quadraticCurveTo(0, -r * 1.28, r * 0.55, -r * 0.98)
  ctx.stroke()

  if (ch.id === 'kuroha') {
    // ribbon
    ctx.fillStyle = ch.hairAccent
    ctx.beginPath()
    ctx.moveTo(r * 0.58, -r * 1.02)
    ctx.lineTo(r * 1.32, -r * 1.42)
    ctx.lineTo(r * 1.22, -r * 0.78)
    ctx.closePath()
    ctx.fill()
  }
  if (ch.id === 'yuki') {
    // ice hairpin
    ctx.fillStyle = '#dffaff'
    ctx.beginPath()
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU - 0.3
      ctx.lineTo(-r * 0.72 + Math.cos(a) * 8, -r * 0.95 + Math.sin(a) * 8)
      ctx.lineTo(-r * 0.72 + Math.cos(a + 0.5) * 3.4, -r * 0.95 + Math.sin(a + 0.5) * 3.4)
    }
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function drawWeapon(ctx, p, ch, f) {
  const s = p.s
  const hx = p.armF.hd[0]
  const hy = p.armF.hd[1]
  ctx.save()
  ctx.translate(hx, hy)

  if (ch.weapon === 'katana') {
    ctx.rotate(p.weaponAngle + (f.state === 'attack' || f.state === 'super' ? 0 : -0.35))
    const len = 116 * s
    // glow
    ctx.shadowColor = rgba(ch.weaponColor, 0.9)
    ctx.shadowBlur = 12
    const g = ctx.createLinearGradient(0, 0, len, 0)
    g.addColorStop(0, '#9fb4d8')
    g.addColorStop(0.6, ch.weaponColor)
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, -5 * s)
    ctx.lineTo(len * 0.86, -3.4 * s)
    ctx.lineTo(len, 0)
    ctx.lineTo(len * 0.86, 4.4 * s)
    ctx.lineTo(0, 5 * s)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0
    // guard + hilt
    ctx.fillStyle = ch.hairAccent
    ctx.fillRect(-6 * s, -9 * s, 7 * s, 18 * s)
    ctx.fillStyle = '#241a2e'
    ctx.fillRect(-34 * s, -5 * s, 28 * s, 10 * s)
  } else if (ch.weapon === 'fan') {
    ctx.rotate(-0.6 + p.weaponOut * 0.9)
    ctx.fillStyle = rgba('#bff2ff', 0.9)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, 46 * s, -1.1, 0.5)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#eaffff'
    ctx.lineWidth = 2
    for (let i = 0; i < 5; i++) {
      const a = -1.1 + (i / 4) * 1.6
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.lineTo(Math.cos(a) * 46 * s, Math.sin(a) * 46 * s)
      ctx.stroke()
    }
  } else if (ch.weapon === 'gauntlet') {
    ctx.fillStyle = shade(ch.weaponColor, -40)
    ctx.beginPath()
    ctx.roundRect(-16 * s, -14 * s, 32 * s, 28 * s, 8)
    ctx.fill()
    ctx.fillStyle = ch.weaponColor
    ctx.fillRect(-14 * s, -4 * s, 28 * s, 5 * s)
  }
  ctx.restore()
}

function drawPoseFx(ctx, p, ch) {
  if (!p.fx) return
  ctx.save()
  if (p.fx === 'jab') {
    const x = p.armF.hd[0]
    const y = p.armF.hd[1]
    ctx.strokeStyle = rgba('#ffffff', 0.8)
    ctx.lineWidth = 3
    for (let i = 0; i < 3; i++) {
      ctx.beginPath()
      ctx.arc(x, y, 16 + i * 12, -0.7, 0.7)
      ctx.stroke()
    }
  } else if (p.fx === 'kick') {
    const x = p.legF.ft[0]
    const y = p.legF.ft[1]
    const g = ctx.createRadialGradient(x, y, 4, x, y, 70)
    g.addColorStop(0, rgba(ch.aura, 0.95))
    g.addColorStop(1, rgba(ch.aura, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 70, 0, TAU)
    ctx.fill()
  } else if (p.fx === 'slashBig' || p.fx === 'super') {
    const x = p.armF.hd[0]
    const y = p.armF.hd[1]
    const power = p.fx === 'super' ? 1.7 : 1
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba(ch.aura, 0.85 - i * 0.22)
      ctx.lineWidth = (16 - i * 4) * power
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.arc(x * 0.6, y, (70 + i * 26) * power, -1.15 + i * 0.08, 0.85 + i * 0.08)
      ctx.stroke()
    }
    ctx.strokeStyle = rgba('#ffffff', 0.95)
    ctx.lineWidth = 4 * power
    ctx.beginPath()
    ctx.arc(x * 0.6, y, 74 * power, -1.1, 0.8)
    ctx.stroke()
  } else if (p.fx === 'cast') {
    const x = p.armF.hd[0] + 22
    const y = p.armF.hd[1]
    ctx.globalCompositeOperation = 'lighter'
    const g = ctx.createRadialGradient(x, y, 2, x, y, 52)
    g.addColorStop(0, rgba(ch.aura, 0.95))
    g.addColorStop(1, rgba(ch.aura, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 52, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

// ---------------------------------------------------------------------------
// STAGE
// ---------------------------------------------------------------------------

let stageCache = null
let stageCacheKey = ''

function buildStage(theme) {
  const c = document.createElement('canvas')
  c.width = WORLD_W
  c.height = WORLD_H
  const x = c.getContext('2d')

  // sky
  const sky = x.createLinearGradient(0, 0, 0, WORLD_H)
  if (theme === 'shrine') {
    sky.addColorStop(0, '#120a2a')
    sky.addColorStop(0.45, '#2b1147')
    sky.addColorStop(0.75, '#5b1c4c')
    sky.addColorStop(1, '#0b0716')
  } else {
    sky.addColorStop(0, '#040714')
    sky.addColorStop(0.5, '#0b1330')
    sky.addColorStop(0.8, '#131f4a')
    sky.addColorStop(1, '#05070f')
  }
  x.fillStyle = sky
  x.fillRect(0, 0, WORLD_W, WORLD_H)

  // moon
  const mx = 1010
  const my = 132
  const mg = x.createRadialGradient(mx, my, 10, mx, my, 220)
  mg.addColorStop(0, 'rgba(255,236,214,0.55)')
  mg.addColorStop(0.25, 'rgba(255,200,160,0.14)')
  mg.addColorStop(1, 'rgba(255,200,160,0)')
  x.fillStyle = mg
  x.beginPath()
  x.arc(mx, my, 220, 0, TAU)
  x.fill()
  x.fillStyle = theme === 'shrine' ? '#ffe9d2' : '#dff0ff'
  x.beginPath()
  x.arc(mx, my, 62, 0, TAU)
  x.fill()
  x.fillStyle = 'rgba(0,0,0,0.07)'
  x.beginPath()
  x.arc(mx - 18, my - 12, 14, 0, TAU)
  x.arc(mx + 22, my + 16, 10, 0, TAU)
  x.arc(mx + 4, my + 30, 7, 0, TAU)
  x.fill()

  // stars
  let seed = 99
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < 150; i++) {
    const sx = rnd() * WORLD_W
    const sy = rnd() * 420
    const a = 0.2 + rnd() * 0.7
    x.fillStyle = `rgba(255,255,255,${a * 0.8})`
    x.fillRect(sx, sy, rnd() > 0.85 ? 2 : 1, rnd() > 0.85 ? 2 : 1)
  }

  // distant mountains / skyline
  x.fillStyle = theme === 'shrine' ? 'rgba(24,10,44,0.95)' : 'rgba(10,16,40,0.95)'
  x.beginPath()
  x.moveTo(0, 470)
  for (let i = 0; i <= 12; i++) {
    const px = (i / 12) * WORLD_W
    const py = 470 - Math.abs(Math.sin(i * 1.7)) * 130 - (i % 3) * 24
    x.lineTo(px, py)
  }
  x.lineTo(WORLD_W, WORLD_H)
  x.lineTo(0, WORLD_H)
  x.closePath()
  x.fill()

  if (theme === 'shrine') {
    // torii gate
    x.fillStyle = '#7d1330'
    x.fillRect(520, 300, 26, 300)
    x.fillRect(740, 300, 26, 300)
    x.fillStyle = '#a51a3d'
    x.fillRect(470, 282, 350, 26)
    x.fillRect(498, 336, 292, 18)
    x.fillStyle = '#5c0d22'
    x.fillRect(470, 274, 350, 10)

    // lanterns
    for (const lx of [180, 1100]) {
      x.fillStyle = '#2a1a12'
      x.fillRect(lx - 8, 400, 16, 200)
      x.fillStyle = '#ff9c4a'
      x.beginPath()
      x.roundRect(lx - 26, 350, 52, 60, 10)
      x.fill()
      const lg = x.createRadialGradient(lx, 380, 4, lx, 380, 120)
      lg.addColorStop(0, 'rgba(255,170,80,0.5)')
      lg.addColorStop(1, 'rgba(255,170,80,0)')
      x.fillStyle = lg
      x.beginPath()
      x.arc(lx, 380, 120, 0, TAU)
      x.fill()
    }
  } else {
    // neon city
    const buildings = [
      [40, 330, 130, 280],
      [180, 380, 90, 230],
      [290, 300, 150, 310],
      [460, 400, 110, 210],
      [590, 340, 140, 270],
      [750, 390, 100, 220],
      [870, 310, 160, 300],
      [1050, 370, 120, 240],
      [1180, 330, 90, 280],
    ]
    for (const [bx, by, bw, bh] of buildings) {
      x.fillStyle = '#0a0f26'
      x.fillRect(bx, by, bw, bh)
      x.strokeStyle = 'rgba(90,130,255,0.22)'
      x.lineWidth = 2
      x.strokeRect(bx, by, bw, bh)
      for (let wy = by + 16; wy < by + bh - 12; wy += 22) {
        for (let wx = bx + 12; wx < bx + bw - 12; wx += 20) {
          if (rnd() > 0.55) {
            x.fillStyle = rnd() > 0.7 ? 'rgba(255,80,160,0.55)' : 'rgba(120,220,255,0.5)'
            x.fillRect(wx, wy, 8, 10)
          }
        }
      }
    }
  }

  // mid trees / silhouettes (layered pines)
  x.fillStyle = 'rgba(7,9,22,0.92)'
  for (let i = 0; i < 20; i++) {
    const tx = i * 68 + (rnd() * 24 - 12)
    const th = 110 + rnd() * 110
    const tw = 26 + rnd() * 14
    x.fillRect(tx + tw / 2 - 3, 600 - th * 0.25, 6, th * 0.25)
    for (let l = 0; l < 3; l++) {
      const ly = 600 - th * (0.18 + l * 0.27)
      const lw = tw * (1 - l * 0.26)
      x.beginPath()
      x.moveTo(tx + tw / 2 - lw / 2, ly)
      x.lineTo(tx + tw / 2, ly - th * 0.34)
      x.lineTo(tx + tw / 2 + lw / 2, ly)
      x.closePath()
      x.fill()
    }
  }

  // ground
  const gg = x.createLinearGradient(0, GROUND_Y - 40, 0, WORLD_H)
  gg.addColorStop(0, theme === 'shrine' ? '#2a1a34' : '#141a34')
  gg.addColorStop(1, '#05060d')
  x.fillStyle = gg
  x.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y)

  // floor line + reflection sheen
  x.strokeStyle = theme === 'shrine' ? 'rgba(255,120,180,0.5)' : 'rgba(80,200,255,0.45)'
  x.lineWidth = 3
  x.beginPath()
  x.moveTo(0, GROUND_Y)
  x.lineTo(WORLD_W, GROUND_Y)
  x.stroke()
  const sh = x.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 90)
  sh.addColorStop(0, 'rgba(255,255,255,0.10)')
  sh.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = sh
  x.fillRect(0, GROUND_Y, WORLD_W, 90)

  // floor tiles
  x.strokeStyle = 'rgba(255,255,255,0.05)'
  x.lineWidth = 1
  for (let i = 0; i < 20; i++) {
    x.beginPath()
    x.moveTo(i * 68, GROUND_Y)
    x.lineTo(i * 68 - 60, WORLD_H)
    x.stroke()
  }
  return c
}

export function drawStage(ctx, theme, t) {
  if (!stageCache || stageCacheKey !== theme) {
    stageCache = buildStage(theme)
    stageCacheKey = theme
  }
  ctx.drawImage(stageCache, 0, 0)

  // drifting petals / motes (animated on top of the cached backdrop)
  const petals = theme === 'shrine' ? 46 : 34
  for (let i = 0; i < petals; i++) {
    const seedp = i * 97.13
    const speed = 0.35 + (i % 5) * 0.14
    const px = ((seedp + t * speed * 1.6) % (WORLD_W + 120)) - 60
    const py = ((seedp * 1.7 + t * speed * 0.9) % (WORLD_H + 80)) - 40
    const size = 3 + (i % 4)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(t * 0.02 + i)
    ctx.fillStyle = theme === 'shrine' ? `rgba(255,150,200,${0.28 + (i % 3) * 0.1})` : `rgba(120,220,255,${0.2 + (i % 3) * 0.08})`
    ctx.beginPath()
    ctx.ellipse(0, 0, size, size * 0.55, 0, 0, TAU)
    ctx.fill()
    ctx.restore()
  }

  // ground light pools under fighters
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.restore()
}

// ---------------------------------------------------------------------------
// FX layer
// ---------------------------------------------------------------------------

export function drawEffects(ctx, match) {
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'

  for (const p of match.particles) {
    const a = Math.max(0, p.life / p.max)
    if (p.kind === 'ring') {
      ctx.strokeStyle = rgba(p.color, a * 0.8)
      ctx.lineWidth = 3 + a * 5
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, TAU)
      ctx.stroke()
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = rgba(p.color, a)
      ctx.lineWidth = p.size * 0.8
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(p.x - p.vx * 3.2, p.y - p.vy * 3.2)
      ctx.stroke()
    } else {
      ctx.fillStyle = rgba(p.color, a * 0.85)
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * a, 0, TAU)
      ctx.fill()
    }
  }

  // projectiles
  for (const pr of match.projectiles) {
    ctx.save()
    ctx.translate(pr.x, pr.y)
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, pr.size * 2.2)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.35, pr.color)
    g.addColorStop(1, rgba(pr.color, 0))
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(0, 0, pr.size * 2.2, 0, TAU)
    ctx.fill()
    ctx.rotate(pr.spin)
    ctx.fillStyle = '#ffffff'
    if (pr.element === 'ice') {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU
        ctx.lineTo(Math.cos(a) * pr.size, Math.sin(a) * pr.size)
        ctx.lineTo(Math.cos(a + 0.52) * pr.size * 0.42, Math.sin(a + 0.52) * pr.size * 0.42)
      }
      ctx.closePath()
      ctx.fill()
    } else {
      ctx.beginPath()
      ctx.arc(0, 0, pr.size * 0.6, 0, TAU)
      ctx.fill()
    }
    ctx.restore()
  }

  // floating damage numbers
  ctx.globalCompositeOperation = 'source-over'
  for (const n of match.numbers) {
    const a = Math.min(1, n.life / 24)
    const pop = 1 + (1 - n.life / n.max) * 0.1
    ctx.save()
    ctx.globalAlpha = a
    ctx.translate(n.x, n.y)
    ctx.scale(pop, pop)
    ctx.font = `900 ${n.label ? 26 : 34}px "Archivo Black", Impact, sans-serif`
    ctx.textAlign = 'center'
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.8)'
    if (n.label) {
      ctx.strokeText(n.label, 0, 0)
      ctx.fillStyle = n.color
      ctx.fillText(n.label, 0, 0)
      ctx.font = `900 22px "Archivo Black", Impact, sans-serif`
      ctx.strokeText(String(n.value), 0, 26)
      ctx.fillStyle = '#ffffff'
      ctx.fillText(String(n.value), 0, 26)
    } else {
      ctx.strokeText(String(n.value), 0, 0)
      ctx.fillStyle = n.color
      ctx.fillText(String(n.value), 0, 0)
    }
    ctx.restore()
  }

  ctx.restore()
}

// ---------------------------------------------------------------------------
// MAIN FRAME
// ---------------------------------------------------------------------------

export function renderMatch(ctx, match, view, opts = {}) {
  const { w, h } = view
  const t = match.frame

  ctx.save()
  ctx.clearRect(0, 0, w, h)

  // letterbox scale: fit the 1280x720 world into the canvas
  const base = Math.min(w / WORLD_W, h / WORLD_H)
  const zoom = base * (view.zoom ?? 1)
  const shakeX = (Math.sin(t * 1.7) + Math.sin(t * 3.1)) * match.shake * 0.5
  const shakeY = Math.cos(t * 2.3) * match.shake * 0.5

  ctx.translate(w / 2 + shakeX * zoom * 0.4, h / 2 + shakeY * zoom * 0.4)
  ctx.scale(zoom, zoom)
  ctx.translate(-view.cx, -view.cy)

  drawStage(ctx, opts.theme || 'shrine', t)

  // motion ghosts on fast attacks
  for (const f of match.fighters) {
    if ((f.state === 'attack' || f.state === 'super' || Math.abs(f.vx) > 7) && f.dashTrail.length > 2) {
      const trail = f.dashTrail[f.dashTrail.length - 2]
      ctx.save()
      ctx.globalAlpha = 0.22
      ctx.translate(trail.x - f.x, trail.y - f.y)
      drawFighter(ctx, f, 0.25)
      ctx.restore()
    }
  }

  // draw the fighter further back first
  const order = [...match.fighters].sort((x, y) => x.y - y.y)
  for (const f of order) drawFighter(ctx, f)

  drawEffects(ctx, match)

  // super flash (white-out)
  if (match.flash > 0.01) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.75, match.flash)})`
    ctx.fillRect(view.cx - WORLD_W, view.cy - WORLD_H, WORLD_W * 3, WORLD_H * 3)
  }

  // vignette
  const vg = ctx.createRadialGradient(view.cx, view.cy, WORLD_H * 0.32, view.cx, view.cy, WORLD_H * 0.95)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.62)')
  ctx.fillStyle = vg
  ctx.fillRect(view.cx - WORLD_W, view.cy - WORLD_H, WORLD_W * 3, WORLD_H * 3)

  ctx.restore()
}

// camera ------------------------------------------------------------------
export function makeCamera() {
  return { cx: WORLD_W / 2, cy: WORLD_H / 2, zoom: 1 }
}

export function updateCamera(cam, match, smooth = 0.12) {
  const [a, b] = match.fighters
  const midX = (a.x + b.x) / 2
  const dist = Math.abs(a.x - b.x)
  const minY = Math.min(a.y, b.y)
  const targetZoom = Math.max(0.84, Math.min(1.16, 1.22 - dist / 2200))
  const targetCx = Math.max(WORLD_W / 2 * targetZoom, Math.min(WORLD_W - (WORLD_W / 2) * targetZoom, midX))
  const targetCy = WORLD_H / 2 + Math.max(0, (GROUND_Y - minY - 120)) * 0.18

  cam.cx += (targetCx - cam.cx) * smooth
  cam.cy += (targetCy - cam.cy) * smooth
  cam.zoom += (targetZoom - cam.zoom) * smooth
  return cam
}
