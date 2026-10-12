import { useState } from 'react'
import Logo from './Logo.jsx'
import Portrait from './Portrait.jsx'
import Reveal from './Reveal.jsx'
import { CHARACTERS, byId } from '../game/characters.js'
import { sfx, unlockAudio } from '../game/audio.js'

const MODES = [
  {
    id: 'cpu',
    tag: 'SINGLE PLAYER',
    name: 'Training Hall',
    desc: 'Fight the CPU across three difficulty tiers. Learn cancels, spacing and super timing before you take it online.',
    accent: 'from-cyan/25 to-transparent',
    ring: 'hover:border-cyan/60',
    char: 'yuki',
  },
  {
    id: 'local',
    tag: '2 PLAYERS · 1 KEYBOARD',
    name: 'Local Versus',
    desc: 'Hand a friend the arrow keys. WASD vs Arrows, blind character select, best of three — couch rivalry included.',
    accent: 'from-neon/25 to-transparent',
    ring: 'hover:border-neon/60',
    char: 'kuroha',
  },
  {
    id: 'online',
    tag: 'RANKED · REAL TIME',
    name: 'Online PvP',
    desc: 'Queue into the arena server and duel a stranger. Frame-perfect lockstep netcode keeps both fighters identical.',
    accent: 'from-violet/25 to-transparent',
    ring: 'hover:border-violet/60',
    char: 'renji',
  },
]

const FEATURES = [
  { k: '60Hz', v: 'Lockstep simulation' },
  { k: 'Bo3', v: 'Round-based bouts' },
  { k: '4', v: 'Hand-drawn fighters' },
  { k: '0', v: 'Image assets — all procedural' },
]

const CONTROLS = [
  { p: 'PLAYER 1', color: 'text-cyan', rows: [['Move', 'A / D'], ['Jump', 'W'], ['Crouch', 'S'], ['Block', 'hold A (away)'], ['Light', 'F'], ['Heavy', 'G'], ['Special', 'H'], ['Ultimate', 'T']] },
  { p: 'PLAYER 2', color: 'text-neon', rows: [['Move', '← / →'], ['Jump', '↑'], ['Crouch', '↓'], ['Block', 'hold ← (away)'], ['Light', 'J'], ['Heavy', 'K'], ['Special', 'L'], ['Ultimate', ';']] },
]

