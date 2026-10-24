// Court time and its alarms.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { T, w, pointText, saved, points, startMatch, openCourt, at, courtTime } from './helpers.mjs'

// ---- court time ----

test('court time: clock button, suggestion, - / +, reminder choice, two alarms, end time on start', () => {
  w.launch()
  openCourt()
  assert.equal(courtTime(), '19:30', 'next half hour + 1 hour (it is 18:00)')
  assert.equal(w.has(T.courtClear), false)
  w.press('+', 0) // hours +
  w.press('-', 1) // minutes -5
  assert.equal(courtTime(), '20:25')
  w.press('-', 0)
  w.press('-', 0)
  w.press('+', 1)
  w.press('+', 1)
  assert.equal(courtTime(), '18:35')
  assert.ok(w.has(T.courtWarn.replace('{n}', 5)))
  w.press(T.courtWarn.replace('{n}', 5))
  assert.ok(w.has(T.courtWarn.replace('{n}', 10)))
  w.press(T.courtSave)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.courtSaved))
  assert.deepEqual(
    w.zos.alarms.map((a) => [a.url, a.time, a.store]),
    [
      ['page/courtAlert', at(18, 25), true],
      ['page/courtAlert', at(18, 35), true],
    ],
  )
  assert.ok(w.has('18:35'), 'end time below the clock button')
  assert.deepEqual(saved('court').warn, 10)
})

test('court time: reminder and end open the alert page, also from a closed app; OK goes back to the match', () => {
  w.launch()
  openCourt()
  w.press(T.courtSave) // 19:30, reminder 19:25
  startMatch()
  points(0, 2)
  w.zos.vibes.length = 0
  w.tick(85 * 60000) // 19:25 and a bit
  assert.equal(w.alarmsDue(), 1)
  assert.equal(w.url, 'page/courtAlert')
  assert.ok(w.has(T.courtLeft.replace('{n}', 5)) || w.has(T.courtLeft.replace('{n}', 4)))
  assert.ok(w.has(T.courtUntil.replace('{t}', '19:30')))
  assert.ok(w.zos.vibes.length > 0, 'it vibrates')
  w.press(T.ok)
  assert.equal(w.url, 'page/match')
  assert.equal(pointText(0), '30', 'the match goes on')
  w.press(T.end).press(T.leave)
  w.closeApp()
  w.tick(6 * 60000)
  assert.equal(w.alarmsDue(), 1)
  assert.equal(w.url, 'page/courtAlert', 'the app starts for the end')
  assert.ok(w.has(T.courtOver))
  w.press(T.ok)
  assert.equal(w.url, 'page/match', 'open match: back into it')
  w.press(T.end).press(T.leave)
  assert.equal(w.has('19:30'), false, 'no end time after it is over')
})

test('court time: "Löschen" removes the alarms; swipe right leaves without saving', () => {
  w.launch()
  openCourt()
  w.press(T.courtSave)
  openCourt()
  assert.equal(courtTime(), '19:30', 'the saved time')
  w.press('+', 0)
  w.swipe('right')
  assert.equal(w.url, 'page/start')
  assert.ok(w.has('19:30'), 'not changed')
  openCourt()
  w.press(T.courtClear)
  assert.deepEqual(w.zos.alarms, [])
  assert.ok(w.zos.toasts.includes(T.courtCleared))
  assert.equal(w.has('19:30'), false)
  assert.equal(saved('court').end, null)
})

test('court time: a time that has passed today means tomorrow', () => {
  w.launch()
  openCourt()
  for (let i = 0; i < 2; i++) w.press('-', 0) // 17:30
  assert.equal(courtTime(), '17:30')
  w.press(T.courtSave)
  assert.equal(w.zos.alarms.at(-1).time, at(17, 30, 1))
})

test('court time: a reminder that would already be due is left out, the end alarm stays', () => {
  w.launch()
  openCourt()
  w.press('-', 0) // 18:30
  for (let i = 0; i < 5; i++) w.press('-', 1) // 18:05, it is 18:00
  assert.equal(courtTime(), '18:05')
  w.press(T.courtSave) // reminder 5 min before = now
  assert.deepEqual(
    w.zos.alarms.map((a) => a.time),
    [at(18, 5)],
  )
})

test('court time: the watch refusing the alarm says so', () => {
  w.zos.alarmFails = true
  w.launch()
  openCourt()
  w.press(T.courtSave)
  assert.ok(w.zos.toasts.includes(T.courtFailed))
})
