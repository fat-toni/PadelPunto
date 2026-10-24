// Storage problems and damaged files.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  T,
  w,
  pointText,
  gamesText,
  saved,
  log,
  tapTeam,
  points,
  games,
  startMatch,
  openOptions,
  freshWatch,
} from './helpers.mjs'

// ---- storage problems and damaged files ----

test('storage full during a match: points go on, one notice', () => {
  w.launch()
  startMatch()
  w.full = true
  points(0, 5)
  assert.equal(gamesText(0), '1')
  assert.deepEqual(w.zos.toasts, [T.saveFailed])
})

test('storage full at "Ende": the match is kept for "Weiter" and filed once there is room', () => {
  w.launch()
  startMatch()
  games(0, 1)
  w.full = true
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.saveFailed))
  assert.ok(w.has(T.resume))
  w.full = false
  w.press(T.resume).press(T.end).press(T.endConfirm)
  assert.equal(log().length, 1)
  assert.equal(w.has(T.resume), false)
})

test('storage full at "Neues Spiel": the old match is not overwritten', () => {
  w.launch()
  startMatch()
  games(0, 1)
  w.press(T.end).press(T.leave)
  w.full = true
  w.press(T.newGame).press(T.endOld)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.saveFailed))
  assert.equal(saved('match').moves.length, 4)
})

test('storage full on the serve page: no match starts, one notice, it works once there is room', () => {
  w.launch()
  w.press(T.newGame)
  w.full = true
  w.tapAt(195, 300)
  assert.equal(w.url, 'page/serve')
  assert.deepEqual(w.zos.toasts, [T.saveFailed])
  w.full = false
  w.tapAt(195, 300)
  assert.equal(w.url, 'page/match')
})

test('damaged files never crash the app', () => {
  for (const [key, value] of [
    ['match', '{"state": {"cfg": 5}}'],
    ['match', 'not json'],
    ['match', '[1, 2, 3]'],
    ['log', '{"a": 1}'],
    ['log', '[null, 5, {"startedAt": "x"}]'],
    ['log', '[{"startedAt": 1, "endedAt": 2, "mode": "adv", "winner": null, "abandoned": false, "sets": []}]'],
    ['cfg', '"text"'],
    ['cfg', '{"mode": "tennis", "colors": [99, -1], "names": [1, 2]}'],
  ]) {
    freshWatch()
    w.files.set(`${key}.json`, value)
    w.launch()
    assert.equal(w.url, 'page/start', `${key}: ${value}`)
    w.press(T.history)
    w.press(T.back)
    openOptions()
    w.press(T.done)
    startMatch()
    tapTeam(0)
    assert.equal(pointText(0), '15')
  }
})

test('"Weiter" rebuilds the score from the saved points, even if the saved score is wrong', () => {
  w.launch()
  startMatch()
  points(0, 2)
  w.press(T.end).press(T.leave)
  const m = saved('match')
  m.state.points = [3, 3]
  w.files.set('match.json', JSON.stringify(m))
  w.closeApp()
  w.launch().press(T.resume)
  assert.equal(pointText(0), '30')
})
