// ---------------------------------------------------------------------------
// Keyboard input → bitmask for a player. Also exposes "pressed this frame"
// helpers for menus.
// ---------------------------------------------------------------------------

import { KEYMAP_P1, KEYMAP_P2 } from './constants.js'

export function createKeyboard() {
  const held = new Set()
  const pressedThisFrame = new Set()

  const down = (e) => {
    if (e.repeat) return
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault()
    held.add(e.code)
    pressedThisFrame.add(e.code)
  }
  const up = (e) => held.delete(e.code)
  const blur = () => held.clear()

  window.addEventListener('keydown', down)
  window.addEventListener('keyup', up)
  window.addEventListener('blur', blur)

  return {
    bitmask(keymap) {
      let bits = 0
      for (const code of held) {
        const b = keymap[code]
        if (b) bits |= b
      }
      return bits
    },
    p1() {
      return this.bitmask(KEYMAP_P1)
    },
    p2() {
      return this.bitmask(KEYMAP_P2)
    },
    justPressed(code) {
      return pressedThisFrame.has(code)
    },
    endFrame() {
      pressedThisFrame.clear()
    },
    destroy() {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', blur)
    },
  }
}

// Optional: gamepad support (first two connected pads map to P1/P2)
export function gamepadBitmask(index, map) {
  const pads = navigator.getGamepads ? navigator.getGamepads() : []
  const gp = pads[index]
  if (!gp) return 0
  let bits = 0
  const ax = gp.axes[0] || 0
  if (ax < -0.4 || gp.buttons[14]?.pressed) bits |= map.left
  if (ax > 0.4 || gp.buttons[15]?.pressed) bits |= map.right
  if ((gp.axes[1] || 0) < -0.4 || gp.buttons[12]?.pressed) bits |= map.up
  if ((gp.axes[1] || 0) > 0.4 || gp.buttons[13]?.pressed) bits |= map.down
  if (gp.buttons[2]?.pressed) bits |= map.light
  if (gp.buttons[0]?.pressed) bits |= map.heavy
  if (gp.buttons[1]?.pressed) bits |= map.special
  if (gp.buttons[5]?.pressed || gp.buttons[7]?.pressed) bits |= map.super
  return bits
}
