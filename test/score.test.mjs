// Run with: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  newMatch,
  addPoint,
  pointLabels,
  pointSteps,
  currentServer,
  setsText,
  deuceInfo,
  serveSide,
  summary,
  hasStarted,
  replay,
  spokenWords,
} from '../utils/score.js'

const cfg = (o = {}) => ({ mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0, ...o })

function play(s, seq) {
  let events = []
  for (const ch of seq) ({ state: s, events } = addPoint(s, ch === 'a' ? 0 : 1))
  return { s, events }
}
const game = (t) => (t === 0 ? 'aaaa' : 'bbbb')

test('normal game and labels', () => {
  let { s } = play(newMatch(cfg(), 0), 'aab')
  assert.deepEqual(pointLabels(s), ['30', '15'])
  ;({ s } = play(s, 'a'))
  assert.deepEqual(pointLabels(s), ['40', '15'])
  ;({ s } = play(s, 'a'))
  assert.deepEqual(s.games, [1, 0])
  assert.equal(s.server, 1)
})

test('advantage', () => {
  let { s } = play(newMatch(cfg(), 0), 'aaabbb')
  assert.deepEqual(pointLabels(s), ['40', '40'])
  ;({ s } = play(s, 'b'))
  assert.deepEqual(pointLabels(s), ['40', 'AD'])
  ;({ s } = play(s, 'aa'))
  assert.deepEqual(pointLabels(s), ['AD', '40'])
  assert.deepEqual(pointSteps(s), [4, 3])
  ;({ s } = play(s, 'a'))
  assert.deepEqual(s.games, [1, 0])
})

test('golden point', () => {
  const { s } = play(newMatch(cfg({ mode: 'golden' }), 0), 'aaabbbb')
  assert.deepEqual(s.games, [0, 1])
})

test('star point after third deuce', () => {
  let { s } = play(newMatch(cfg({ mode: 'star' }), 0), 'aaabbb') // deuce 1
  assert.deepEqual(deuceInfo(s), { key: 'deuceN', n: 1 })
  ;({ s } = play(s, 'ab')) // deuce 2
  ;({ s } = play(s, 'ba')) // deuce 3
  assert.deepEqual(deuceInfo(s), { key: 'star' })
  ;({ s } = play(s, 'b'))
  assert.deepEqual(s.games, [0, 1])
})

test('side change after odd games', () => {
  let r = play(newMatch(cfg(), 0), game(0))
  assert.ok(r.events.includes('switch'))
  r = play(r.s, game(1))
  assert.ok(!r.events.includes('switch'))
})

test('set 7:5, tiebreak at 6:6, match', () => {
  let s = newMatch(cfg(), 0)
  for (let i = 0; i < 5; i++) s = play(s, game(0) + game(1)).s
  s = play(s, game(0) + game(0)).s
  assert.equal(setsText(s), '7:5')
  for (let i = 0; i < 6; i++) s = play(s, game(0) + game(1)).s
  assert.ok(s.tb)
  const first = s.tbFirstServer
  assert.equal(currentServer(s), first)
  s = play(s, 'a').s
  assert.equal(currentServer(s), 1 - first)
  s = play(s, 'a').s
  assert.equal(currentServer(s), 1 - first)
  s = play(s, 'a').s
  assert.equal(currentServer(s), first)
  const r = play(s, 'aaaa')
  assert.ok(r.events.includes('match'))
  assert.equal(r.s.winner, 0)
  assert.equal(setsText(r.s), '7:5  7:6')
  assert.equal(r.s.server, 1 - first)
})

test('match tiebreak as third set', () => {
  let s = newMatch(cfg({ decider: 'mtb' }), 0)
  for (let i = 0; i < 6; i++) s = play(s, game(0)).s
  for (let i = 0; i < 6; i++) s = play(s, game(1)).s
  assert.ok(s.tb)
  assert.equal(s.tbTarget, 10)
  s = play(s, 'aaaaaaaaabbbbbbbbb').s // 9:9
  assert.equal(s.winner, null)
  const r = play(s, 'bb')
  assert.equal(r.s.winner, 1)
  assert.equal(setsText(r.s), '6:0  0:6  [9:11]')
})

test('best of 1', () => {
  let s = newMatch(cfg({ bestOf: 1 }), 0)
  for (let i = 0; i < 6; i++) s = play(s, game(1)).s
  assert.equal(s.winner, 1)
  assert.equal(addPoint(s, 0).state, s)
})

test('serve side alternates and receivers choose at golden point', () => {
  let { s } = play(newMatch(cfg({ mode: 'golden' }), 0), '')
  assert.equal(serveSide(s), 'right')
  ;({ s } = play(s, 'a'))
  assert.equal(serveSide(s), 'left')
  ;({ s } = play(s, 'aabb'))
  assert.equal(serveSide(s), 'left')
  ;({ s } = play(s, 'b'))
  assert.equal(serveSide(s), 'choice')
})

