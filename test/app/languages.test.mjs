// Every language on every page, and the layout of every text and widget.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SCREEN } from '../mock/watch.mjs'
import { STRINGS } from '../../locales/index.js'
import { getTextLayout } from '../mock/zos.mjs'
import {
  T,
  w,
  pointText,
  gamesText,
  setTexts,
  hint,
  won,
  points,
  games,
  startMatch,
  openDiag,
  openCourt,
  openTraining,
  openOptions,
} from './helpers.mjs'

// ---- languages and layout ----

const keys = new Set(Object.keys(T))

// Visits every page (and the match in its main states) and collects the texts on screen.
function tour(L) {
  const seen = []
  const look = () => seen.push(...w.texts().map((t) => [w.url, t]))
  w.launch()
  look()
  openDiag(L)
  look()
  w.key('back')
  look()
  w.key('back')
  look()
  w.swipe('right')
  openTraining()
  look()
  w.swipe('right')
  openCourt()
  look()
  w.press(L.courtSave)
  look()
  w.tick(85 * 60000) // 19:25, the reminder
  w.alarmsDue()
  look()
  w.press(L.ok)
  w.press(L.newGame)
  look()
  w.tapAt(195, 300)
  look()
  points(0, 3)
  points(1, 3)
  look()
  games(0, 12)
  look()
  w.tick(6000)
  look()
  w.press(L.end)
  w.press(L.history)
  look()
  w.hold(w.texts().find((t) => t.includes('6:0')))
  look()
  return seen
}

for (const lang of ['de', 'en', 'es', 'it', 'fr']) {
  test(`${lang}: every page shows real texts, nothing missing or untranslated`, () => {
    w.files.set('cfg.json', JSON.stringify({ lang }))
    const seen = tour(STRINGS[lang])
    for (const [url, t] of seen) {
      assert.ok(!keys.has(t), `${url}: raw key "${t}"`)
      assert.ok(!/\{\w+\}/.test(t), `${url}: placeholder in "${t}"`)
      assert.ok(!/\b(undefined|NaN|null)\b/.test(t), `${url}: "${t}"`) // not "Annulla"
    }
    if (lang !== 'de') {
      const german = new Set(
        Object.entries(T)
          .filter(([k, v]) => STRINGS[lang][k] !== v)
          .map(([, v]) => v),
      )
      const left = seen.filter(([, t]) => german.has(t))
      assert.deepEqual(left, [], 'German text in another language')
    }
  })
}

// Pages that do not scroll must fit the screen; scrolling pages must fit its width.
test('layout: every widget on every page stays on the screen', () => {
  const check = () => {
    const scrolls = ['page/options', 'page/history', 'page/diag'].includes(w.url)
    for (const x of w.visible()) {
      const p = x.props
      const b =
        x.type === 'CIRCLE'
          ? { x: p.center_x - p.radius, y: p.center_y - p.radius, w: 2 * p.radius, h: 2 * p.radius }
          : p
      const where = `${w.url} ${x.type} "${p.text || ''}" ${JSON.stringify(b)}`
      assert.ok(b.x >= 0 && b.x + b.w <= SCREEN.w, where)
      if (!scrolls) assert.ok(b.y >= 0 && b.y + b.h <= SCREEN.h, where)
    }
  }
  w.launch()
  check()
  openDiag()
  check()
  w.press(T.back)
  check()
  w.press(T.back)
  w.press(T.done)
  openTraining()
  check()
  w.press(T.cancel)
  openCourt()
  check()
  w.press(T.courtSave)
  check()
  w.tick(85 * 60000)
  w.alarmsDue()
  check()
  w.press(T.ok)
  openCourt()
  check()
  w.swipe('right')
  openOptions()
  check()
  w.press(T.done).press(T.newGame)
  check()
  w.tapAt(195, 300)
  check()
  games(0, 12)
  check()
  w.press(T.end).press(T.history)
  check()
})

