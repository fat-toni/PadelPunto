// Battery, CPU and memory budgets on the simulated watch (test/mock/watch.mjs). A watch can't be
// profiled from here, so this counts what costs energy on it: timer wake-ups while nobody taps,
// widget changes (redraws), file writes and their size, vibration time, sensors left on, widgets
// per page (memory), timers or listeners left behind (leaks) and the work for undo and "Weiter".
// If a change makes the app hungrier, a budget here fails. Run with: npm test
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { Watch } from './mock/watch.mjs'
import { replay } from '../utils/score.js'
import { STRINGS } from '../locales/index.js'

const T = STRINGS.de
const CARD_Y = [238, 54]
let w

beforeEach(() => {
  w = new Watch()
})
afterEach(() => w.done())

const cost = () => w.zos.cost
function resetCost() {
  Object.assign(cost(), { draws: 0, wakeups: 0, writes: 0, bytes: 0 })
}

// One point for team t. A banner from a won set is tapped away first (between the cards, so
// the tap hits only the banner), as a player would.
function tapTeam(t) {
  if (w.page && w.page.inst.bannerOn) {
    w.tapAt(195, 222)
    w.tick(400)
  }
  w.tapAt(60, CARD_Y[t] + 90)
  w.tick(200)
}

function startMatch() {
  w.press(T.newGame)
  if (w.url === 'page/start') w.press(T.endOld)
  w.tapAt(195, 300)
  w.tick(6000)
}

// Waits second by second: a timer that re-arms itself runs only once per tick() call, so
// bigger steps would hide a timer that wakes the watch more often than once a minute.
function idle(minutes) {
  for (let i = 0; i < minutes * 60; i++) w.tick(1000)
}

// 6:3 6:4, with a 15 for the losing side in every game: 95 points.
function normalMatch() {
  const games = [0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0]
  for (const g of games) for (const t of [g, 1 - g, g, g, g]) tapTeam(t)
}

// ---- CPU wake-ups and redraws while nobody taps ----

test('idle match: one wake-up and at most 2 redraws a minute (clock and match time)', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  resetCost()
  idle(30)
  assert.ok(cost().wakeups <= 30, `${cost().wakeups} wake-ups in 30 min`)
  assert.ok(cost().draws <= 60, `${cost().draws} redraws in 30 min`)
})

test('idle start, options and history: at most 2 wake-ups a minute', () => {
  for (const open of [() => {}, () => w.press(T.options), () => w.press(T.history), () => w.press('i')]) {
    w.done()
    w = new Watch()
    w.launch()
    open()
    resetCost()
    idle(10)
    assert.ok(cost().wakeups <= 20, `${w.url}: ${cost().wakeups} wake-ups in 10 min`)
  }
})

test('heart rate: the screen only changes when the value changes', () => {
  w.launch()
  startMatch()
  w.heartRate(120)
  resetCost()
  for (let i = 0; i < 60; i++) w.heartRate(120)
  assert.equal(cost().draws, 0)
  w.heartRate(121)
  assert.equal(cost().draws, 1)
})

// ---- per point: redraws, storage, vibration ----

test('a point costs one file write and few redraws', () => {
  w.launch()
  startMatch()
  resetCost()
  normalMatch()
  const n = 95
  assert.equal(cost().writes, n, 'one write per point')
  assert.ok(cost().draws / n <= 14, `${(cost().draws / n).toFixed(1)} redraws per point`)
  assert.ok(cost().bytes / n <= 280, `${Math.round(cost().bytes / n)} bytes per point`)
})

test('a 3-hour match with endless deuces: the match file stays small', () => {
  w.launch()
  startMatch()
  for (let i = 0; i < 800; i++) tapTeam(i % 2)
  const size = w.files.get('match.json').length
  assert.ok(size <= 2200, `match file ${size} bytes after 800 points`)
})

test('vibration: 20 ms per point, a side change two ticks, sets and the match longer; nothing outside the match', () => {
  w.launch()
  const motorMs = () =>
    w.zos.vibes.reduce(
      (sum, v) =>
        sum + (Array.isArray(v) ? v.filter((x) => x.type !== 'pause').reduce((a, x) => a + x.duration, 0) : 20),
      0,
    )
  w.press(T.options).press(T.done).press(T.history).press(T.back)
  assert.equal(w.zos.vibes.length, 0, 'menus never vibrate')
  startMatch()
  normalMatch()
  // points and side changes, plus at most 2 won sets (600 ms) and the won match (3 × 600 ms)
  assert.ok(motorMs() <= 95 * 20 + 20 * 20 + 2 * 600 + 1800, `${motorMs()} ms motor for 95 points`)
})

