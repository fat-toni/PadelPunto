// Training rules (utils/training.js), played through utils/score.js. Run with: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { newMatch, addPoint, pointLabels, currentServer, setsText, deuceInfo, summary, replay } from '../utils/score.js'
import { pointsToWin, matchBalls, americanoInfo, trainingProgress, TRAIN_CAP } from '../utils/training.js'

const cfg = (o = {}) => ({ mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0, ...o })

function play(s, seq) {
  let events = []
  for (const ch of seq) ({ state: s, events } = addPoint(s, ch === 'a' ? 0 : 1))
  return { s, events }
}

// The server in a training after each of the first points: who serves the 1st, 2nd … point.
const servers = (s, seq) => [...seq].map((ch) => ((s = addPoint(s, ch === 'a' ? 0 : 1).state), currentServer(s)))

test('training to 11: only points, a lead of two, the serve changes every 2 points, no change of ends', () => {
  let s = newMatch(cfg({ target: 11, bestOf: 3, mode: 'golden', firstServer: 1 }), 0)
  assert.ok(s.tb && s.mtb)
  assert.equal(s.cfg.bestOf, 1)
  assert.equal(currentServer(s), 1)
  assert.deepEqual(servers(s, 'aaaaaa'), [1, 0, 0, 1, 1, 0])
  let r = play(s, 'aaaaaaaaaabbbbbbbbbb') // 10:10, no winner yet, no 'switch' ever
  assert.equal(r.s.winner, null)
  assert.deepEqual(pointLabels(r.s), ['10', '10'])
  assert.equal(deuceInfo(r.s), null)
  assert.ok(!r.events.includes('switch'))
  assert.equal(pointsToWin(r.s, 0), 2, 'at 10:10 only 12 wins')
  assert.equal(play(r.s, 'a').s.winner, null)
  r = play(r.s, 'aa')
  assert.equal(r.s.winner, 0)
  assert.ok(r.events.includes('match'))
  assert.equal(setsText(r.s), '[12:10]')
  assert.deepEqual(r.s.games, [0, 0])
  assert.equal(summary(r.s, 0).target, 11)
  // undo rebuilds the training from its points
  const moves = [...Array(10).fill(0), ...Array(10).fill(1), 0]
  assert.deepEqual(replay(s.cfg, 0, moves).points, [11, 10])
})

test('training: the cap ends a long one, whoever is ahead wins (11 → 15, 21 → 25)', () => {
  assert.deepEqual(TRAIN_CAP, { 7: 9, 11: 15, 15: 19, 21: 25 })
  const s = newMatch(cfg({ target: 11 }), 0)
  let r = play(s, 'ab'.repeat(14)) // 14:14
  assert.equal(r.s.winner, null)
  assert.deepEqual([pointsToWin(r.s, 0), pointsToWin(r.s, 1)], [1, 1])
  assert.deepEqual(matchBalls(r.s), [0, 1])
  r = play(r.s, 'b')
  assert.equal(r.s.winner, 1)
  assert.equal(setsText(r.s), '[14:15]')
  const t21 = play(newMatch(cfg({ target: 21 }), 0), 'ab'.repeat(24) + 'a').s
  assert.equal(t21.winner, 0)
  assert.equal(setsText(t21), '[25:24]')
})

test('training to 21: won with 21:15 at once; points still needed and match points', () => {
  const s = newMatch(cfg({ target: 21 }), 0)
  const r = play(s, 'b'.repeat(15) + 'a'.repeat(20)) // 20:15
  assert.deepEqual([pointsToWin(r.s, 0), pointsToWin(r.s, 1)], [1, 7], '15 needs 22, as 20 stands')
  assert.deepEqual(matchBalls(r.s), [0])
  assert.equal(trainingProgress(r.s, 0), 20 / 21)
  const { s: end } = play(r.s, 'a')
  assert.equal(end.winner, 0)
  assert.equal(setsText(end), '[21:15]')
  assert.deepEqual(matchBalls(end), [])
  assert.deepEqual(matchBalls(play(s, 'ab'.repeat(20)).s), [], '20:20 is no match point')
  assert.equal(summary(newMatch(cfg(), 0), 0).target, undefined)
})

test('Americano: a fixed number of points, the serve in turns of 4 (or 2), it can end level', () => {
  const s = newMatch(cfg({ total: 16, serveEvery: 4, firstServer: 1 }), 0)
  assert.equal(currentServer(s), 1)
  assert.deepEqual(americanoInfo(s), { left: 16, serves: 4, next: 4 })
  assert.deepEqual(servers(s, 'aaaaaaaa'), [1, 1, 1, 0, 0, 0, 0, 1])
  let r = play(s, 'abb') // 1:2, team 1 serves once more, then team 0 four times
  assert.deepEqual(americanoInfo(r.s), { left: 13, serves: 1, next: 4 })
  r = play(s, 'ab'.repeat(7)) // 7:7, two points left, both by team 0 (its turn ends early)
  assert.deepEqual(americanoInfo(r.s), { left: 2, serves: 2, next: 0 })
  assert.deepEqual(matchBalls(r.s), [], 'no match points in an Americano')
  assert.equal(trainingProgress(r.s, 0), 7 / 16)
  const level = play(r.s, 'ab')
  assert.equal(level.s.winner, -1)
  assert.ok(level.events.includes('match') && level.events.includes('draw'))
  assert.equal(setsText(level.s), '[8:8]')
  const sum = summary(level.s, 0)
  assert.equal(sum.total, 16)
  assert.equal(sum.abandoned, false)
  // the last point does not decide it: 9:7 is a win for team 0 even if team 1 scored last
  const won = play(r.s, 'aa').s
  assert.equal(won.winner, 0)
  const lead = play(play(s, 'a'.repeat(9) + 'b'.repeat(6)).s, 'b').s
  assert.equal(lead.winner, 0)
  assert.equal(setsText(lead), '[9:7]')
  assert.deepEqual(servers(newMatch(cfg({ total: 16, serveEvery: 2 }), 0), 'aaaaa'), [0, 1, 1, 0, 0])
})
