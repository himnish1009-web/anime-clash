import { useEffect, useRef, useState } from 'react'
import Portrait from './Portrait.jsx'
import { CHARACTERS } from '../game/characters.js'
import { createNetClient, NET_STATE } from '../game/net.js'
import { sfx, unlockAudio } from '../game/audio.js'

/**
 * Online flow: connect → queue → blind character select → hand off to Battle
 * with a shared seed + both picks, so the two browsers start on frame 0 of an
 * identical simulation.
 */
export default function OnlineLobby({ onStart, onExit }) {
  const [info, setInfo] = useState({ state: NET_STATE.CONNECTING, error: null, ping: 0 })
  const [hover, setHover] = useState(0)
  const [myPick, setMyPick] = useState(null)
  const [oppPick, setOppPick] = useState(null)
  const netRef = useRef(null)

  useEffect(() => {
    unlockAudio()
    const net = createNetClient({
      onState: (s) => {
        setInfo((prev) => ({ ...prev, ...s }))
        if (s.state === NET_STATE.ONLINE) net.queue()
      },
      onEvent: (e) => {
        if (e.type === 'oppPick') {
          setOppPick(e.charId)
          sfx.ui()
        }
        if (e.type === 'start') {
          sfx.bell()
          onStart({
            p1Char: e.picks[0],
            p2Char: e.picks[1],
            seed: e.seed,
            net,
            myIndex: net.playerIndex,
          })
        }
      },
    })
    netRef.current = net
    net.connect()
    const pingTimer = setInterval(() => setInfo((p) => ({ ...p, ping: net.ping })), 1000)
    return () => {
      clearInterval(pingTimer)
      net.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const st = info.state
  const matched = st === NET_STATE.PICKING || st === NET_STATE.INGAME
  const preview = CHARACTERS[hover]

  const pick = (id) => {
    if (myPick) return
    setMyPick(id)
    sfx.hit(0.7)
    netRef.current?.sendReady(id)
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <div
        className="pointer-events-none absolute inset-0 opacity-50 transition-all duration-700"
        style={{ background: `radial-gradient(ellipse at 50% 0%, ${preview.aura}33, transparent 60%)` }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 md:px-8">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="font-display text-[11px] tracking-widest text-white/40 transition hover:text-white">
            ← BACK
          </button>
          <div className="text-center">
            <div className="font-display text-[10px] tracking-[0.3em] text-violet">ONLINE PVP · LOCKSTEP</div>
            <h1 className="font-display text-xl leading-none md:text-2xl">ARENA QUEUE</h1>
          </div>
          <div className="font-display text-[11px] tracking-widest text-white/40">
            {info.ping ? `${info.ping} MS` : '— MS'}
          </div>
        </div>

        {st === NET_STATE.ERROR ? (
          <div className="panel mx-auto mt-16 w-full max-w-lg rounded-xl p-8 text-center">
            <div className="font-display text-2xl text-neon">SERVER UNREACHABLE</div>
            <p className="mt-3 text-sm leading-relaxed text-white/55">{info.error}</p>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/[0.03] p-4 text-left">
              <div className="font-display text-[10px] tracking-widest text-white/40">TO PLAY ONLINE, RUN THE ARENA SERVER</div>
              <pre className="mt-2 overflow-x-auto text-xs text-cyan">node server/server.js</pre>
              <p className="mt-2 text-[11px] leading-relaxed text-white/40">
                Then reload. The dev server proxies <code>/ws</code> to port 8787 automatically.
              </p>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button onClick={onExit} className="clip-tag bg-white/10 px-6 py-2.5 font-display text-xs tracking-widest hover:bg-white/20">
                MAIN MENU
              </button>
            </div>
          </div>
        ) : !matched ? (
          <div className="panel mx-auto mt-16 w-full max-w-lg rounded-xl p-10 text-center">
            <div className="mx-auto mb-6 h-14 w-14 animate-spin rounded-full border-2 border-white/10 border-t-neon" />
            <div className="font-display text-2xl">
              {st === NET_STATE.CONNECTING ? 'CONNECTING…' : 'SEARCHING FOR A RIVAL'}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/50">
              You are in the queue. As soon as another fighter joins, you both get a blind character
              select and a shared RNG seed — then it is frame-perfect lockstep from tick zero.
            </p>
            <div className="mt-6 flex items-center justify-center gap-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 w-8 rounded-full bg-neon/70"
                  style={{ animation: `pulse-glow 1.4s ${i * 0.14}s ease-in-out infinite` }}
                />
              ))}
            </div>
            <button onClick={onExit} className="clip-tag mt-8 border border-white/15 px-6 py-2.5 font-display text-xs tracking-widest text-white/60 hover:text-white">
              CANCEL
            </button>
          </div>
        ) : (
          <div className="mt-6 flex flex-1 flex-col">
            <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
              <SlotPanel side="left" label="YOU" pick={myPick} locked={!!myPick} />
              <div className="text-center font-display text-3xl text-white/25">VS</div>
              <SlotPanel side="right" label="RIVAL" pick={oppPick} locked={!!oppPick} />
            </div>

            <div className="mt-6">
              <div className="font-display text-[10px] tracking-[0.3em] text-white/35">
                {myPick ? 'WAITING FOR YOUR RIVAL TO LOCK IN…' : 'CHOOSE YOUR FIGHTER — PICK IS BLIND UNTIL BOTH LOCK'}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {CHARACTERS.map((c, i) => {
                  const active = hover === i
                  const mine = myPick === c.id
                  const theirs = oppPick === c.id
                  return (
                    <button
                      key={c.id}
                      disabled={!!myPick}
                      onMouseEnter={() => setHover(i)}
                      onClick={() => pick(c.id)}
                      className="group relative flex flex-col overflow-hidden rounded-xl border bg-white/[0.03] transition duration-200 hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40"
                      style={{
                        borderColor: mine ? '#22e1ff' : theirs ? '#ff2e88' : active ? `${c.aura}99` : 'rgba(255,255,255,0.09)',
                        boxShadow: active ? `0 0 30px ${c.aura}33` : 'none',
                      }}
                    >
                      <div className="h-36 flex-1 md:h-44">
                        <Portrait ch={c} animate={active} />
                      </div>
                      <div className="border-t border-white/10 bg-void/70 px-2 py-2 text-left">
                        <div className="font-display text-xs leading-none">{c.name}</div>
                        <div className="mt-1 text-[9px] tracking-widest" style={{ color: c.aura }}>{c.role.toUpperCase()}</div>
                      </div>
                      {mine && <span className="absolute left-1.5 top-1.5 rounded bg-cyan px-1.5 py-0.5 font-display text-[9px] tracking-widest text-void">YOU ✓</span>}
                      {theirs && <span className="absolute right-1.5 top-1.5 rounded bg-neon px-1.5 py-0.5 font-display text-[9px] tracking-widest text-void">RIVAL ✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="panel mt-5 rounded-xl p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="font-display text-sm" style={{ color: preview.aura }}>{preview.name}</div>
                  <p className="mt-1 max-w-md text-xs text-white/50">{preview.tagline}</p>
                </div>
                <div className="text-right">
                  <div className="font-display text-[10px] tracking-widest text-white/35">ULTIMATE</div>
                  <div className="font-display text-xs text-amber">{preview.superName}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SlotPanel({ side, label, pick, locked }) {
  const ch = pick ? CHARACTERS.find((c) => c.id === pick) : null
  const color = ch ? ch.aura : '#3a3f5c'
  return (
    <div className="panel relative overflow-hidden rounded-xl p-4" style={{ borderColor: `${color}55` }}>
      <div className={`flex items-center justify-between ${side === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className="font-display text-[10px] tracking-[0.25em]" style={{ color }}>{label}</span>
        {locked && <span className="font-display text-[10px] tracking-widest text-white">LOCKED</span>}
      </div>
      <div className="relative mt-2 h-52">
        {ch ? (
          <>
            <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(circle at 50% 85%, ${color}, transparent 70%)` }} />
            <div className={side === 'right' ? 'scale-x-[-1]' : ''}>
              <Portrait ch={ch} />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-16 w-16 animate-pulse rounded-full border-2 border-white/10 border-t-white/40" />
          </div>
        )}
      </div>
      <div className={`font-display text-lg leading-none ${side === 'right' ? 'text-right' : ''}`}>
        {ch ? ch.name : '???'}
      </div>
    </div>
  )
}
