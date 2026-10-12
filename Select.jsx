import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'
import { CHARACTERS, byId } from '../game/characters.js'
import { sfx, unlockAudio } from '../game/audio.js'

const DIFFS = [
  { id: 'easy', label: 'ROOKIE', desc: 'Slow reactions, forgiving spacing' },
  { id: 'normal', label: 'VETERAN', desc: 'Punishes whiffs, blocks mixups' },
  { id: 'hard', label: 'MONSTER', desc: 'Frame-tight, super-happy, relentless' },
]

function StatBar({ label, value, color }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 font-display text-[9px] tracking-widest text-white/35">{label}</span>
      <div className="flex gap-1">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="h-2.5 w-1.5 skew-x-[-16deg] rounded-[1px]"
            style={{ background: i < value ? color : 'rgba(255,255,255,0.12)' }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Select({ mode, onStart, onCancel }) {
  const isCpu = mode === 'cpu'
  const [cur, setCur] = useState([0, 1])
  const [locked, setLocked] = useState([false, false])
  const [diff, setDiff] = useState('easy') // first-timers start on Rookie
  const [cpuChar, setCpuChar] = useState(null)
  const prev = useRef(0)

  // pick the CPU fighter once the human locks in
  useEffect(() => {
    if (!isCpu || !locked[0] || cpuChar) return
    const pool = CHARACTERS.filter((c, i) => i !== cur[0])
    const pick = pool[Math.floor(Math.random() * pool.length)]
    const t = setTimeout(() => {
      setCpuChar(pick.id)
      sfx.connect()
    }, 520)
    return () => clearTimeout(t)
  }, [isCpu, locked, cur, cpuChar])

  // auto-start once both sides are set
  useEffect(() => {
    const p1 = locked[0]
    const p2 = isCpu ? !!cpuChar : locked[1]
    if (!p1 || !p2) return
    const t = setTimeout(() => {
      sfx.bell()
      onStart({
        p1Char: CHARACTERS[cur[0]].id,
        p2Char: isCpu ? cpuChar : CHARACTERS[cur[1]].id,
        difficulty: diff,
      })
    }, 1100)
    return () => clearTimeout(t)
  }, [locked, cpuChar, isCpu, cur, diff, onStart])

  // keyboard cursors
  useEffect(() => {
    const held = new Set()
    const down = (e) => {
      held.add(e.code)
      const bits = bitmask(held)
      if (bits === prev.current) return
      const gained = bits & ~prev.current
      prev.current = bits
      handleInput(gained)
    }
    const up = (e) => {
      held.delete(e.code)
      prev.current = bitmask(held)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, locked, isCpu, diff])

  function bitmask(set) {
    let b = 0
    const map = {
      KeyA: 1, KeyD: 2, KeyW: 4, KeyS: 8, KeyF: 16, KeyR: 64, KeyT: 128,
      ArrowLeft: 256, ArrowRight: 512, ArrowUp: 1024, ArrowDown: 2048, KeyJ: 4096, KeyU: 8192,
    }
    for (const c of set) if (map[c]) b |= map[c]
    return b
  }

  function handleInput(gained) {
    unlockAudio()
    setCur((c) => {
      const next = [...c]
      // P1
      if (!locked[0]) {
        if (gained & 1) next[0] = (next[0] + CHARACTERS.length - 1) % CHARACTERS.length
        if (gained & 2) next[0] = (next[0] + 1) % CHARACTERS.length
      }
      // P2 (local versus only)
      if (!isCpu && !locked[1]) {
        if (gained & 256) next[1] = (next[1] + CHARACTERS.length - 1) % CHARACTERS.length
        if (gained & 512) next[1] = (next[1] + 1) % CHARACTERS.length
      }
      if ((gained & 128) || (gained & 64)) {
        // difficulty cycle for P1 in CPU mode
        if (isCpu) setDiff((d) => DIFFS[(DIFFS.findIndex((x) => x.id === d) + 1) % DIFFS.length].id)
      }
      if (next[0] !== c[0] || next[1] !== c[1]) sfx.ui()
      return next
    })

    if ((gained & 16) && !locked[0]) {
      setLocked((l) => [true, l[1]])
      sfx.hit(0.7)
    }
    if (!isCpu && (gained & 4096) && !locked[1]) {
      setLocked((l) => [l[0], true])
      sfx.hit(0.7)
    }
    if (gained & 8192) onCancel()
  }

  function clickCard(i) {
    unlockAudio()
    const p = !locked[0] ? 0 : !isCpu && !locked[1] ? 1 : -1
    if (p < 0) return
    if (cur[p] === i) {
      setLocked((l) => {
        const n = [...l]
        n[p] = true
        return n
      })
      sfx.hit(0.7)
    } else {
      setCur((c) => {
        const n = [...c]
        n[p] = i
        return n
      })
      sfx.ui()
    }
  }

  const previewChar = CHARACTERS[cur[0]]
  const p2CharObj = isCpu ? (cpuChar ? byId(cpuChar) : null) : CHARACTERS[cur[1]]

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at 20% 30%, ${previewChar.aura}33, transparent 55%)` }}
      />
      {p2CharObj && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 transition-all duration-700"
          style={{ background: `radial-gradient(ellipse at 80% 30%, ${p2CharObj.aura}33, transparent 55%)` }}
        />
      )}

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 md:px-8">
        {/* header */}
        <div className="flex items-center justify-between">
          <button onClick={onCancel} className="font-display text-[11px] tracking-widest text-white/40 transition hover:text-white">
            ← BACK
          </button>
          <div className="text-center">
            <div className="font-display text-[10px] tracking-[0.3em] text-white/35">
              {isCpu ? 'TRAINING HALL' : 'LOCAL VERSUS'}
            </div>
            <h1 className="font-display text-xl leading-none md:text-3xl">SELECT YOUR FIGHTER</h1>
          </div>
          <div className="font-display text-[11px] tracking-widest text-white/40">U · QUIT</div>
        </div>

        {/* body */}
        <div className="mt-6 grid flex-1 gap-5 lg:grid-cols-[240px_1fr_240px]">
          <SidePanel
            label="PLAYER 1"
            color={byId(CHARACTERS[cur[0]].id).aura}
            ch={CHARACTERS[cur[0]]}
            locked={locked[0]}
            confirmKey="F"
          />

          {/* roster grid */}
          <div className="flex flex-col">
            <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {CHARACTERS.map((c, i) => {
                const p1 = cur[0] === i
                const p2 = !isCpu && cur[1] === i
                const l1 = p1 && locked[0]
                const l2 = p2 && locked[1]
                return (
                  <button
                    key={c.id}
                    onClick={() => clickCard(i)}
                    className="group relative flex flex-col overflow-hidden rounded-xl border bg-white/[0.03] transition duration-200 hover:-translate-y-1"
                    style={{
                      borderColor: l1 ? '#22e1ff' : l2 ? '#ff2e88' : p1 || p2 ? `${c.aura}aa` : 'rgba(255,255,255,0.09)',
                      boxShadow: p1 || p2 ? `0 0 34px ${c.aura}44` : 'none',
                    }}
                  >
                    <div
                      className="absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-60"
                      style={{ background: `radial-gradient(circle at 50% 90%, ${c.aura}, transparent 70%)` }}
                    />
                    <div className="relative h-44 flex-1 md:h-52">
                      <Portrait ch={c} animate={p1 || p2} />
                    </div>
                    <div className="relative border-t border-white/10 bg-void/70 px-2 py-2 text-left">
                      <div className="font-display text-xs leading-none">{c.name}</div>
                      <div className="mt-1 text-[9px] tracking-widest" style={{ color: c.aura }}>
                        {c.role.toUpperCase()}
                      </div>
                    </div>
                    {/* cursor tags */}
                    {p1 && (
                      <span
                        className="absolute left-1.5 top-1.5 rounded px-1.5 py-0.5 font-display text-[9px] tracking-widest text-void"
                        style={{ background: locked[0] ? '#22e1ff' : '#ffffff' }}
                      >
                        {locked[0] ? 'P1 ✓' : 'P1'}
                      </span>
                    )}
                    {p2 && (
                      <span
                        className="absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 font-display text-[9px] tracking-widest text-void"
                        style={{ background: locked[1] ? '#ff2e88' : '#ffffff' }}
                      >
                        {locked[1] ? 'P2 ✓' : 'P2'}
                      </span>
                    )}
                    {isCpu && cpuChar === c.id && (
                      <span className="absolute right-1.5 top-1.5 rounded bg-amber px-1.5 py-0.5 font-display text-[9px] tracking-widest text-void">
                        CPU ✓
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* detail strip */}
            <div className="panel mt-4 rounded-xl p-4">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="min-w-[200px] flex-1">
                  <div className="font-display text-lg leading-none" style={{ color: previewChar.aura }}>
                    {previewChar.name}
                  </div>
                  <div className="mt-1 text-[10px] tracking-[0.2em] text-white/40">{previewChar.title.toUpperCase()}</div>
                  <p className="mt-2 max-w-sm text-xs leading-relaxed text-white/55">{previewChar.tagline}</p>
                  <div className="mt-2 font-display text-[10px] tracking-widest text-amber">
                    ULTIMATE · {previewChar.superName.toUpperCase()}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <StatBar label="POWER" value={previewChar.stats.power} color={previewChar.aura} />
                  <StatBar label="SPEED" value={previewChar.stats.speed} color={previewChar.aura} />
                  <StatBar label="RANGE" value={previewChar.stats.range} color={previewChar.aura} />
                  <StatBar label="DEFENSE" value={previewChar.stats.defense} color={previewChar.aura} />
                </div>
                {isCpu && (
                  <div className="w-full sm:w-52">
                    <div className="font-display text-[10px] tracking-[0.2em] text-white/35">CPU DIFFICULTY</div>
                    <div className="mt-2 flex gap-2">
                      {DIFFS.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setDiff(d.id)
                            sfx.ui()
                          }}
                          disabled={locked[0]}
                          className={`flex-1 rounded-md border px-2 py-2 font-display text-[10px] tracking-widest transition ${
                            diff === d.id
                              ? 'border-cyan bg-cyan/15 text-cyan'
                              : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] leading-relaxed text-white/35">
                      {DIFFS.find((d) => d.id === diff).desc}
                      {locked[0] ? ' · press T/R before locking to change' : ''}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <SidePanel
            label={isCpu ? 'CPU' : 'PLAYER 2'}
            color={p2CharObj ? p2CharObj.aura : '#666'}
            ch={p2CharObj}
            locked={isCpu ? !!cpuChar : locked[1]}
            confirmKey={isCpu ? null : 'J'}
            empty={!p2CharObj}
            emptyText={isCpu ? 'PICK YOUR FIGHTER — THE CPU ANSWERS' : 'WAITING FOR PLAYER 2'}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-display text-[10px] tracking-widest text-white/30">
          <span>P1 · A/D MOVE · F CONFIRM</span>
          {!isCpu && <span>P2 · ←/→ MOVE · J CONFIRM</span>}
          <span>CLICK A CARD TWICE TO LOCK</span>
        </div>
      </div>
    </div>
  )
}

function SidePanel({ label, color, ch, locked, confirmKey, empty, emptyText }) {
  return (
    <div
      className="panel relative hidden overflow-hidden rounded-xl p-4 lg:block"
      style={{ borderColor: `${color}55` }}
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[10px] tracking-[0.25em]" style={{ color }}>{label}</span>
        {locked && <span className="font-display text-[10px] tracking-widest text-white">LOCKED</span>}
      </div>
      <div className="relative mt-2 h-64">
        {empty || !ch ? (
          <div className="flex h-full items-center justify-center px-4 text-center font-display text-[11px] leading-relaxed tracking-widest text-white/25">
            {emptyText}
          </div>
        ) : (
          <>
            <div
              className="absolute inset-0 opacity-40"
              style={{ background: `radial-gradient(circle at 50% 80%, ${color}, transparent 70%)` }}
            />
            <Portrait ch={ch} />
          </>
        )}
      </div>
      {ch && (
        <>
          <div className="font-display text-xl leading-none">{ch.name}</div>
          <div className="mt-1 text-[10px] tracking-[0.2em] text-white/40">{ch.title.toUpperCase()}</div>
          <div className="mt-3 space-y-1">
            <StatBar label="HP" value={Math.round((ch.hp / 1200) * 10)} color={color} />
            <StatBar label="SPEED" value={ch.stats.speed} color={color} />
            <StatBar label="POWER" value={ch.stats.power} color={color} />
          </div>
          <p className="mt-3 text-[11px] italic leading-relaxed text-white/45">{ch.quote}</p>
          {confirmKey && !locked && (
            <div className="mt-3 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-center font-display text-[10px] tracking-widest text-white/60">
              PRESS {confirmKey} TO LOCK
            </div>
          )}
        </>
      )}
    </div>
  )
}
