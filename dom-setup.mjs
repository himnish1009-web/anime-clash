// Installs a jsdom environment + a canvas/audio stub before any test code runs.
import { JSDOM } from 'jsdom'

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost:5173/',
  pretendToBeVisual: true,
})

const { window } = dom

// ---- canvas 2d stub (jsdom has no canvas backend) -------------------------
const gradient = { addColorStop() {} }
function makeCtx() {
  const noop = () => {}
  const ctx = {
    canvas: null,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    shadowColor: '',
    shadowBlur: 0,
    filter: 'none',
    imageSmoothingEnabled: true,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    scale: noop,
    transform: noop,
    setTransform: noop,
    resetTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: noop,
    arcTo: noop,
    ellipse: noop,
    rect: noop,
    roundRect: noop,
    fill: noop,
    stroke: noop,
    clip: noop,
    clearRect: noop,
    fillRect: noop,
    strokeRect: noop,
    fillText: noop,
    strokeText: noop,
    measureText: () => ({ width: 40, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }),
    drawImage: noop,
    putImageData: noop,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createConicGradient: () => gradient,
    createPattern: () => null,
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
    createImageData: () => ({ data: new Uint8ClampedArray(4) }),
    setLineDash: noop,
    getLineDash: () => [],
  }
  return ctx
}

window.HTMLCanvasElement.prototype.getContext = function () {
  if (!this.__ctx) {
    this.__ctx = makeCtx()
    this.__ctx.canvas = this
  }
  return this.__ctx
}

// ---- other browser APIs the app touches ----------------------------------
class IntersectionObserverStub {
  constructor(cb) {
    this.cb = cb
  }
  observe(el) {
    // pretend everything is immediately on screen
    this.cb([{ isIntersecting: true, target: el }], this)
  }
  unobserve() {}
  disconnect() {}
}
window.IntersectionObserver = IntersectionObserverStub
window.scrollTo = () => {}
window.devicePixelRatio = 1

// WebAudio stub
const param = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }
const node = () => ({
  connect: () => {},
  disconnect: () => {},
  start: () => {},
  stop: () => {},
  gain: param,
  frequency: param,
  Q: param,
  type: 'sine',
  buffer: null,
})
window.AudioContext = class {
  constructor() {
    this.currentTime = 0
    this.sampleRate = 44100
    this.state = 'running'
    this.destination = node()
  }
  createGain() { return node() }
  createOscillator() { return node() }
  createBufferSource() { return node() }
  createBiquadFilter() { return node() }
  createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) } }
  resume() {}
}

window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }))

// ---- publish to global ---------------------------------------------------
for (const key of [
  'window', 'document', 'navigator', 'HTMLElement', 'Element', 'Node', 'Event',
  'CustomEvent', 'KeyboardEvent', 'MouseEvent', 'requestAnimationFrame',
  'cancelAnimationFrame', 'getComputedStyle', 'IntersectionObserver', 'AudioContext',
  'location', 'history', 'localStorage', 'WebSocket',
]) {
  if (globalThis[key] === undefined && window[key] !== undefined) globalThis[key] = window[key]
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true
