/**
 * In-battle HUD. Pure presentation — `hud` comes from snapshot(match).
 */

function HealthBar({ f, side }) {
  const pct = Math.max(0, (f.hp / f.maxHp) * 100)
  const danger = pct < 25
  return (
    <div className={`relative h-6 w-full overflow-hidden border-2 ${side === 'left' ? 'clip-tag' : 'skew-x-[14deg]'}`}
      style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(8,10,22,0.85)' }}>
      <div
        className={`absolute inset-y-0 ${side === 'left' ? 'left-0' : 'right-0'} transition-[width] duration-150 ease-out`}
        style={{
          width: `${pct}%`,
          background: danger
            ? 'linear-gradient(90deg,#ff2e88,#ff6b6b)'
            : `linear-gradient(90deg, ${f.aura}, #ffffff55)`,
          boxShadow: `0 0 18px ${f.aura}88`,
        }}
      />
      <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent_0_18px,rgba(0,0,0,.28)_18px_20px)]" />
    </div>
  )
}

function MeterBar({ value, color, side }) {
  const full = value >= 100
  return (
    <div className="flex items-center gap-2">
      {side === 'right' && <span className={`font-display text-[10px] tracking-widest ${full ? 'text-amber anim-flicker' : 'text-white/30'}`}>{full ? 'MAX' : 'METER'}</span>}
      <div className="relative h-2 w-40 overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 rounded-full transition-[width] duration-200"
          style={{
            [side]: 0,
            width: `${value}%`,
            background: full ? 'linear-gradient(90deg,#ffc857,#fff)' : color,
            boxShadow: full ? '0 0 14px #ffc857' : 'none',
          }}
        />
      </div>
      {side === 'left' && <span className={`font-display text-[10px] tracking-widest ${full ? 'text-amber anim-flicker' : 'text-white/30'}`}>{full ? 'MAX' : 'METER'}</span>}
    </div>
  )
}

function RoundPips({ wins, side, color }) {
  return (
    <div className={`flex gap-1.5 ${side === 'right' ? 'justify-end' : ''}`}>
      {[0, 1].map((i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rotate-45 border"
          style={{
            borderColor: color,
            background: i < wins ? color : 'transparent',
            boxShadow: i < wins ? `0 0 10px ${color}` : 'none',
          }}
        />
      ))}
    </div>
  )
}

export default function Hud({ hud, mode, ping, paused, onPause, onQuit, muted, onToggleMute }) {
  if (!hud) return null
  const [p1, p2] = hud.fighters
  const seconds = hud.time
  const lowTime = seconds <= 10

  return (
    <>
      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 px-3 pt-3 md:px-6 md:pt-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 md:gap-6">
          {/* P1 */}
          <div className="min-w-0">
            <div className="mb-1 flex items-baseline gap-2">
              <span className="truncate font-display text-sm tracking-wider md:text-base" style={{ color: p1.aura }}>{p1.name}</span>
              <RoundPips wins={hud.roundWins[0]} side="left" color={p1.aura} />
            </div>
            <HealthBar f={p1} side="left" />
            <div className="mt-1.5"><MeterBar value={p1.meter} color={p1.aura} side="left" /></div>
            {p1.combo > 1 && (
              <div className="mt-1 font-display text-xs tracking-widest text-amber anim-slide-up">{p1.combo} HIT COMBO</div>
            )}
          </div>

          {/* timer */}
          <div className="flex flex-col items-center">
            <div className="relative flex h-16 w-16 items-center justify-center border-2 border-white/20 bg-void/80 md:h-20 md:w-20"
              style={{ clipPath: 'polygon(12% 0,88% 0,100% 50%,88% 100%,12% 100%,0 50%)' }}>
              <span className={`font-display text-2xl md:text-3xl ${lowTime ? 'text-neon anim-flicker' : 'text-white'}`}>
                {String(seconds).padStart(2, '0')}
              </span>
            </div>
            <div className="mt-1 font-display text-[10px] tracking-[0.25em] text-white/40">ROUND {hud.round}</div>
          </div>

          {/* P2 */}
          <div className="min-w-0">
            <div className="mb-1 flex items-baseline justify-end gap-2">
              <RoundPips wins={hud.roundWins[1]} side="right" color={p2.aura} />
              <span className="truncate font-display text-sm tracking-wider md:text-base" style={{ color: p2.aura }}>{p2.name}</span>
            </div>
            <div className="[&>*]:skew-x-[-14deg]"><HealthBar f={p2} side="right" /></div>
            <div className="mt-1.5 flex justify-end"><MeterBar value={p2.meter} color={p2.aura} side="right" /></div>
            {p2.combo > 1 && (
              <div className="mt-1 text-right font-display text-xs tracking-widest text-amber anim-slide-up">{p2.combo} HIT COMBO</div>
            )}
          </div>
        </div>
      </div>

      {/* announce banner */}
      {hud.announce.timer > 0 && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <div className="anim-slide-up text-center">
            <div className="font-display text-[clamp(2rem,7vw,4.5rem)] leading-none text-white drop-shadow-[0_0_30px_rgba(255,46,136,0.8)]">
              {hud.announce.text}
            </div>
            {hud.announce.sub && (
              <div className="mt-2 font-display text-xs tracking-[0.3em] text-white/60 md:text-sm">{hud.announce.sub}</div>
            )}
          </div>
        </div>
      )}

      {/* bottom-right system buttons */}
      <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2">
        {mode === 'online' && ping != null && (
          <span className="rounded-md border border-white/10 bg-void/70 px-2 py-1 font-display text-[10px] tracking-widest text-white/50">
            {ping} MS
          </span>
        )}
        <button
          onClick={onToggleMute}
          className="rounded-md border border-white/10 bg-void/70 px-2.5 py-1.5 font-display text-[10px] tracking-widest text-white/60 transition hover:border-white/30 hover:text-white"
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {mode !== 'online' && (
          <button
            onClick={onPause}
            className="rounded-md border border-white/10 bg-void/70 px-2.5 py-1.5 font-display text-[10px] tracking-widest text-white/60 transition hover:border-white/30 hover:text-white"
          >
            {paused ? '▶ RESUME' : '❚❚ PAUSE'}
          </button>
        )}
        <button
          onClick={onQuit}
          className="rounded-md border border-neon/30 bg-neon/10 px-2.5 py-1.5 font-display text-[10px] tracking-widest text-neon transition hover:bg-neon hover:text-void"
        >
          QUIT
        </button>
      </div>
    </>
  )
}