test('third set without tiebreak: two-digit games (12:10) fit on the card, the banner and in the history', () => {
  w.files.set('cfg.json', JSON.stringify({ decider: 'noTb', pause: 'off' }))
  const tooWide = []
  const check = () => {
    for (const x of w.visible()) {
      const p = x.props
      if (x.type !== 'TEXT' || !p.text) continue
      const wide = getTextLayout(p.text, { text_size: p.text_size }).width
      if (wide > p.w) tooWide.push(`${w.url} "${p.text}" ~${Math.round(wide)}/${p.w} px`)
    }
  }
  w.launch()
  startMatch()
  games(0, 6)
  games(1, 6)
  for (let i = 0; i < 10; i++) games(i % 2, 1) // 5:5
  games(0, 1)
  games(1, 1) // 6:6: no tiebreak in the third set
  w.tick(6000) // the change of ends from 6:5 fades
  assert.equal(hint(), '')
  assert.equal(pointText(0), '0')
  for (let i = 0; i < 8; i++) games(i % 2, 1) // 10:10
  assert.deepEqual([gamesText(0), gamesText(1)], ['10', '10'])
  check()
  games(0, 1) // 11:10, no set yet
  assert.equal(won(0), false)
  games(0, 1) // 12:10
  assert.ok(won(0))
  assert.deepEqual(setTexts(0), ['6', '0', '12'])
  assert.deepEqual(setTexts(1), ['0', '6', '10'])
  assert.ok(w.has('12:10'), 'banner score')
  check()
  w.tick(4000)
  w.press(T.end).press(T.history)
  assert.ok(w.has('6:0  0:6  12:10'))
  check()
  assert.deepEqual(tooWide, [])
})

// One-line texts must fit their widget at its text size (widths estimated like a watch font).
// Names of the 8 colors and the history lines are checked too, via the tour.
for (const lang of ['de', 'en', 'es', 'it', 'fr']) {
  test(`${lang}: every text fits its box`, () => {
    w.files.set('cfg.json', JSON.stringify({ lang, mode: 'star', names: ['WWWWWWWW', 'MMMMMMMM'] }))
    w.zos.hour12 = true // "pm" makes the history lines longest
    const L = STRINGS[lang]
    const tooWide = []
    const check = () => {
      for (const x of w.visible()) {
        const p = x.props
        if (!['TEXT', 'BUTTON'].includes(x.type) || !p.text || p.text_style === 1) continue
        const wide = getTextLayout(p.text, { text_size: p.text_size }).width
        if (wide > p.w) tooWide.push(`${w.url} "${p.text}" ~${Math.round(wide)}/${p.w} px`)
      }
    }
    w.launch()
    check()
    openDiag(L)
    check()
    w.key('back')
    check()
    w.key('back')
    check()
    w.swipe('right')
    openTraining()
    check()
    w.press(L.trainKind) // Americano
    check()
    w.press(L.go)
    w.tapAt(195, 300)
    check()
    points(0, 23)
    check()
    w.press(L.end).press(L.endConfirm)
    openTraining()
    w.press(L.trainKind) // back to "Bis Ziel"
    w.press(L.go)
    w.tapAt(195, 300)
    points(0, 20) // match point
    check()
    w.press(L.end).press(L.endConfirm)
    w.press(L.options)
    for (let i = 0; i < 7; i++) {
      w.press(L.optColor0)
      check()
    }
    w.press(L.done).press(L.newGame)
    check()
    w.tapAt(195, 300)
    points(0, 3)
    points(1, 3)
    check()
    w.tick(6000)
    games(0, 12)
    w.tick(6000)
    check()
    w.press(L.end) // won: files it at once
    w.press(L.newGame).tapAt(195, 300)
    games(1, 1)
    w.press(L.end)
    check()
    w.press(L.leave)
    check()
    w.press(L.newGame)
    check()
    w.tick(3100).press(L.history)
    check()
    w.hold(L.winner.replace('{name}', 'WWWWWWWW'))
    check()
    w.tick(3100).press(L.clearLog)
    check()
    assert.deepEqual(tooWide, [])
  })
}
