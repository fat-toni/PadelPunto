// A wild finger on the simulated watch: thousands of random taps, holds, slides, keys, swipes,
// keyboard entries, screen-offs, restarts and full-storage phases all over the app, every second
// run with the score call on. After every
// step the app must not have crashed and must be consistent: saved files readable, the score on
// screen equal to the saved points, watch buttons and screen settings only locked in the match.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Watch, SCREEN } from './mock/watch.mjs'
import { replay, pointLabels } from '../utils/score.js'

const RUNS = 12
const STEPS = 1500

// Small seeded random generator (mulberry32), so a failing run can be replayed.
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// stale: points were played while the storage was full; the file catches up with the next
// point once there is room again.
function check(w, stale) {
  for (const [path, raw] of w.files) assert.doesNotThrow(() => JSON.parse(raw), path)
  if (w.files.has('log.json')) {
    const log = JSON.parse(w.files.get('log.json'))
    assert.ok(log.length <= 30, 'log too long')
    for (const e of log) assert.ok(typeof e.startedAt === 'number' && Array.isArray(e.sets), 'log entry')
  }
  const z = w.zos
  const url = w.url
  const inMatch = url === 'page/match' && w.page.inst.state
  assert.equal(z.relaunch, !!inMatch, `relaunch on ${url}`)
  if (!inMatch) {
    assert.equal(z.sound.volume, 60, `watch volume not put back on ${url}`)
    assert.equal(z.display.dropWristPaused, false, `screen kept on outside the match (${url})`)
    assert.equal(z.hr.listeners.length, 0, `heart rate still read on ${url}`)
  }
  if (!['page/match', 'page/options'].includes(url)) {
    assert.equal(z.key, null, `keys still locked on ${url}`)
    assert.equal(z.gesture, null, `swipes still locked on ${url}`)
  }
  if (inMatch) {
    const { state, moves, teams } = w.page.inst
    const rebuilt = replay(state.cfg, state.startedAt, moves)
    for (const k of ['points', 'games', 'sets', 'winner', 'tb', 'server']) {
      assert.deepEqual(state[k], rebuilt[k], `match ${k} differs from its points`)
    }
    if (!stale) assert.deepEqual(JSON.parse(w.files.get('match.json')).moves, moves, 'saved points')
    const labels = pointLabels(state)
    teams.forEach((t, i) => {
      assert.equal(t.points.w.props.text, state.winner === null ? labels[i] : '', 'point label')
      assert.equal(t.games.w.props.text, String(state.games[i]), 'games tile')
    })
  }
}

for (let run = 1; run <= RUNS; run++) {
  test(`wild finger, run ${run}: ${STEPS} random actions without a crash or a wrong score`, () => {
    const r = rng(run * 7919)
    const pick = (a) => a[Math.floor(r() * a.length)]
    const w = new Watch()
    w.zos.language = pick([7, 2, 3, 4])
    w.zos.hour12 = r() < 0.3
    // Every second run with the score call on, so its player and the watch volume get shaken too.
    if (run % 2 === 0) w.files.set('cfg.json', JSON.stringify({ voice: 'on', volume: pick(['low', 'high']) }))
    let full = false
    let stale = false
    let lastMoves = null
    const trail = []
    try {
      w.launch()
      for (let i = 0; i < STEPS; i++) {
        if (!w.running) {
          trail.push('launch')
          w.launch()
        }
        const texts = w.texts()
        const x = r()
        let act
        if (w.zos.keyboard) {
          const name = pick(['', 'Ana', '  Bo  ', 'WWWWWWWWWWWW', 'Equipo 7', null])
          act = `type ${JSON.stringify(name)}`
          w.type(name)
        } else if (x < 0.45 && texts.length) {
          const t = pick(texts)
          act = `press "${t}"`
          w.press(t)
        } else if (x < 0.65) {
          // the team cards are the most tapped place
          const y = pick([144, 328, 100, 300])
          act = `tap 120,${y}`
          w.tapAt(120, y)
        } else if (x < 0.72) {
          const px = Math.floor(r() * SCREEN.w)
          const py = Math.floor(r() * 900)
          act = `tap ${px},${py}`
          w.tapAt(px, py, { ms: pick([40, 120, 700, 1200]) })
        } else if (x < 0.77 && texts.length) {
          const t = pick(texts)
          act = `hold "${t}"`
          w.hold(t)
        } else if (x < 0.81 && texts.length) {
          const t = pick(texts)
          act = `slide "${t}"`
          w.slide(t, pick([-90, 40, 120]))
        } else if (x < 0.85) {
          const k = pick(['back', 'home'])
          act = `key ${k}`
          w.key(k)
        } else if (x < 0.88) {
          const d = pick(['right', 'left'])
          act = `swipe ${d}`
          w.swipe(d)
        } else if (x < 0.95) {
          const ms = pick([100, 1000, 3100, 5200, 61000])
          act = `wait ${ms}`
          w.tick(ms)
        } else if (x < 0.97) {
          const ms = pick([3000, 15000])
          act = `screen off ${ms}`
          w.screenOff(ms)
        } else if (x < 0.985) {
          full = !full
          w.full = full
          act = `storage ${full ? 'full' : 'free'}`
        } else {
          act = 'battery empty, restart'
          w.closeApp()
          w.launch()
        }
        trail.push(`${w.url}: ${act}`)
        if (trail.length > 25) trail.shift()
        const moves = w.url === 'page/match' && w.page.inst.moves ? w.page.inst.moves.length : null
        if (full) stale = true
        else if (moves !== null && moves !== lastMoves) stale = false
        if (w.url !== 'page/match') stale = full
        lastMoves = moves
        check(w, stale)
      }
      if (run % 2 === 0)
        assert.ok(w.zos.sound.played.length > 20, `score call barely used: ${w.zos.sound.played.length}`)
    } catch (e) {
      e.message += `\n  last steps (seed run ${run}):\n    ${trail.join('\n    ')}`
      throw e
    } finally {
      w.done()
    }
  })
}
