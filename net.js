// ---------------------------------------------------------------------------
// Online PvP client.
//
// The game is deterministic lockstep: both browsers run the exact same
// simulation and only exchange 8-bit input masks per tick. The server relays
// them and pairs you with another player. Because the sim is pure, both sides
// stay frame-perfect in sync.
// ---------------------------------------------------------------------------

export const NET_STATE = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ONLINE: 'online',
  QUEUING: 'queuing',
  MATCHED: 'matched',
  PICKING: 'picking',
  INGAME: 'ingame',
  ERROR: 'error',
}

export function createNetClient({ onState = () => {}, onEvent = () => {} } = {}) {
  let ws = null
  let state = NET_STATE.IDLE
  let playerIndex = 0
  let seed = 1
  let oppChar = null
  let ping = 0
  let inputQueue = [] // { frame, bits } waiting to be sent
  let pendingInputs = new Map() // frame -> [bitsP0, bitsP1]
  let lastInput = [0, 0]
  let lastRemoteFrame = -1
  let framePointer = 0 // next frame the sim needs inputs for
  let closed = false

  const set = (s, extra = {}) => {
    state = s
    onState({ state, playerIndex, seed, oppChar, ping, ...extra })
  }

  function url() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${proto}://${location.host}/ws`
  }

  function send(obj) {
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj))
  }

  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return
    closed = false
    set(NET_STATE.CONNECTING)
    try {
      ws = new WebSocket(url())
    } catch {
      set(NET_STATE.ERROR, { error: 'Could not open a socket to the game server.' })
      return
    }

    ws.onopen = () => {
      set(NET_STATE.ONLINE)
      send({ t: 'hello', v: 1 })
      setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) send({ t: 'ping', at: performance.now() })
      }, 2000)
    }

    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }
      handle(msg)
    }

    ws.onerror = () => {
      if (state === NET_STATE.CONNECTING) set(NET_STATE.ERROR, { error: 'Connection failed.' })
    }

    ws.onclose = () => {
      if (!closed && state !== NET_STATE.IDLE) {
        set(NET_STATE.ERROR, { error: 'Disconnected from the arena server.' })
      }
    }
  }

  function applyRemoteInput(frame, idx, bits) {
    if (typeof frame !== 'number') return
    let slot = pendingInputs.get(frame)
    if (!slot) {
      slot = [null, null]
      pendingInputs.set(frame, slot)
    }
    slot[idx === 1 ? 1 : 0] = bits | 0
    if (frame > lastRemoteFrame) {
      lastRemoteFrame = frame
      lastInput[idx === 1 ? 1 : 0] = bits | 0
    }
  }

  function handle(msg) {
    switch (msg.t) {
      case 'welcome':
        playerIndex = msg.player
        set(NET_STATE.ONLINE)
        break
      case 'pong':
        ping = Math.round(performance.now() - msg.at)
        break
      case 'queued':
        set(NET_STATE.QUEUING, { queue: msg.queue ?? 1 })
        break
      case 'matched':
        oppChar = null
        seed = msg.seed
        set(NET_STATE.PICKING, { seed })
        onEvent({ type: 'matched' })
        break
      case 'pick':
        if (msg.player !== playerIndex) {
          oppChar = msg.charId
          onEvent({ type: 'oppPick', charId: msg.charId })
        }
        break
      case 'start':
        seed = msg.seed
        oppChar = msg.picks[1 - playerIndex]
        framePointer = 0
        pendingInputs.clear()
        set(NET_STATE.INGAME, { seed, picks: msg.picks })
        onEvent({ type: 'start', seed, picks: msg.picks })
        break
      case 'in':
        applyRemoteInput(msg.f, msg.i, msg.b)
        break
      case 'batch':
        for (const e of msg.list || []) applyRemoteInput(e.f, e.i, e.b)
        break
      case 'ko':
        onEvent({ type: 'opponentLeft' })
        break
      case 'error':
        set(NET_STATE.ERROR, { error: msg.msg })
        break
    }
  }

  return {
    connect,
    disconnect() {
      closed = true
      send({ t: 'bye' })
      ws?.close()
      ws = null
      set(NET_STATE.IDLE)
    },
    queue() {
      send({ t: 'queue' })
      set(NET_STATE.QUEUING)
    },
    cancelQueue() {
      send({ t: 'cancel' })
      set(NET_STATE.ONLINE)
    },
    sendPick(charId) {
      send({ t: 'pick', charId })
    },
    sendReady(charId) {
      send({ t: 'ready', charId })
    },
    // queue our local input for a frame; flushed by pump()
    pushInput(frame, bits) {
      lastInput[playerIndex] = bits
      inputQueue.push({ f: frame, b: bits })
      if (inputQueue.length > 600) inputQueue.splice(0, inputQueue.length - 600)
    },
    pump() {
      if (inputQueue.length) {
        send({ t: 'in', list: inputQueue })
        inputQueue = []
      }
      // drop stale pending frames
      for (const key of pendingInputs.keys()) {
        if (key < framePointer - 10) pendingInputs.delete(key)
      }
    },
    // returns [p0bits, p1bits] when BOTH inputs for `frame` have arrived
    inputsFor(frame) {
      const slot = pendingInputs.get(frame)
      if (slot && slot[0] != null && slot[1] != null) {
        pendingInputs.delete(frame)
        return slot
      }
      return null
    },
    // fall back to the last known input so a packet loss never stalls a match
    fallbackInput() {
      return [...lastInput]
    },
    get state() {
      return state
    },
    get playerIndex() {
      return playerIndex
    },
    get seed() {
      return seed
    },
    get oppChar() {
      return oppChar
    },
    get ping() {
      return ping
    },
    advanceFrames(n) {
      framePointer += n
    },
    get framePointer() {
      return framePointer
    },
    pendingCount() {
      return pendingInputs.size
    },
  }
}
