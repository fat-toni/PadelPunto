// Ending, leaving and coming back to a match.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { T, w, pointText, gamesText, log, tapTeam, points, games, startMatch } from './helpers.mjs'

// ---- leaving and coming back ----

test('"Ende" first asks; "Rückgängig" turns into "Verlassen" for 3 seconds', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.press(T.end)
  assert.ok(w.has(T.endConfirm) && w.has(T.leave))
  w.tick(3100)
  assert.ok(w.has(T.end) && w.has(T.undo))
  assert.equal(w.url, 'page/match')
})

test('"Ende" twice files an unfinished match as abandoned', () => {
  w.launch()
  startMatch()
  games(0, 2)
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.url, 'page/start')
  assert.equal(log()[0].abandoned, true)
  assert.equal(w.files.has('match.json'), false)
  w.press(T.history)
  assert.ok(w.has(T.abandoned))
  assert.ok(w.has('2:0'))
})

test('"Ende" at 0:0 leaves at once and keeps nothing', () => {
  w.launch()
  startMatch()
  w.press(T.end)
  assert.equal(w.url, 'page/start')
  assert.equal(log().length, 0)
  assert.equal(w.files.has('match.json'), false)
})

test('"Verlassen" goes back to the start page; "Weiter" continues the same match with undo', () => {
  w.launch()
  startMatch()
  games(0, 1)
  points(1, 2)
  w.press(T.end).press(T.leave)
  assert.equal(w.url, 'page/start')
  assert.ok(w.has(T.resume))
  w.press(T.resume)
  assert.deepEqual([gamesText(0), pointText(1)], ['1', '30'])
  w.press(T.undo)
  assert.equal(pointText(1), '15')
})

test('"Neues Spiel" over an open match asks first and files the old one', () => {
  w.launch()
  startMatch()
  games(1, 1)
  w.press(T.end).press(T.leave)
  w.press(T.newGame)
  assert.ok(w.has(T.endOld))
  assert.equal(w.url, 'page/start')
  w.tick(3100)
  assert.ok(w.has(T.newGame))
  startMatch()
  assert.equal(log().length, 1)
  assert.equal(log()[0].abandoned, true)
  assert.equal(pointText(0), '0')
})

test('a won match that was never ended goes to the history on the next start', () => {
  w.launch()
  startMatch()
  games(0, 12)
  w.closeApp() // e.g. the battery ran out
  w.launch()
  assert.equal(w.has(T.resume), false)
  assert.equal(log().length, 1)
  assert.equal(log()[0].winner, 0)
})

test('waking the watch: back into the match during it, the watch face after it', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.screenOff(15000)
  assert.equal(w.url, 'page/match')
  assert.equal(pointText(0), '15')
  w.press(T.end).press(T.endConfirm)
  w.screenOff(5000) // back within 10 s: the app is still there
  assert.equal(w.url, 'page/start')
  w.screenOff(15000)
  assert.equal(w.url, 'watchface')
})

test('after "Verlassen" the next app start has no wake-up relaunch left over', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.press(T.end).press(T.leave)
  assert.equal(w.zos.relaunch, false)
})
