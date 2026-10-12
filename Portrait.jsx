import { useEffect, useRef } from 'react'
import { drawFighter } from './render.js'

/**
 * Renders a single fighter in their idle stance using the exact same
 * procedural renderer the battle canvas uses — so roster art and in-game
 * sprites always match. The fighter is scaled uniformly to fill the box
 * height (cropping horizontally when the box is narrow), never stretched.
 */
export default function Portrait({ ch, className = '', animate = true }) {
  const ref = useRef(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const fake = {
      ch,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      state: 'idle',
      move: null,
      moveTimer: 0,
      phase: 'none',
      flash: 0,
      meter: 100,
      superFlash: 0,
      blockStun: 0,
      airborne: false,
      dashTrail: [],
      prevInput: 0,
      anim: (ch.id.charCodeAt(0) * 53) % 190,
    }

    let raf = 0
    let ro = null

    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const W = Math.max(40, rect.width)
      const H = Math.max(40, rect.height)
      if (canvas.width !== Math.floor(W * dpr) || canvas.height !== Math.floor(H * dpr)) {
        canvas.width = Math.floor(W * dpr)
        canvas.height = Math.floor(H * dpr)
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // uniform fit: fill the height of the box (design spans y -210..0)
      const s = Math.min(2.4, Math.max(0.4, H / 350))
      const feetY = (H + 205 * s) / 2

      ctx.save()
      ctx.translate(W / 2, feetY)
      ctx.scale(s, s)
      drawFighter(ctx, fake)
      ctx.restore()

      if (animate) {
        fake.anim += 1
        raf = requestAnimationFrame(draw)
      }
    }

    draw()
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        if (!animate) draw()
      })
      ro.observe(canvas)
    }
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [ch, animate])

  return <canvas ref={ref} className={className} style={{ width: '100%', height: '100%' }} aria-label={`${ch.name} portrait`} />
}
