// Start screen, clock, info and the serve page.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { px } from '../mock/zos.mjs'
import { T, w, INFO, openOptions } from './helpers.mjs'

// ---- start screen, info, navigation ----

test('first start: start screen without "Weiter", own clock, no system bar', () => {
  w.launch()
  assert.equal(w.url, 'page/start')
  assert.deepEqual(w.texts(), ['18:00', 'Padel Punto', T.newGame, T.options, T.history])
  assert.equal(w.zos.statusBar, false)
})

test('the clock follows the minute and the 12-hour setting', () => {
  w.zos.hour12 = true
  w.launch()
  assert.ok(w.has('6:00'))
  w.tick(60100)
  assert.ok(w.has('6:01'))
})

test('info (end of the options) shows version 1.8.0 and the developers; back returns to the options', () => {
  w.launch()
  openOptions()
  // a small round button left of "Fertig", not a wide card
  const i = w.button(INFO).props
  const done = w.button(T.done).props
  assert.equal(i.w, px(56))
  assert.equal(i.h, i.w)
  assert.ok(i.x + i.w < done.x && Math.abs(i.y + i.h / 2 - (done.y + done.h / 2)) <= px(2))
  w.press(INFO)
  assert.equal(w.url, 'page/info')
  assert.ok(w.has('Version 1.8.0'))
  assert.ok(w.has('Toni & Claude AI'))
  w.press(T.back)
  assert.equal(w.url, 'page/options')
  w.press(INFO).swipe('right')
  assert.equal(w.url, 'page/options')
  w.press(INFO).key('back')
  assert.equal(w.url, 'page/options')
  w.press(T.done)
  assert.equal(w.url, 'page/start')
})

test('the back key on the start screen closes the app', () => {
  w.launch().key('back')
  assert.equal(w.url, 'watchface')
})

test('"Wer schlägt auf?" shows both teams the match way round; "Abbrechen" goes back', () => {
  w.launch().press(T.newGame)
  assert.equal(w.url, 'page/serve')
  assert.deepEqual(w.texts(), ['18:00', T.whoServes, T.them, T.us, T.cancel, T.random])
  w.press(T.cancel)
  assert.equal(w.url, 'page/start')
  assert.equal(w.files.has('match.json'), false)
})