export default function Landing({ onPlay }) {
  const [hover, setHover] = useState('kuroha')
  const go = (mode) => {
    unlockAudio()
    sfx.ui()
    onPlay(mode)
  }
  const heroChar = byId(hover)

  return (
    <div className="relative min-h-screen">
      {/* ---------- nav ---------- */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-void/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-white/60 md:flex">
            <a href="#modes" className="transition hover:text-white">Modes</a>
            <a href="#roster" className="transition hover:text-white">Roster</a>
            <a href="#controls" className="transition hover:text-white">Controls</a>
          </nav>
          <button
            onClick={() => go('local')}
            className="clip-tag bg-neon px-5 py-2 font-display text-xs tracking-widest text-void transition hover:brightness-110"
          >
            PLAY NOW
          </button>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div
          className="pointer-events-none absolute -left-40 top-0 h-[520px] w-[520px] rounded-full opacity-40 blur-[120px] anim-pulse-glow"
          style={{ background: 'radial-gradient(circle,#ff2e88,transparent 70%)' }}
        />
        <div
          className="pointer-events-none absolute -right-32 top-24 h-[560px] w-[560px] rounded-full opacity-35 blur-[130px]"
          style={{ background: 'radial-gradient(circle,#22e1ff,transparent 70%)' }}
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:pt-20">
          <div className="anim-slide-up">
            <span className="clip-tag inline-block bg-white/10 px-3 py-1 font-display text-[11px] tracking-[0.25em] text-cyan">
              BROWSER FIGHTING GAME · NO DOWNLOAD
            </span>
            <h1 className="mt-5 font-display text-[clamp(2.8rem,8vw,5.6rem)] leading-[0.86] tracking-tight">
              ANIME
              <br />
              <span className="text-neon text-glow">CLASH</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-white/65">
              A 2D versus fighter with a full anime roster. Combo cancel into supers, guard the mixup,
              read your opponent — then take it online against a real player in frame-perfect lockstep.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => go('online')}
                className="group clip-slash relative bg-neon px-8 py-4 font-display text-sm tracking-widest text-void transition hover:brightness-110"
              >
                <span className="relative z-10">⚔ FIGHT ONLINE</span>
              </button>
              <button
                onClick={() => go('local')}
                className="clip-slash border border-white/20 bg-white/5 px-8 py-4 font-display text-sm tracking-widest text-white transition hover:border-cyan/60 hover:text-cyan"
              >
                LOCAL VERSUS
              </button>
              <button
                onClick={() => go('cpu')}
                className="clip-slash border border-white/10 px-6 py-4 font-display text-sm tracking-widest text-white/60 transition hover:border-white/40 hover:text-white"
              >
                VS CPU
              </button>
            </div>

            <div className="mt-10 grid max-w-md grid-cols-4 gap-4 border-t border-white/10 pt-6">
              {FEATURES.map((f) => (
                <div key={f.k}>
                  <div className="font-display text-xl text-white">{f.k}</div>
                  <div className="mt-1 text-[11px] leading-tight text-white/40">{f.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* hero portrait stage */}
          <div className="relative">
            <div
              className="relative mx-auto aspect-[3/4] w-full max-w-md overflow-hidden rounded-2xl border border-white/10 scanlines"
              style={{ background: `radial-gradient(circle at 50% 30%, ${heroChar.aura}22, #07091400 65%), linear-gradient(180deg,#0d1024,#05060d)` }}
            >
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 opacity-60"
                style={{ background: `linear-gradient(0deg, ${heroChar.aura}30, transparent)` }}
              />
              <div className="absolute inset-0 anim-float">
                <Portrait ch={heroChar} />
              </div>
              <div className="absolute left-5 top-5">
                <div className="font-display text-3xl leading-none text-white drop-shadow">{heroChar.name}</div>
                <div className="mt-1 text-xs tracking-[0.2em]" style={{ color: heroChar.aura }}>
                  {heroChar.title.toUpperCase()}
                </div>
              </div>
              <div className="absolute bottom-5 left-5 right-5">
                <p className="text-sm italic text-white/70">{heroChar.quote}</p>
                <div className="mt-3 flex gap-2">
                  {CHARACTERS.map((c) => (
                    <button
                      key={c.id}
                      onMouseEnter={() => setHover(c.id)}
                      onClick={() => setHover(c.id)}
                      className="h-2 flex-1 rounded-full transition"
                      style={{ background: hover === c.id ? c.aura : 'rgba(255,255,255,0.16)' }}
                      aria-label={c.name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ticker */}
        <div className="relative border-y border-white/10 bg-white/[0.03] py-3">
          <div className="flex w-max anim-marquee">
            {Array.from({ length: 2 }).map((_, k) => (
              <div key={k} className="flex shrink-0 items-center gap-8 pr-8 font-display text-sm tracking-[0.2em] text-white/40">
                {['ROUND 1 — FIGHT', 'PERFECT', 'COUNTER HIT', 'MAX METER', 'ULTIMATE READY', 'K.O.', 'BEST OF THREE', 'LOCKSTEP NETCODE'].map((t) => (
                  <span key={t} className="flex items-center gap-8">
                    {t} <span className="text-neon">◆</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- modes ---------- */}
      <section id="modes" className="mx-auto max-w-7xl px-5 py-20">
        <Reveal>
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="font-display text-xs tracking-[0.3em] text-neon">01 — CHOOSE YOUR BATTLE</div>
              <h2 className="mt-3 font-display text-4xl leading-none md:text-5xl">THREE WAYS TO FIGHT</h2>
            </div>
            <p className="hidden max-w-sm text-sm text-white/45 md:block">
              Every mode runs the same simulation, so nothing you learn in the training hall is lost online.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {MODES.map((m, i) => (
            <Reveal key={m.id} delay={i * 110}>
              <button
                onClick={() => go(m.id)}
                className={`panel group relative flex h-full w-full flex-col overflow-hidden rounded-xl p-6 text-left transition duration-300 hover:-translate-y-1 ${m.ring}`}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${m.accent} opacity-0 transition duration-500 group-hover:opacity-100`} />
                <div className="pointer-events-none absolute -right-10 -top-6 h-52 w-40 opacity-25 transition duration-500 group-hover:opacity-70 group-hover:scale-105">
                  <Portrait ch={byId(m.char)} animate={false} />
                </div>
                <span className="relative font-display text-[10px] tracking-[0.25em] text-white/40">{m.tag}</span>
                <h3 className="relative mt-3 font-display text-2xl">{m.name}</h3>
                <p className="relative mt-3 flex-1 text-sm leading-relaxed text-white/55">{m.desc}</p>
                <span className="relative mt-6 inline-flex items-center gap-2 font-display text-xs tracking-widest text-white transition group-hover:gap-4">
                  ENTER <span>→</span>
                </span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- roster ---------- */}
      <section id="roster" className="relative border-y border-white/10 bg-white/[0.02] py-20">
        <div className="mx-auto max-w-7xl px-5">
          <Reveal>
            <div className="font-display text-xs tracking-[0.3em] text-cyan">02 — THE ROSTER</div>
            <h2 className="mt-3 font-display text-4xl leading-none md:text-5xl">FOUR FIGHTERS, FOUR STYLES</h2>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {CHARACTERS.map((c, i) => (
              <Reveal key={c.id} delay={i * 90}>
                <button
                  onClick={() => go('cpu')}
                  onMouseEnter={() => setHover(c.id)}
                  className="panel group relative h-80 w-full overflow-hidden rounded-xl text-left transition duration-300 hover:-translate-y-1.5"
                  style={{ borderColor: `${c.aura}44` }}
                >
                  <div
                    className="absolute inset-0 opacity-30 transition duration-500 group-hover:opacity-70"
                    style={{ background: `radial-gradient(circle at 50% 80%, ${c.aura}, transparent 65%)` }}
                  />
                  <div className="absolute inset-x-0 bottom-0 top-6 transition duration-500 group-hover:scale-105">
                    <Portrait ch={c} animate={false} />
                  </div>
                  <div className="absolute left-4 top-4">
                    <div className="font-display text-lg leading-none">{c.name}</div>
                    <div className="mt-1 text-[10px] tracking-[0.2em]" style={{ color: c.aura }}>
                      {c.role.toUpperCase()}
                    </div>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-void via-void/85 to-transparent p-4 pt-10">
                    <p className="text-xs leading-relaxed text-white/60">{c.tagline}</p>
                    <div className="mt-3 flex gap-1">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <span
                          key={k}
                          className="h-1 flex-1 rounded-full"
                          style={{ background: k < c.difficulty ? c.aura : 'rgba(255,255,255,0.14)' }}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- controls ---------- */}
      <section id="controls" className="mx-auto max-w-7xl px-5 py-20">
        <Reveal>
          <div className="font-display text-xs tracking-[0.3em] text-violet">03 — INPUTS</div>
          <h2 className="mt-3 font-display text-4xl leading-none md:text-5xl">KEYBOARD CONTROLS</h2>
          <p className="mt-4 max-w-xl text-sm text-white/50">
            Both fighters can share one keyboard. Hold <span className="text-white">away</span> from your opponent to guard —
            guarding chips a little health but builds meter fast. Fill the meter to unlock your Ultimate.
          </p>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {CONTROLS.map((c, i) => (
            <Reveal key={c.p} delay={i * 120}>
              <div className="panel rounded-xl p-6">
                <div className={`font-display text-sm tracking-[0.25em] ${c.color}`}>{c.p}</div>
                <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3">
                  {c.rows.map(([label, key]) => (
                    <div key={label} className="flex items-center justify-between gap-3 border-b border-white/5 pb-2">
                      <span className="text-sm text-white/50">{label}</span>
                      <kbd className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 font-display text-[11px] tracking-wider text-white">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- cta ---------- */}
      <section className="relative overflow-hidden border-t border-white/10 py-24">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{ background: 'radial-gradient(ellipse at 50% 120%, #ff2e8833, transparent 60%)' }}
        />
        <div className="relative mx-auto max-w-3xl px-5 text-center">
          <Reveal>
            <h2 className="font-display text-[clamp(2rem,6vw,3.6rem)] leading-none">
              READY, <span className="text-neon text-glow anim-flicker">FIGHTER?</span>
            </h2>
            <p className="mx-auto mt-5 max-w-md text-sm text-white/50">
              No install, no account. Pick a character and start swinging in about four seconds.
            </p>
            <button
              onClick={() => go('local')}
              className="clip-slash mt-9 bg-white px-10 py-4 font-display text-sm tracking-widest text-void transition hover:bg-neon"
            >
              START A MATCH
            </button>
          </Reveal>
        </div>
      </section>

      <footer className="border-t border-white/10 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-5 text-xs text-white/35 md:flex-row">
          <Logo className="opacity-60" />
          <p>Built with React, Tailwind and a hand-written canvas fighting-game engine.</p>
          <a href="#modes" className="transition hover:text-white">Back to top ↑</a>
        </div>
      </footer>
    </div>
  )
}
