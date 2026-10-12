import { useCallback, useEffect, useRef, useState } from 'react'
import { createMatch, stepMatch, snapshot } from './sim.js'
import { makeCamera, renderMatch, updateCamera } from './render.js'
import { createKeyboard } from './input.js'
import { createAi } from './ai.js'
import { NET_STATE } from './net.js'
import { sfx, setMuted, startMusic, stopMusic, unlockAudio } from './audio.js'
import { byId } from './characters.js'
import { TICK } from './constants.js'
import Hud from './Hud.jsx'

const THEME = { kuroha: 'shrine', renji: 'city', 'yuki-onna': 'city', goro: 'shrine' }

export default function Battle({ config, onExit, onRematch, onChangeChars }) {
  const { mode, p1Char, p2Char, difficulty = 'normal', seed = 20261012, net = null } = config

  const canvasRef = useRef(null)
  const [hud, setHud] = useState(null)
  const [paused, setPaused] = useState(false)
  const [muted, setMutedState] = useState(false)
  const [result, setResult] = useState(null)
  const [netInfo, setNetInfo] = useState({ state: NET_STATE.CONNECTING, ping: 0, error: null })
  const [stuck, setStuck] = useState(false)

  // mutable game refs (never trigger React re-renders)
  const g = useRef({
    match: null,
    cam: makeCamera(),
    keys: null,
    ai: null,
    net: null,
    acc: 0,
    last: 0,
    raf: 0,
    frame: 0,
    waitFrames: 0,
    lastAnnounce: '',
    lastPhase: '',
    prevHp: [0, 0],
    prevMeter: [0, 0],
    prevProj: 0,
    prevState: ['idle', 'idle'],
    running: false,
  })

  const pausedRef = useRef(false)
  pausedRef.current = paused

  // ------------------------------------------------------------------ setup
  useEffect(() => {
    unlockAudio()
    startMusic()
    const st = g.current
    st.keys = createKeyboard()
    st.cam = makeCamera()
    st.match = createMatch(p1Char, p2Char, seed)
    st.prevHp = [st.match.fighters[0].hp, st.match.fighters[1].hp]
    st.prevMeter = [0, 0]
    if (mode === 'cpu') st.ai = createAi(difficulty)

    if (mode === 'online' && net) {
      st.net = net
      setNetInfo({ state: NET_STATE.INGAME, ping: net.ping, error: null })
    }

    const onResize = () => sizeCanvas()
    window.addEventListener('resize', onResize)
    sizeCanvas()
    st.last = performance.now()
    st.running = true
    st.raf = requestAnimationFrame(loop)

    return () => {
      st.running = false
      cancelAnimationFrame(st.raf)
      window.removeEventListener('resize', onResize)
      st.keys?.destroy()
      st.net?.disconnect()
      stopMusic()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // pause on Escape (offline modes)
  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape' && mode !== 'online') setPaused((p) => !p)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode])

  function sizeCanvas() {
    const c = canvasRef.current
    if (!c) return
    const rect = c.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    c.width = Math.max(320, Math.floor(rect.width * dpr))
    c.height = Math.max(180, Math.floor(rect.height * dpr))
    const ctx = c.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // ------------------------------------------------------------------ audio cues
  function audioCues(st) {
    const m = st.match
    for (const f of m.fighters) {
      const i = f.p
      if (f.hp < st.prevHp[i]) {
        const diff = st.prevHp[i] - f.hp
        if (f.state === 'block' || f.blockStun > 0) sfx.block()
        else sfx.hit(Math.min(1.6, 0.6 + diff / 130))
        st.prevHp[i] = f.hp
      } else if (f.hp > st.prevHp[i]) {
        st.prevHp[i] = f.hp
      }
      if (f.meter > st.prevMeter[i] + 24) {
        // meter chunk gained → whoosh
        st.prevMeter[i] = f.meter
      } else if (f.meter < st.prevMeter[i]) {
        st.prevMeter[i] = f.meter
      }
      if (f.state === 'attack' && st.prevState[i] !== 'attack' && f.move === 'special') sfx.swing()
      if (f.state === 'super' && st.prevState[i] !== 'super') sfx.superCharge()
      st.prevState[i] = f.state
    }
    if (m.projectiles.length > st.prevProj) sfx.projectile()
    st.prevProj = m.projectiles.length
    if (m.announce.text !== st.lastAnnounce) {
      st.lastAnnounce = m.announce.text
      if (/K\.O|WINS|DOUBLE/.test(m.announce.text)) sfx.ko()
      else if (/FIGHT/.test(m.announce.text)) sfx.bell()
    }
    if (m.phase !== st.lastPhase) {
      st.lastPhase = m.phase
      if (m.phase === 'matchEnd') {
        stopMusic()
        const winnerIdx = m.matchWinner
        const myIdx = mode === 'online' ? st.net?.playerIndex ?? 0 : 0
        if (mode !== 'online' || winnerIdx === myIdx) sfx.victory()
        else sfx.defeat()
        setTimeout(
          () => setResult({ winner: winnerIdx, stats: m.stats, roundWins: m.roundWins, myIdx }),
          1400,
        )
      }
    }
  }

  // ------------------------------------------------------------------ main loop
  const loop = useCallback((now) => {
    const st = g.current
    if (!st.running) return
    st.raf = requestAnimationFrame(loop)

    const dt = Math.min(0.1, (now - st.last) / 1000)
    st.last = now
    if (!st.match || pausedRef.current) {
      paint(st)
      return
    }

    st.acc += dt
    const stepMs = 1 / TICK
    let steps = 0

    if (mode === 'online') {
      const net = st.net
      if (!net || net.state !== NET_STATE.INGAME) {
        paint(st)
        return
      }
      // queue local input for upcoming frames — online players may use
      // either key set, since there is no second person on this keyboard
      const local = st.keys.p1() | st.keys.p2()
      for (let i = 0; i < 3; i++) net.pushInput(st.frame + i, local)
      net.pump()

      // advance while we have both sides' inputs (or we're way ahead of the network)
      while (steps < 5) {
        let inputs = net.inputsFor(st.frame)
        if (!inputs) {
          if (st.waitFrames > 90) inputs = net.fallbackInput(st.frame)
          else break
        }
        if (inputs) {
          stepMatch(st.match, inputs)
          st.frame++
          st.waitFrames = 0
          steps++
        }
      }
      if (steps === 0) st.waitFrames++
      if (st.waitFrames === 420) setStuck(true)
      net.advanceFrames(steps)
    } else {
      while (st.acc >= stepMs && steps < 4) {
        st.acc -= stepMs
        const inputs = [st.keys.p1(), mode === 'cpu' ? st.ai(st.match, st.match.fighters[1], st.match.fighters[0]) : st.keys.p2()]
        stepMatch(st.match, inputs)
        st.frame++
        steps++
      }
    }

    if (steps > 0) audioCues(st)
    st.keys.endFrame()

    // camera
    if (mode === 'online') {
      st.cam.zoom = 0.94
      updateCamera(st.cam, st.match, 0.2)
    } else {
      updateCamera(st.cam, st.match, 0.13)
    }

    paint(st)

    // HUD sync (throttled)
    if (st.frame % 2 === 0 || steps > 0) {
      setHud(snapshot(st.match))
      if (mode === 'online' && st.frame % 60 === 0) setNetInfo((p) => ({ ...p, ping: st.net.ping }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  function paint(st) {
    const c = canvasRef.current
    if (!c || !st.match) return
    const ctx = c.getContext('2d')
    const rect = c.getBoundingClientRect()
    const theme = THEME[byId(p1Char).id] || 'shrine'
    renderMatch(ctx, st.match, { w: rect.width, h: rect.height, cx: st.cam.cx, cy: st.cam.cy, zoom: st.cam.zoom }, { theme })
  }

  // ------------------------------------------------------------------ actions
  const toggleMute = () => {
    const next = !muted
    setMutedState(next)
    setMuted(next)
  }

  const quit = () => {
    stopMusic()
    onExit()
  }

  // ------------------------------------------------------------------ render
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

      {/* subtle CRT overlay */}
      <div className="scanlines pointer-events-none absolute inset-0 z-10" />

      <Hud
        hud={hud}
        mode={mode}
        ping={mode === 'online' ? netInfo.ping : null}
        paused={paused}
        onPause={() => setPaused((p) => !p)}
        onQuit={quit}
        muted={muted}
        onToggleMute={toggleMute}
      />

      {/* control hint strip */}
      {!result && mode !== 'online' && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 hidden gap-4 font-display text-[10px] tracking-widest text-white/30 md:flex">
          <span>P1 · WASD + F G H T</span>
          {mode === 'local' && <span>P2 · ARROWS + J K L ;</span>}
          <span>ESC · PAUSE</span>
        </div>
      )}

      {/* ---------- online connecting / matchmaking overlay ---------- */}
      {(stuck || (mode === 'online' && netInfo.state !== NET_STATE.INGAME)) && !result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/85 backdrop-blur-sm">
          <div className="panel w-full max-w-md rounded-xl p-8 text-center">
            {stuck || netInfo.state === NET_STATE.ERROR ? (
              <>
                <div className="font-display text-2xl text-neon">CONNECTION LOST</div>
                <p className="mt-3 text-sm text-white/55">
                  {stuck ? 'Your rival stopped sending inputs — they may have closed the tab.' : netInfo.error || 'The arena server is not reachable.'}
                </p>
                <p className="mt-2 text-xs text-white/35">
                  Online PvP needs the arena server: <code className="text-cyan">node server/server.js</code>
                </p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={quit} className="clip-tag bg-white/10 px-5 py-2.5 font-display text-xs tracking-widest hover:bg-white/20">
                    BACK
                  </button>
                  <button onClick={onChangeChars} className="clip-tag bg-neon px-5 py-2.5 font-display text-xs tracking-widest text-void hover:brightness-110">
                    PLAY OFFLINE
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto mb-5 h-12 w-12 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
                <div className="font-display text-2xl">
                  {netInfo.state === NET_STATE.CONNECTING ? 'CONNECTING…' : netInfo.state === NET_STATE.QUEUING ? 'SEARCHING FOR A RIVAL' : 'SYNCING…'}
                </div>
                <p className="mt-3 text-sm text-white/50">
                  {netInfo.state === NET_STATE.QUEUING
                    ? 'Lockstep matchmaking — you will be paired with the next fighter in queue.'
                    : 'Negotiating a shared seed with the arena server.'}
                </p>
                <button onClick={quit} className="clip-tag mt-7 bg-white/10 px-5 py-2.5 font-display text-xs tracking-widest hover:bg-white/20">
                  CANCEL
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ---------- pause ---------- */}
      {paused && !result && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/80 backdrop-blur-sm">
          <div className="panel w-full max-w-sm rounded-xl p-8 text-center">
            <div className="font-display text-3xl">PAUSED</div>
            <div className="mt-6 flex flex-col gap-3">
              <button onClick={() => setPaused(false)} className="clip-slash bg-neon py-3 font-display text-xs tracking-widest text-void hover:brightness-110">
                RESUME
              </button>
              <button onClick={onRematch} className="clip-slash border border-white/20 py-3 font-display text-xs tracking-widest text-white hover:border-cyan/60 hover:text-cyan">
                REMATCH
              </button>
              <button onClick={quit} className="clip-slash border border-white/10 py-3 font-display text-xs tracking-widest text-white/50 hover:text-white">
                QUIT TO MENU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- results ---------- */}
      {result && (
        <Results
          result={result}
          mode={mode}
          p1Char={p1Char}
          p2Char={p2Char}
          myIndex={result.myIdx ?? 0}
          onRematch={onRematch}
          onChangeChars={onChangeChars}
          onExit={quit}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

function Results({ result, mode, p1Char, p2Char, myIndex, onRematch, onChangeChars, onExit }) {
  const winnerIdx = result.winner
  const draw = winnerIdx == null || winnerIdx < 0
  const winnerChar = draw ? null : byId(winnerIdx === 0 ? p1Char : p2Char)
  const s = result.stats || { hits: [0, 0], maxCombo: [0, 0], damage: [0, 0], supers: [0, 0] }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-void/88 backdrop-blur-md">
      <div className="anim-slide-up w-full max-w-2xl px-5">
        <div className="panel relative overflow-hidden rounded-2xl p-8 md:p-10">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: `radial-gradient(ellipse at 50% 0%, ${winnerChar ? winnerChar.aura : '#ffffff'}55, transparent 65%)` }}
          />
          <div className="relative text-center">
            <div className="font-display text-xs tracking-[0.35em] text-white/40">
              {mode === 'online' ? 'ONLINE MATCH' : mode === 'cpu' ? 'TRAINING HALL' : 'LOCAL VERSUS'} · RESULT
            </div>
            <h2 className="mt-3 font-display text-[clamp(2rem,7vw,3.6rem)] leading-none">
              {draw ? <span className="text-white/70">DRAW GAME</span> : (
                <>
                  <span style={{ color: winnerChar.aura }}>{winnerChar.name}</span>{' '}
                  <span className="text-white">WINS</span>
                </>
              )}
            </h2>
            {!draw && <p className="mt-2 text-sm italic text-white/50">{winnerChar.quote}</p>}

            <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                ['ROUND SCORE', `${result.roundWins ? result.roundWins[0] : 0} – ${result.roundWins ? result.roundWins[1] : 0}`],
                ['DAMAGE DEALT', `${s.damage[0]} / ${s.damage[1]}`],
                ['LONGEST COMBO', `${s.maxCombo[0]} / ${s.maxCombo[1]}`],
                ['ULTIMATES', `${s.supers[0]} / ${s.supers[1]}`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                  <div className="font-display text-[9px] tracking-[0.2em] text-white/35">{label}</div>
                  <div className="mt-1.5 font-display text-base text-white">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center font-display text-[10px] tracking-widest text-white/30">
              <span style={{ color: byId(p1Char).aura }}>
                {byId(p1Char).name}
                {mode === 'online' && myIndex === 0 && <span className="ml-1 text-cyan">(YOU)</span>}
              </span>
              <span style={{ color: byId(p2Char).aura }}>
                {byId(p2Char).name}
                {mode === 'online' && myIndex === 1 && <span className="ml-1 text-cyan">(YOU)</span>}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button onClick={onRematch} className="clip-slash bg-neon px-7 py-3 font-display text-xs tracking-widest text-void transition hover:brightness-110">
                REMATCH
              </button>
              <button onClick={onChangeChars} className="clip-slash border border-white/20 px-7 py-3 font-display text-xs tracking-widest text-white transition hover:border-cyan/60 hover:text-cyan">
                CHANGE FIGHTER
              </button>
              <button onClick={onExit} className="clip-slash border border-white/10 px-7 py-3 font-display text-xs tracking-widest text-white/50 transition hover:text-white">
                MAIN MENU
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