// ---- sensors and screen ----

test('outside the match: no heart rate sensor, screen and buttons back to normal', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.zos.hr.listeners.length, 0)
  assert.equal(w.zos.display.dropWristPaused, false)
  assert.equal(w.zos.display.palmPaused, false)
  assert.equal(w.zos.relaunch, false)
  assert.equal(w.zos.key, null)
})

test('"Puls im Match: Aus" never starts the sensor', () => {
  w.files.set('cfg.json', JSON.stringify({ hr: 'off' }))
  w.launch()
  startMatch()
  normalMatch()
  assert.equal(w.zos.hr.created, 0)
})

// ---- memory ----

test('widgets per page stay within budget', () => {
  const entries = Array.from({ length: 30 }, (_, i) => ({
    startedAt: 1e12 + i * 1e6,
    endedAt: 1e12 + i * 1e6 + 5e5,
    mode: 'adv',
    names: ['', ''],
    colors: [0, 1],
    winner: 0,
    abandoned: false,
    sets: [{ g: [6, 3], tb: null, mtb: false }],
  }))
  w.files.set('log.json', JSON.stringify(entries))
  w.launch()
  const budget = { 'page/start': 10, 'page/info': 10, 'page/serve': 10, 'page/options': 125, 'page/match': 50 }
  const count = () => w.page.widgets.length
  assert.ok(count() <= budget['page/start'])
  w.press('i')
  assert.ok(count() <= budget['page/info'])
  w.key('back').press(T.options)
  assert.ok(count() <= budget['page/options'], `options: ${count()}`)
  w.press(T.done).press(T.newGame)
  assert.ok(count() <= budget['page/serve'])
  w.tapAt(195, 300)
  assert.ok(count() <= budget['page/match'], `match: ${count()}`)
  w.press(T.end).press(T.history)
  assert.ok(count() <= 50, `history, first 10: ${count()}`)
  w.press('Ältere anzeigen (20)')
  assert.ok(count() <= 130, `history, all 30: ${count()}`)
})

test('no leaks: 100 rounds through every page leave no timers, listeners or pages behind', () => {
  w.launch()
  const timers = cost().pending.size
  for (let i = 0; i < 100; i++) {
    w.press(T.options).press(T.done)
    w.press('i').key('back')
    w.press(T.history).press(T.back)
    startMatch()
    tapTeam(0)
    w.heartRate(100 + i)
    w.press(T.end).press(T.endConfirm)
  }
  w.tick(10000)
  assert.equal(cost().pending.size, timers, 'timers left running')
  assert.equal(w.zos.hr.listeners.length, 0, 'heart rate listeners')
  assert.equal(w.stack.length, 1, 'pages kept open')
  assert.equal(w.zos.key, null)
  assert.equal(w.zos.gesture, null)
})

test('the history keeps at most 30 matches, its file stays small', () => {
  w.launch()
  for (let i = 0; i < 35; i++) {
    startMatch()
    for (let p = 0; p < 24 * 4; p++) tapTeam(0)
    w.press(T.end)
  }
  const size = w.files.get('log.json').length
  assert.equal(JSON.parse(w.files.get('log.json')).length, 30)
  assert.ok(size <= 8000, `log file ${size} bytes`)
})

// ---- work for undo and "Weiter" ----

// Undo and "Weiter" rebuild the score from all points of the match. The watch is far slower
// than a PC; 2 ms here leaves room for a factor of 100 before a tap feels slow.
test('undo and "Weiter" in an 800-point match: rebuilding the score is cheap', () => {
  w.launch()
  startMatch()
  for (let i = 0; i < 800; i++) tapTeam(i % 2)
  const { state, moves } = w.page.inst
  const t0 = performance.now()
  for (let i = 0; i < 50; i++) replay(state.cfg, state.startedAt, moves)
  const ms = (performance.now() - t0) / 50
  assert.ok(ms < 2, `${ms.toFixed(2)} ms for 800 points`)
  resetCost()
  w.press(T.undo)
  assert.equal(cost().writes, 1)
  w.press(T.end).press(T.leave)
  w.press(T.resume)
  assert.equal(w.page.inst.moves.length, 799)
})
