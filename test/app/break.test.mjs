// Breaks and the change of ends.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { T, w, hint, saved, tapTeam, games, startMatch, option, openOptions } from './helpers.mjs'

// ---- break at a change of ends ----

const pauseEnd = ['strong', 'pause', 'strong']
const vibeTypes = () => w.zos.vibes.map((v) => v.map((x) => x.type))

test('break: 90 s countdown after the side change, buzz at the end; none after the first game', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 1) // 1:0, change of ends without a break
  assert.equal(hint(), T.switchSides)
  w.tick(6000)
  assert.equal(hint(), '')
  games(0, 2) // 3:0
  assert.equal(hint(), T.switchSides)
  w.tick(5100)
  assert.equal(hint(), 'Pause 1:25')
  w.tick(25000)
  assert.equal(hint(), 'Pause 1:00')
  w.zos.vibes.length = 0
  w.tick(59000)
  assert.equal(hint(), 'Pause 0:01')
  assert.deepEqual(vibeTypes(), [])
  w.tick(1000)
  assert.equal(hint(), '')
  assert.deepEqual(vibeTypes(), [pauseEnd])
})

test('break: the next point or undo ends it', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 3)
  w.tick(10000)
  assert.equal(hint(), 'Pause 1:20')
  tapTeam(1)
  assert.equal(hint(), '')
  w.tick(90000)
  assert.ok(!vibeTypes().some((v) => v.join() === pauseEnd.join()), 'no buzz for a break that ended')
  w.press(T.undo) // back to 3:0 at 0:0 points, the break does not come back
  w.tick(6000)
  assert.equal(hint(), '')
  games(0, 2) // 5:0
  w.tick(6000)
  assert.equal(hint(), 'Pause 1:24')
  w.press(T.undo)
  assert.equal(hint(), '')
})

test('option "Seitenwechsel": cycles, is saved and goes into the new match', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.sidesFip))
  option(T.optSides)
  assert.ok(w.has(T.sidesSet))
  w.press(T.done)
  assert.equal(saved('cfg').sides, 'set')
  startMatch()
  games(0, 1) // 1:0: no change of ends in this variant
  assert.equal(hint(), '')
  games(1, 1)
  games(0, 4) // 6:1
  assert.equal(saved('match').state.cfg.sides, 'set', 'the match keeps its variant')
})

test('option "Seitenwechsel: Nach dem Satz": the hint comes at the set end, also at 6:4', () => {
  w.files.set('cfg.json', JSON.stringify({ sides: 'set', pause: 'off' }))
  w.launch()
  startMatch()
  for (let i = 0; i < 4; i++) {
    games(0, 1)
    assert.equal(hint(), '', 'no change of ends inside the set')
    games(1, 1)
  }
  games(0, 2) // 6:4
  assert.equal(hint(), T.switchSides)
})

test('break: after every set 2 minutes, also without a change of ends; none after the match', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 3) // 3:0, change of ends
  w.tick(91000)
  games(1, 3)
  w.tick(91000)
  games(0, 3) // 6:3 → set, odd: change of ends and the longer break
  assert.equal(hint(), T.switchSides)
  w.tick(5100)
  assert.equal(hint(), 'Pause 1:55')
  w.tick(115000)
  assert.equal(hint(), '')
  games(0, 2)
  w.tick(91000)
  games(1, 4)
  w.tick(91000)
  games(0, 4) // 6:4 → set and match: no break
  w.tick(6000)
  assert.equal(hint(), T.matchOver)
})

test('break: a set won 6:4 (no change of ends) still gets one', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 2)
  w.tick(91000)
  games(1, 4)
  w.tick(91000)
  games(0, 4) // 6:4 (the change of ends at 5:4 is still on screen for a moment)
  w.tick(6000)
  assert.equal(hint(), 'Pause 1:54', 'FIP: up to 120 s after a set')
})

test('break: off by default; the option switches it on, old seconds values fall back to off', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.pauseTimes))
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'on')
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'off')
  w.press(T.done)
  startMatch()
  games(0, 3)
  w.tick(6000)
  assert.equal(hint(), '', 'no break when off')
  w.files.set('cfg.json', JSON.stringify({ pause: 90 }))
  w.press(T.end).press(T.leave)
  openOptions()
  assert.equal(saved('cfg').pause, 90)
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'on', 'an old 90 counts as off, one tap turns it on')
})

test('break: off in the options, and never after the match', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'off', bestOf: 1 }))
  w.launch()
  startMatch()
  games(0, 3)
  w.tick(6000)
  assert.equal(hint(), '')
  w.press(T.end).press(T.endConfirm)
  w.files.set('cfg.json', JSON.stringify({ bestOf: 1 }))
  w.press(T.newGame).tapAt(195, 300)
  games(0, 2)
  games(1, 3)
  games(0, 4) // 6:3, odd: change of ends, but the match is over
  w.tick(6000)
  assert.equal(hint(), T.matchOver)
})

test('break: leaving the match stops the countdown', () => {
  w.launch()
  startMatch()
  games(0, 3)
  w.press(T.end).press(T.leave)
  w.zos.vibes.length = 0
  w.tick(100000)
  assert.deepEqual(vibeTypes(), [])
})
