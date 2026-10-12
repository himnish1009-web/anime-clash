// ---------------------------------------------------------------------------
// Tiny procedural sound engine (WebAudio). No audio files, everything is
// synthesised on the fly so the bundle stays small.
// ---------------------------------------------------------------------------

let ctx = null
let master = null
let muted = false

function ensure() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain()
  master.gain.value = 0.5
  master.connect(ctx.destination)
  return ctx
}

export function unlockAudio() {
  const c = ensure()
  if (c && c.state === 'suspended') c.resume()
}

export function setMuted(v) {
  muted = v
  if (master) master.gain.value = v ? 0 : 0.5
}

export function isMuted() {
  return muted
}

function noiseBuffer(c, dur = 0.4) {
  const len = Math.floor(c.sampleRate * dur)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  return buf
}

function tone({ freq = 220, type = 'sine', dur = 0.2, gain = 0.3, sweep = 0, delay = 0 }) {
  const c = ensure()
  if (!c || muted) return
  const t0 = c.currentTime + delay
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t0)
  if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + sweep), t0 + dur)
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  o.connect(g)
  g.connect(master)
  o.start(t0)
  o.stop(t0 + dur + 0.02)
}

function noise({ dur = 0.2, gain = 0.3, filter = 1200, type = 'lowpass', delay = 0, q = 1 }) {
  const c = ensure()
  if (!c || muted) return
  const t0 = c.currentTime + delay
  const src = c.createBufferSource()
  src.buffer = noiseBuffer(c, Math.max(0.05, dur))
  const f = c.createBiquadFilter()
  f.type = type
  f.frequency.setValueAtTime(filter, t0)
  f.Q.value = q
  const g = c.createGain()
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.02)
}

export const sfx = {
  swing() {
    noise({ dur: 0.14, gain: 0.16, filter: 2400, type: 'bandpass', q: 1.4 })
  },
  hit(power = 1) {
    noise({ dur: 0.12 * power, gain: 0.4 * power, filter: 900 + power * 700, type: 'lowpass' })
    tone({ freq: 150 * (1.3 - power * 0.2), type: 'square', dur: 0.1 * power, gain: 0.22, sweep: -90 })
  },
  block() {
    tone({ freq: 880, type: 'triangle', dur: 0.1, gain: 0.2, sweep: 320 })
    noise({ dur: 0.08, gain: 0.16, filter: 4200, type: 'highpass' })
  },
  jump() {
    tone({ freq: 300, type: 'sine', dur: 0.14, gain: 0.14, sweep: 320 })
  },
  land() {
    noise({ dur: 0.1, gain: 0.14, filter: 400 })
  },
  projectile() {
    tone({ freq: 700, type: 'sawtooth', dur: 0.3, gain: 0.12, sweep: -500 })
    noise({ dur: 0.25, gain: 0.1, filter: 3000, type: 'bandpass' })
  },
  superCharge() {
    tone({ freq: 90, type: 'sawtooth', dur: 0.9, gain: 0.22, sweep: 900 })
    tone({ freq: 180, type: 'square', dur: 0.9, gain: 0.1, sweep: 1200 })
    noise({ dur: 0.9, gain: 0.1, filter: 600, type: 'lowpass' })
  },
  ko() {
    tone({ freq: 420, type: 'sawtooth', dur: 0.7, gain: 0.3, sweep: -360 })
    noise({ dur: 0.6, gain: 0.3, filter: 700 })
    tone({ freq: 70, type: 'sine', dur: 1.1, gain: 0.3, sweep: -30, delay: 0.05 })
  },
  bell() {
    tone({ freq: 1180, type: 'sine', dur: 0.5, gain: 0.2 })
    tone({ freq: 1770, type: 'sine', dur: 0.4, gain: 0.1, delay: 0.02 })
  },
  ui(up = true) {
    tone({ freq: up ? 620 : 380, type: 'triangle', dur: 0.08, gain: 0.14, sweep: up ? 260 : -140 })
  },
  victory() {
    const notes = [523, 659, 784, 1046]
    notes.forEach((n, i) => tone({ freq: n, type: 'triangle', dur: 0.35, gain: 0.18, delay: i * 0.12 }))
  },
  defeat() {
    const notes = [392, 330, 262, 196]
    notes.forEach((n, i) => tone({ freq: n, type: 'sawtooth', dur: 0.4, gain: 0.14, delay: i * 0.14 }))
  },
  connect() {
    tone({ freq: 880, type: 'sine', dur: 0.12, gain: 0.16 })
    tone({ freq: 1320, type: 'sine', dur: 0.18, gain: 0.12, delay: 0.1 })
  },
}

// ---------------------------------------------------------------------------
// Optional lo-fi battle loop so the fight does not feel silent.
// ---------------------------------------------------------------------------
let loopTimer = null
let step = 0

export function startMusic() {
  const c = ensure()
  if (!c || loopTimer) return
  const bass = [55, 55, 73.4, 65.4]
  loopTimer = setInterval(() => {
    if (muted) return
    const i = step % 8
    if (i % 2 === 0) tone({ freq: bass[(step >> 1) % 4], type: 'triangle', dur: 0.26, gain: 0.11 })
    if (i === 2 || i === 6) noise({ dur: 0.06, gain: 0.05, filter: 6000, type: 'highpass' })
    if (step % 16 === 0) tone({ freq: 220, type: 'sine', dur: 0.5, gain: 0.05 })
    step++
  }, 240)
}

export function stopMusic() {
  if (loopTimer) clearInterval(loopTimer)
  loopTimer = null
  step = 0
}
