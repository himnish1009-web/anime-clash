# ⚔ ANIME CLASH

A **playable PvP anime fighting game** that runs entirely in the browser —
built with **React + Tailwind CSS** around a hand-written, fully deterministic
canvas fighting-game engine. No image or audio assets: every sprite, stage and
sound effect is generated procedurally at runtime.

![dark neon landing page with a procedural anime swordswoman](shots/01-landing.png)

---

## Play modes

| Mode | What it is |
| --- | --- |
| **Training Hall** | You vs a CPU with three difficulty tiers (Rookie / Veteran / Monster). |
| **Local Versus** | Two players, one keyboard — WASD vs Arrows, blind select, best of three. |
| **Online PvP** | Real-time 1v1 over WebSockets using **deterministic lockstep netcode**: both browsers simulate the identical fight from a shared RNG seed and only exchange 8-bit input masks per tick. |

## Run it

```bash
npm install

# terminal 1 — arena server (matchmaking + input relay + static host)
npm run server          # ws://0.0.0.0:8787/ws

# terminal 2 — dev site (proxies /ws → the arena server)
npm run dev             # http://localhost:5173
```

Production:

```bash
npm run build           # outputs dist/
npm start               # the arena server serves dist/ AND hosts /ws on one port
```

Only the arena server is required for **online play**; local versus and CPU
modes work with the dev server alone.

## Controls

| Action | Player 1 | Player 2 / online |
| --- | --- | --- |
| Move | `A` / `D` | `←` / `→` |
| Jump | `W` | `↑` |
| Crouch | `S` | `↓` |
| Guard | hold **away** from the opponent | same |
| Light attack | `F` | `J` |
| Heavy attack | `G` | `K` |
| Special (Yuki-Onna: ice shard) | `H` | `L` |
| Ultimate (needs full meter) | `T` | `;` |
| Pause (offline) | `Esc` | `Esc` |

Guarding chips ~11% damage and builds meter fast. Counters (hitting an
opponent during their startup frames) deal 1.22× damage with a big flash.

## The roster

| Fighter | Archetype | Ultimate |
| --- | --- | --- |
| **Kuroha** — The Black Blade | Balanced swordswoman, long reach | Crescent Fang |
| **Renji** — Crimson Gale | Fast, fragile rushdown | Thousand Crimson Palms |
| **Yuki-Onna** — Frost Sovereign | Zoner with ice-shard projectiles | Absolute Zero Garden |
| **Goro** — Mountain Emperor | Heavy grappler, huge damage | Titan Drop |

## Architecture

```
src/
  game/
    constants.js    tick rate, frame data, input bit layout (shared by sim+net)
    characters.js   roster stats, palettes, hair/weapon styles
    sim.js          PURE deterministic simulation (no DOM, no Math.random)
    render.js       procedural canvas renderer (poses, stages, particles, FX)
    ai.js           seeded CPU opponent with intent/reaction model
    net.js          lockstep client (input queueing, fallback on packet loss)
    audio.js        WebAudio synth — hits, guards, supers, KO, music loop
    input.js        keyboard → bitmask
  components/       Landing, Select, OnlineLobby, Battle, Hud, Portrait…
server/
  server.js         ws relay + matchmaking + static host for dist/
tests/
  sim.test.mjs      determinism, rounds, guard, supers, all 16 matchups
  online.test.mjs   two real sockets → matchmaking → 900 identical frames
  dom.test.jsx      jsdom render of every screen + a scripted battle
  browser-check.mjs real Chromium drive-through with screenshots
```

### Why lockstep?

`sim.js` never touches the DOM or `Math.random()` — all randomness flows from
a mulberry32 PRNG seeded per match. Two browsers given the same seed and the
same input stream therefore produce byte-identical fights, so the network
only carries **one byte per player per tick**. The relay server is
stateless-ish: it pairs players, forwards picks/inputs and never simulates.

### Fighting-game systems implemented

- 60 Hz fixed-step loop with an accumulator; hitstop, screen shake, slow-mo KO
- startup / active / recovery frame data; hitstun, blockstun, chip damage
- combo counter with damage scaling, counter hits, juggle launches
- meter gain on give/take, 4-hit cinematic ultimates with invuln startup
- projectile zoning, crossup-safe guarding (guard checks attacker position)
- best-of-three rounds, time-up decisions, double-KO draws
- dynamic camera that zooms with fighter distance

## Tests

```bash
npm test          # simulation: determinism, rounds, guard, supers, roster matrix
npm run test:dom  # jsdom: every screen renders, a battle runs, pause works
npm run test:online   # needs `npm run dev` + `npm run server`; real sockets
npm run test:browser  # headless Chromium screenshots → shots/
npm run lint
```

## Tuning knobs

- Move frame data & damage: `src/game/constants.js` (`MOVES`)
- Character stats/palettes: `src/game/characters.js`
- CPU behaviour: `DIFFICULTIES` in `src/game/ai.js`
- Round length / rounds to win: `ROUND_TIME`, `ROUNDS_TO_WIN`