test('serve side with advantage and star point', () => {
  let { s } = play(newMatch(cfg(), 0), 'aaabbb')
  assert.equal(serveSide(s), 'right')
  ;({ s } = play(s, 'a'))
  assert.equal(serveSide(s), 'left')
  ;({ s } = play(newMatch(cfg({ mode: 'star' }), 0), 'aaabbbabba'))
  assert.equal(serveSide(s), 'choice')
})

test('summary of an abandoned match keeps the running set', () => {
  let s = newMatch(cfg(), 1000)
  assert.equal(hasStarted(s), false)
  ;({ s } = play(s, game(0).repeat(6) + game(1).repeat(2) + 'a'))
  assert.equal(hasStarted(s), true)
  const e = summary(s, 5000)
  assert.equal(e.abandoned, true)
  assert.equal(e.endedAt, 5000)
  assert.equal(setsText(e), '6:0  0:2')
})

test('summary of an abandoned match tiebreak', () => {
  let s = newMatch(cfg({ decider: 'mtb' }), 0)
  ;({ s } = play(s, game(0).repeat(6) + game(1).repeat(6) + 'aab'))
  assert.equal(setsText(summary(s, 0)), '6:0  0:6  [2:1]')
})

test('summary of a finished match', () => {
  let s = newMatch(cfg({ bestOf: 1 }), 0)
  ;({ s } = play(s, game(1).repeat(6)))
  const e = summary(s, 0)
  assert.equal(e.abandoned, false)
  assert.equal(e.winner, 1)
  assert.equal(setsText(e), '0:6')
})

test('replay rebuilds the same state as playing point by point', () => {
  const moves = [...(game(0).repeat(5) + game(1).repeat(5) + 'aaabbbab')].map((c) => (c === 'a' ? 0 : 1))
  const c = cfg({ mode: 'star', decider: 'mtb' })
  let s = newMatch(c, 42)
  for (const t of moves) s = addPoint(s, t).state
  assert.deepEqual(replay(c, 42, moves), s)
  assert.deepEqual(replay(c, 42, []), newMatch(c, 42))
})

test('addPoint never changes the state it was given', () => {
  // Points through games, sets and a tiebreak; each earlier state must stay as it was.
  let s = newMatch(cfg({ decider: 'mtb' }), 0)
  const seq = game(0).repeat(6) + (game(0) + game(1)).repeat(6) + 'abab'
  for (const ch of seq) {
    const before = JSON.stringify(s)
    const next = addPoint(s, ch === 'a' ? 0 : 1).state
    assert.equal(JSON.stringify(s), before)
    s = next
  }
})

test('normal third set is played out like the others', () => {
  let s = newMatch(cfg(), 0)
  ;({ s } = play(s, game(0).repeat(6) + game(1).repeat(6)))
  assert.equal(s.tb, false)
  assert.deepEqual(s.games, [0, 0])
  const r = play(s, game(1).repeat(6))
  assert.equal(r.s.winner, 1)
  assert.equal(setsText(r.s), '6:0  0:6  0:6')
})

// Plays games ('a'/'b' per game) and returns after which game totals of the set the ends changed.
function switchesIn(sides, gamesSeq) {
  let s = newMatch(cfg({ sides }), 0)
  const at = []
  for (const g of gamesSeq) {
    const r = play(s, game(g === 'a' ? 0 : 1))
    s = r.s
    if (r.events.includes('switch')) at.push(r.events.includes('set') ? 'set' : s.games[0] + s.games[1])
  }
  return at
}

test('change of ends: FIP after games 1, 3, 5 …; leisure only after the set, or never', () => {
  const sixFour = 'ababababaa' // 6:4, then the first game of the next set
  assert.deepEqual(switchesIn('fip', sixFour + 'a'), [1, 3, 5, 7, 9, 1])
  assert.deepEqual(switchesIn(undefined, sixFour + 'a'), [1, 3, 5, 7, 9, 1], 'older matches: FIP')
  assert.deepEqual(switchesIn('set', sixFour + 'a'), ['set'])
  assert.deepEqual(switchesIn('never', sixFour + 'a'), [])
  assert.deepEqual(switchesIn('set', 'aaaaaa' + 'aaaaaa'), ['set'], 'not after the last set of the match')
})

test('leisure variants: no change of ends inside a tiebreak', () => {
  for (const sides of ['set', 'never']) {
    let s = newMatch(cfg({ sides }), 0)
    for (let i = 0; i < 6; i++) s = play(s, game(0) + game(1)).s
    assert.ok(s.tb)
    let any = false
    for (const ch of 'abababababab') {
      const x = play(s, ch)
      s = x.s
      any = any || x.events.includes('switch')
    }
    assert.equal(any, false, sides)
  }
})

