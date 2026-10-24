// Scoring modes and set formats on the match screen.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  T,
  w,
  team,
  pointText,
  gamesText,
  setTexts,
  hint,
  won,
  saved,
  log,
  tapTeam,
  points,
  games,
  startMatch,
  option,
  openOptions,
} from './helpers.mjs'

test('one light tick per point, two for a side change (unless switched off)', () => {
  w.launch()
  startMatch()
  w.zos.vibes.length = 0
  tapTeam(0)
  assert.equal(w.zos.vibes.length, 1)
  assert.equal(w.zos.vibes[0].length, 1)
  points(0, 3) // game 1:0 → side change
  assert.equal(w.zos.vibes.at(-1).length, 3)
  assert.equal(hint(), T.switchSides)
  w.tick(5200)
  assert.equal(hint(), '')
})

test('"Nur anzeigen": a side change shows the hint but ticks only once', () => {
  w.launch()
  openOptions()
  option(T.optSwitch)
  w.press(T.done)
  startMatch()
  w.zos.vibes.length = 0
  games(0, 1)
  assert.equal(hint(), T.switchSides)
  assert.ok(w.zos.vibes.every((v) => v.length === 1))
})

test('advantage: Einstand, AD, back to Einstand, then the game', () => {
  w.launch()
  startMatch()
  points(0, 3)
  points(1, 3)
  w.tick(6000)
  assert.equal(hint(), T.deuce)
  tapTeam(0)
  assert.deepEqual([pointText(0), pointText(1)], ['AD', '40'])
  assert.equal(hint(), '')
  tapTeam(1)
  assert.equal(hint(), T.deuce)
  tapTeam(1)
  assert.deepEqual([pointText(0), pointText(1)], ['40', 'AD'])
  tapTeam(1)
  assert.equal(gamesText(1), '1')
})

test('golden point: one point decides at 40:40, the receivers choose the side', () => {
  w.launch()
  openOptions()
  option(T.optMode)
  assert.ok(w.has(T.golden))
  w.press(T.done)
  startMatch(0)
  points(0, 3)
  points(1, 3)
  assert.equal(hint(), T.golden)
  // the server's (own team's) card: both edge bars lit
  assert.ok(team(0).edges.every((b) => b.w.props.visible && b.w.props.color === 0xd4f53c))
  tapTeam(1)
  assert.deepEqual([gamesText(0), gamesText(1)], ['0', '1'])
})

test('star point: Einstand 1/3, 2/3, then the star point decides', () => {
  w.launch()
  openOptions()
  option(T.optMode, 2)
  assert.ok(w.has(T.star))
  w.press(T.done)
  startMatch()
  points(0, 3)
  points(1, 3)
  assert.equal(hint(), 'Einstand 1/3')
  points(0, 1)
  points(1, 1)
  assert.equal(hint(), 'Einstand 2/3')
  points(0, 1)
  points(1, 1)
  assert.equal(hint(), T.star)
  tapTeam(0)
  assert.equal(gamesText(0), '1')
})

test('6:6 brings a tiebreak with counted points; winning it makes the set 7:6', () => {
  w.launch()
  startMatch()
  for (let i = 0; i < 6; i++) {
    games(0, 1)
    games(1, 1)
  }
  w.tick(6000)
  assert.equal(hint(), T.tiebreak)
  tapTeam(0)
  assert.equal(pointText(0), '1')
  assert.ok(team(0).bars.every((b) => b.w.props.visible === false))
  points(0, 6)
  assert.deepEqual(setTexts(0), ['7'])
  assert.deepEqual(setTexts(1), ['6'])
  assert.deepEqual([gamesText(0), gamesText(1)], ['0', '0'])
})

test('match tiebreak to 10 instead of a 3rd set; the games tile stays 0:0 after it', () => {
  w.launch()
  openOptions()
  option(T.optDecider, 3) // normal → no tiebreak → to 7 → to 10
  assert.ok(w.has(T.deciderMtb))
  w.press(T.done)
  startMatch()
  games(0, 6)
  games(1, 6)
  w.tick(6000)
  assert.equal(hint(), T.matchTiebreak)
  points(0, 10)
  assert.ok(won(0))
  assert.deepEqual([gamesText(0), gamesText(1)], ['0', '0'])
  assert.deepEqual(setTexts(0), ['6', '0', '10'])
})

test('a won match: SIEG, "Match vorbei", no more points, one tap on "Ende" files it', () => {
  w.launch()
  startMatch()
  games(0, 12)
  w.tick(6000) // the side change hint from the game before fades
  assert.ok(won(0))
  assert.equal(won(1), false)
  assert.equal(hint(), T.matchOver)
  assert.deepEqual(setTexts(0), ['6', '6'])
  tapTeam(1)
  assert.equal(saved('match').moves.length, 48)
  w.press(T.end)
  assert.equal(w.url, 'page/start')
  assert.equal(w.has(T.resume), false)
  assert.equal(log().length, 1)
  assert.equal(log()[0].winner, 0)
  assert.equal(log()[0].abandoned, false)
})

test('"1 Satz": the match ends after one set', () => {
  w.launch()
  openOptions()
  option(T.optSets)
  w.press(T.done)
  startMatch()
  games(1, 6)
  assert.ok(won(1))
})
