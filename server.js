// ---------------------------------------------------------------------------
// Arena server: WebSocket relay for online PvP + static host for the build.
//
//   node server/server.js
//
// Pairs two players, relays their per-tick input bitmasks and broadcasts a
// shared RNG seed so both browsers simulate an identical fight.
// ---------------------------------------------------------------------------

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.join(__dirname, 'dist')
const PORT = process.env.PORT || 8787

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
}

const httpServer = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0])

  if (urlPath.startsWith('/health')) {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: true, players: clients.size, queue: queue.length }))
    return
  }

  if (!fs.existsSync(DIST)) {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end('Arena server running. Build the client (npm run build) to serve it from here.')
    return
  }

  let file = path.join(DIST, urlPath === '/' ? 'index.html' : urlPath)
  if (!file.startsWith(DIST)) {
    res.writeHead(403)
    return res.end('Forbidden')
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')

  const ext = path.extname(file)
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
  fs.createReadStream(file).pipe(res)
})

// ---------------------------------------------------------------------------
// matchmaking + relay
// ---------------------------------------------------------------------------

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })
const clients = new Map() // ws -> session
const queue = [] // sessions waiting for an opponent

function send(ws, obj) {
  if (ws.readyState === 1) ws.send(JSON.stringify(obj))
}

function leaveQueue(session) {
  const i = queue.indexOf(session)
  if (i >= 0) queue.splice(i, 1)
}

function endMatch(session) {
  const match = session.match
  if (!match) return
  session.match = null
  for (const other of match.players) {
    if (other !== session) other.match = null
  }
  const foe = match.players.find((p) => p !== session)
  if (foe?.ws.readyState === 1) send(foe.ws, { t: 'ko' })
}

wss.on('connection', (ws) => {
  const session = { ws, player: -1, match: null, picks: null, ready: false, name: 'Player' }
  clients.set(ws, session)

  ws.on('message', (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }

    switch (msg.t) {
      case 'hello':
        send(ws, { t: 'welcome', player: 0, online: clients.size })
        break

      case 'ping':
        send(ws, { t: 'pong', at: msg.at })
        break

      case 'queue': {
        if (session.match) return
        if (!queue.includes(session)) queue.push(session)
        send(ws, { t: 'queued', queue: queue.length })

        if (queue.length >= 2) {
          const a = queue.shift()
          const b = queue.shift()
          const seed = (Math.random() * 0xffffffff) >>> 0
          a.match = { players: [a, b], seed, picks: [null, null], ready: [false, false] }
          b.match = a.match
          a.player = 0
          b.player = 1
          send(a.ws, { t: 'matched', seed, player: 0 })
          send(b.ws, { t: 'matched', seed, player: 1 })
        }
        break
      }

      case 'cancel':
        leaveQueue(session)
        send(ws, { t: 'cancelled' })
        break

      case 'pick': {
        const m = session.match
        if (!m) return
        m.picks[session.player] = msg.charId
        const foe = m.players[1 - session.player]
        if (foe) send(foe.ws, { t: 'pick', player: session.player, charId: msg.charId })
        break
      }

      case 'ready': {
        const m = session.match
        if (!m) return
        m.picks[session.player] = msg.charId
        m.ready[session.player] = true
        const foe = m.players[1 - session.player]
        if (foe) send(foe.ws, { t: 'pick', player: session.player, charId: msg.charId })
        if (m.ready[0] && m.ready[1]) {
          send(m.players[0].ws, { t: 'start', seed: m.seed, picks: m.picks })
          send(m.players[1].ws, { t: 'start', seed: m.seed, picks: m.picks })
        }
        break
      }

      case 'in': {
        const m = session.match
        if (!m) return
        const foe = m.players[1 - session.player]
        if (!foe || foe.ws.readyState !== 1) return
        // relay each frame's input to the opponent, tagged with OUR index
        const list = Array.isArray(msg.list) ? msg.list.slice(-120) : []
        const payload = list.map((e) => ({ t: 'in', f: e.f | 0, i: session.player, b: e.b | 0 }))
        foe.ws.send(JSON.stringify(payload.length === 1 ? payload[0] : { t: 'batch', list: payload }))
        break
      }

      case 'bye':
        ws.close()
        break
    }
  })

  ws.on('close', () => {
    clients.delete(ws)
    leaveQueue(session)
    endMatch(session)
  })

  ws.on('error', () => {
    clients.delete(ws)
    leaveQueue(session)
    endMatch(session)
  })
})

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`⚔  ANIME CLASH arena server → http://0.0.0.0:${PORT}`)
})