test('side change every 6 points in a tiebreak', () => {
  let s = newMatch(cfg(), 0)
  for (let i = 0; i < 6; i++) s = play(s, game(0) + game(1)).s
  assert.ok(s.tb)
  const switches = []
  for (const ch of 'abababababab') {
    const r = play(s, ch)
    s = r.s
    if (r.events.includes('switch')) switches.push(s.points[0] + s.points[1])
  }
  assert.deepEqual(switches, [6, 12])
})

test('undo over the end of a set and of the match', () => {
  const c = cfg({ bestOf: 1 })
  const moves = [...game(0).repeat(6)].map(() => 0)
  const done = replay(c, 0, moves)
  assert.equal(done.winner, 0)
  const undone = replay(c, 0, moves.slice(0, -1))
  assert.equal(undone.winner, null)
  assert.deepEqual(undone.games, [5, 0])
  assert.deepEqual(pointLabels(undone), ['40', '0'])
  const c3 = cfg()
  const m3 = [...game(0).repeat(6)].map(() => 0)
  assert.equal(replay(c3, 0, m3).sets.length, 1)
  const back = replay(c3, 0, m3.slice(0, -1))
  assert.equal(back.sets.length, 0)
  assert.deepEqual(back.games, [5, 0])
})

test('summary of a match abandoned in a normal tiebreak keeps the tiebreak points', () => {
  let s = newMatch(cfg(), 0)
  ;({ s } = play(s, (game(0) + game(1)).repeat(6) + 'aaaabb'))
  assert.ok(s.tb)
  assert.equal(setsText(summary(s, 1)), '6:6(4:2)')
})

// Points for team 0/1 given as numbers, returning only the new state.
const pts = (s, seq) => seq.reduce((st, t) => addPoint(st, t).state, s)

test('announcement: server first, "all" when equal, deuce/advantage, tiebreak numbers', () => {
  let s = newMatch(cfg(), 0) // team 0 serves
  assert.deepEqual(spokenWords(s), [], 'nothing at 0:0')
  s = pts(s, [1])
  assert.deepEqual(spokenWords(s), ['p0', 'p15'])
  s = pts(s, [0])
  assert.deepEqual(spokenWords(s), ['p15', 'all'])
  s = pts(s, [0, 0])
  assert.deepEqual(spokenWords(s), ['p40', 'p15'])
  s = pts(s, [1, 1])
  assert.deepEqual(spokenWords(s), ['deuce'])
  s = pts(s, [1])
  assert.deepEqual(spokenWords(s), ['advOut'], 'advantage for the receiving team')
  s = pts(s, [1]) // game to team 1, team 1 serves now
  assert.deepEqual(spokenWords(s), [])
  s = pts(s, [1])
  assert.deepEqual(spokenWords(s), ['p15', 'p0'], 'the new server is said first')
  s = pts(s, [1, 1, 0, 0, 0, 0])
  assert.deepEqual(spokenWords(s), ['advOut'])
  s = pts(s, [1])
  assert.deepEqual(spokenWords(s), ['deuce'])
  s = pts(s, [1])
  assert.deepEqual(spokenWords(s), ['advIn'])
})

test('announcement: golden point, star point and the match tiebreak', () => {
  let g = pts(newMatch(cfg({ mode: 'golden' }), 0), [0, 0, 0, 1, 1, 1])
  assert.deepEqual(spokenWords(g), ['golden'])
  let st = pts(newMatch(cfg({ mode: 'star' }), 0), [0, 0, 0, 1, 1, 1])
  assert.deepEqual(spokenWords(st), ['deuce'])
  st = pts(st, [0, 1, 0, 1])
  assert.deepEqual(spokenWords(st), ['star'])
  // A set tiebreak at 6:6 (games won alternately), numbers said from the server's side.
  let tb = newMatch(cfg(), 0)
  for (let i = 0; i < 12; i++) tb = pts(tb, Array(4).fill(i % 2))
  assert.ok(tb.tb)
  const said = (st) => {
    const srv = currentServer(st)
    const [a, b] = [st.points[srv], st.points[1 - srv]]
    return a === b ? [`n${a}`, 'all'] : [`n${a}`, `n${b}`]
  }
  for (const t of [0, 1, 1, 0, 0, 1]) {
    tb = pts(tb, [t])
    assert.deepEqual(spokenWords(tb), said(tb))
  }
  for (let i = 0; i < 17; i++) tb = pts(tb, [0, 1]) // 20:20
  assert.deepEqual(spokenWords(tb), ['n20', 'all'])
  tb = pts(tb, [0])
  assert.deepEqual(spokenWords(tb), [], 'above 20 there is no word')
  for (let i = 0; i < 6; i++) tb = pts(tb, [0, 0, 0, 0, 0, 0, 0])
  assert.deepEqual(spokenWords(tb), [], 'nothing once the match is won')
})
