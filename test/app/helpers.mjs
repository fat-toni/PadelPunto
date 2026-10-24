// Shared helpers for the app tests in this folder: the simulated watch (a fresh one for every
// test) and shortcuts to tap, play and read the screen like a player.
import { beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Watch } from '../mock/watch.mjs'
import { STRINGS } from '../../locales/index.js'

export const T = STRINGS.de
// Points in the 390 px design; on a bigger watch px() gives the screen pixels.
export const CARD_Y = [238, 54] // own team below, opponents on top
// Default team colors: green (own team) and blue, as dark tints on the cards.
export const GREEN_CARD = 0x1c2c26
export const BLUE_CARD = 0x1e2632
export let w

beforeEach(() => {
  w = new Watch()
})
afterEach(() => w.done())

// ---- helpers ----

export const inst = () => w.page.inst
export const team = (t) => inst().teams[t]
export const pointText = (t) => team(t).points.w.props.text
export const gamesText = (t) => team(t).games.w.props.text
export const setTexts = (t) =>
  team(t)
    .sets.filter((c) => c.w.props.visible)
    .map((c) => c.w.props.text)
export const hint = () => (inst().hintW.w.props.visible ? inst().hintW.w.props.text : '')
export const won = (t) => team(t).win.w.props.visible
export const saved = (key) => JSON.parse(w.files.get(`${key}.json`))
export const log = () => (w.files.has('log.json') ? saved('log') : [])

// Taps a team card in the points area, then waits long enough for the next tap to count.
// One point for team t. A banner from a won set is tapped away first (between the cards, so
// the tap hits only the banner), as a player would.
export function tapTeam(t) {
  if (w.page && w.page.inst.bannerOn) {
    w.tapAt(195, 222)
    w.tick(400)
  }
  w.tapAt(60, CARD_Y[t] + 90)
  w.tick(200)
}
export const points = (t, n) => {
  for (let i = 0; i < n; i++) tapTeam(t)
}
export const games = (t, n) => points(t, 4 * n)

// From the start screen to a fresh match; t = first server. Confirms replacing an open match.
export function startMatch(t = 0) {
  w.press(T.newGame)
  if (w.url === 'page/start') w.press(T.endOld)
  assert.equal(w.url, 'page/serve')
  w.tapAt(195, t === 0 ? 300 : 160)
  assert.equal(w.url, 'page/match')
  w.tick(6000) // let any hint from the start fade
}

// Info: the round "i" at the end of the options.
export const INFO = 'i'
export function openInfo(L = T) {
  w.press(L.options).press(INFO)
  assert.equal(w.url, 'page/info')
}

// Info → diagnosis: five quick taps on the logo.
export const LOGO = [195, 150]
export function openDiag(L = T) {
  openInfo(L)
  for (let i = 0; i < 5; i++) w.tapAt(...LOGO)
  assert.equal(w.url, 'page/diag')
}

// Options page: tap the card with this title n times, each time waiting until the page has saved
// the new value (SAVE_MS, page/options.js).
export function option(title, n = 1) {
  for (let i = 0; i < n; i++) {
    w.press(title)
    w.tick(600)
  }
}

// Court time: the clock button left of the logo (y depends on "Weiter" being there).
export function openCourt() {
  w.tapAt(62, w.has(T.resume) ? 97 : 123)
  assert.equal(w.url, 'page/court')
}
// Alarm time (seconds) for h:m today (or days later) on the simulated watch.
export const at = (h, m, days = 0) => {
  const d = new Date(Date.now())
  d.setHours(h, m, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime() / 1000
}
export const courtTime = () =>
  w
    .texts()
    .slice(w.texts().indexOf(T.courtUntilLabel) + 1, w.texts().indexOf(T.courtUntilLabel) + 4)
    .join('')

// Training: the cone button right of the logo.
export function openTraining() {
  w.tapAt(328, w.has(T.resume) ? 97 : 123)
  assert.equal(w.url, 'page/training')
  return w
}

export function openOptions() {
  w.press(T.options)
  assert.equal(w.url, 'page/options')
}

// A finished 6:0 6:0 match for team t, ended with "Ende" (one tap once someone has won).
export function playWonMatch(t = 0) {
  startMatch()
  games(t, 12)
  w.press(T.end)
  assert.equal(w.url, 'page/start')
}

// A new watch in the middle of a test (e.g. one per language code), the old one checked first.
export function freshWatch() {
  w.done()
  w = new Watch()
  return w
}
