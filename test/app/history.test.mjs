// The history.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { T, w, log, games, startMatch, playWonMatch } from './helpers.mjs'

// ---- history ----

test('empty history: a note, no delete button', () => {
  w.launch().press(T.history)
  assert.ok(w.has(T.noMatches))
  assert.equal(w.has(T.clearLog), false)
  w.press(T.back)
  assert.equal(w.url, 'page/start')
})

test('history: newest first with date, mode, duration, sets and result', () => {
  w.launch()
  playWonMatch(0)
  w.tick(3600000)
  startMatch()
  games(1, 1)
  w.press(T.end).press(T.endConfirm)
  w.press(T.history)
  const t = w.texts()
  assert.ok(t.indexOf(T.abandoned) < t.indexOf('Sieg Wir'))
  assert.ok(t.includes('6:0  6:0'))
  assert.ok(t.includes('0:1'))
  assert.ok(
    t.some((x) => /^\d\d\.\d\d\. 1[89]:\d\d · Vorteil · 0:\d\d$/.test(x)),
    JSON.stringify(t),
  )
})

test('history shows 10 matches, "Ältere anzeigen" the rest, at most 30 are kept', () => {
  const entries = Array.from({ length: 34 }, (_, i) => ({
    startedAt: Date.parse('2026-10-01T10:00:00') + i * 3600000,
    endedAt: Date.parse('2026-10-01T10:30:00') + i * 3600000,
    mode: 'adv',
    names: ['', ''],
    colors: [0, 1],
    winner: 0,
    abandoned: false,
    sets: [{ g: [6, i % 5], tb: null, mtb: false }],
  }))
  w.files.set('log.json', JSON.stringify(entries.slice(0, 29).reverse()))
  w.launch()
  playWonMatch(0)
  assert.equal(log().length, 30)
  playWonMatch(0)
  assert.equal(log().length, 30)
  w.press(T.history)
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 10)
  w.zos.scrollTop = 700
  w.press('Ältere anzeigen (20)')
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 30)
  assert.equal(w.zos.scrolledTo, -700)
})

test('history: hold to arm a card, tap again to delete it, the list stays in place', () => {
  w.launch()
  playWonMatch(0)
  playWonMatch(1)
  w.press(T.history)
  w.hold('Sieg Die')
  assert.ok(w.has(T.deleteEntry))
  w.zos.scrollTop = 120
  w.press(T.deleteEntry)
  assert.equal(log().length, 1)
  assert.equal(log()[0].winner, 0)
  assert.equal(w.has('Sieg Die'), false)
  assert.equal(w.zos.scrolledTo, -120)
})

test('history: an armed card falls back after 3 s, a short tap never deletes', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.press('Sieg Wir')
  assert.equal(w.has(T.deleteEntry), false)
  w.hold('Sieg Wir').tick(3100)
  assert.ok(w.has('Sieg Wir'))
  w.press('Sieg Wir')
  assert.equal(log().length, 1)
})

test('history: scrolling on an armed card does not delete it', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.hold('Sieg Wir')
  w.slide(T.deleteEntry, -80)
  assert.equal(log().length, 1)
})

test('history: scrolling the page over a card never arms or deletes it', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.scrollOn('Sieg Wir')
  assert.equal(w.has(T.deleteEntry), false)
  w.scrollOn('Sieg Wir', -120, 80)
  assert.equal(log().length, 1)
  w.hold('Sieg Wir')
  w.scrollOn(T.deleteEntry, 120, 80)
  assert.equal(log().length, 1)
})

test('history: only one card is armed at a time', () => {
  w.launch()
  playWonMatch(0)
  playWonMatch(1)
  w.press(T.history)
  w.hold('Sieg Wir')
  w.hold('Sieg Die')
  assert.equal(w.texts().filter((x) => x === T.deleteEntry).length, 1)
  assert.ok(w.has('Sieg Wir'))
})

test('"Verlauf löschen" needs a second tap within 3 s', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history).press(T.clearLog)
  assert.ok(w.has(T.clearConfirm))
  w.tick(3100)
  assert.ok(w.has(T.clearLog))
  assert.equal(log().length, 1)
  w.press(T.clearLog).press(T.clearConfirm)
  assert.ok(w.has(T.noMatches))
  assert.equal(w.files.has('log.json'), false)
})

test('history: deleting a card after "Ältere anzeigen" keeps all matches shown', () => {
  const entries = Array.from({ length: 12 }, (_, i) => ({
    startedAt: Date.parse('2026-10-01T10:00:00') + i * 3600000,
    endedAt: Date.parse('2026-10-01T10:30:00') + i * 3600000,
    mode: 'adv',
    names: ['', ''],
    colors: [0, 1],
    winner: i === 0 ? 1 : 0,
    abandoned: false,
    sets: [{ g: [6, 1], tb: null, mtb: false }],
  }))
  w.files.set('log.json', JSON.stringify(entries.reverse()))
  w.launch()
  w.press(T.history)
  w.press('Ältere anzeigen (2)')
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 12)
  w.hold('Sieg Die')
  w.press(T.deleteEntry)
  assert.equal(log().length, 11)
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 11)
  assert.ok(!w.has('Ältere anzeigen (1)'))
})
