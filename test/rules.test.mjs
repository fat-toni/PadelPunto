// Rule check: utils/score.js against an independent reference model of the padel rules,
// point by point, over thousands of random matches in every configuration.
//
// The reference model below is written separately from score.js on purpose (raw point counts
// instead of deuce folding, serve from a running count of games instead of toggling), so a
// mistake would have to be made twice, in two different ways, to go unnoticed.
//
// Rules modelled (FIP rules, Star Point as introduced for 2026):
// - Game: 15/30/40, then a lead of two. Golden point: at 40:40 the next point decides.
//   Star point: advantage is played twice; at the third 40:40 the next point decides.
// - Set: 6 games with a lead of two, 7:5 possible; at 6:6 a tiebreak to 7 with a lead of two,
//   the set then counts 7:6. Short sets (FIP alternative scoring 1a): the same with 4 games,
//   tiebreak at 4:4, the set then counts 5:4.
// - Match: 1 set, or best of 3; the third set normal, as an advantage set (no tiebreak at 6:6,
//   played on until a lead of two games, FIP rule 1.4), or replaced by a match tiebreak to 7 or
//   to 10 (lead of two, FIP alternative scoring 1b).
// - Serve: alternates every game, across sets. In a tiebreak the first server serves one
//   point, then each team two in turn (A, BB, AA, …); the tiebreak counts as one game for the
//   order, so the team that received first in it serves the next set.
// - Serve side: from the right (deuce side) after an even number of points in the game or
//   tiebreak, otherwise from the left; at a deciding golden or star point the receivers choose.
// - Change of ends: after games 1, 3, 5, … of a set; at the end of a set only if its game total
//   is odd; in a tiebreak every 6 points; never after the last point of the match.
//   Leisure variants (cfg.sides): 'set' changes only at the end of every set, 'never' not at all.
//
// SCORE_MODULE=/path/to/score.js runs the same checks against another copy (mutation test).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'

const E = await import(process.env.SCORE_MODULE ? pathToFileURL(process.env.SCORE_MODULE).href : '../utils/score.js')

// ---------- reference model ----------

function refNew(cfg) {
  return { cfg, sets: [], g: [0, 0], p: [0, 0], deuces: 0, tb: 0, mtb: false, games: 0, winner: null }
}

// Server of the n-th game of the match (tiebreaks count as one game).
const gameServer = (r, n) => (n % 2 === 0 ? r.cfg.firstServer : 1 - r.cfg.firstServer)

function refServer(r) {
  const first = gameServer(r, r.games)
  if (!r.tb) return first
  const n = r.p[0] + r.p[1]
  return Math.floor((n + 1) / 2) % 2 === 0 ? first : 1 - first
}

function decidingPoint(r) {
  const [a, b] = r.p
  if (r.tb || a !== b || a < 3) return false
  return r.cfg.mode === 'golden' || (r.cfg.mode === 'star' && r.deuces >= 3)
}

const fip = (r) => (r.cfg.sides || 'fip') === 'fip'

// Plays one point; returns { switch, match } like the events of addPoint.
function refPoint(r, t) {
  const ev = { switch: false, match: false }
  if (r.winner !== null) return ev
  const o = 1 - t
  const decides = decidingPoint(r)
  r.p[t]++
  const me = r.p[t]
  const them = r.p[o]

  let gameOver
  if (r.tb) {
    gameOver = me >= r.tb && me - them >= 2
    if (!gameOver && fip(r) && (me + them) % 6 === 0) ev.switch = true
  } else {
    gameOver = decides || (me >= 4 && me - them >= 2)
    if (!gameOver && me === them && me >= 3) r.deuces++
  }
  if (!gameOver) return ev

  const tbScore = r.tb ? [r.p[0], r.p[1]] : null
  const wasTb = r.tb
  const wasMtb = r.mtb
  r.games++
  r.p = [0, 0]
  r.deuces = 0
  r.tb = 0
  r.mtb = false
  const setsSoFar = [0, 0]
  for (const set of r.sets) setsSoFar[set.g[0] > set.g[1] ? 0 : 1]++
  const third = r.cfg.bestOf === 3 && setsSoFar[0] === 1 && setsSoFar[1] === 1

  if (wasMtb) {
    r.sets.push({ g: [t === 0 ? 1 : 0, t === 1 ? 1 : 0], tb: tbScore, mtb: true })
  } else {
    r.g[t]++
    const n = r.cfg.games === 4 ? 4 : 6
    const won = (r.g[t] >= n && r.g[t] - r.g[o] >= 2) || wasTb === 7
    if (!won) {
      if (r.g[0] === n && r.g[1] === n && !(third && r.cfg.decider === 'noTb')) r.tb = 7
      if (fip(r) && (r.g[0] + r.g[1]) % 2 === 1) ev.switch = true
      return ev
    }
    r.sets.push({ g: [...r.g], tb: tbScore, mtb: false })
  }

  const won = [0, 0]
  for (const set of r.sets) won[set.g[0] > set.g[1] ? 0 : 1]++
  const needed = r.cfg.bestOf === 1 ? 1 : 2
  if (won[t] === needed) {
    r.winner = t
    ev.match = true
    return ev
  }
  const last = r.sets[r.sets.length - 1]
  if (r.cfg.sides === 'set' || (fip(r) && !last.mtb && (last.g[0] + last.g[1]) % 2 === 1)) ev.switch = true
  r.g = [0, 0]
  if (won[0] === 1 && won[1] === 1 && (r.cfg.decider === 'mtb' || r.cfg.decider === 'mtb7')) {
    r.tb = r.cfg.decider === 'mtb' ? 10 : 7
    r.mtb = true
  }
  return ev
}

function refLabels(r) {
  const [a, b] = r.p
  if (r.tb) return [String(a), String(b)]
  if (a >= 3 && b >= 3) return a === b ? ['40', '40'] : a > b ? ['AD', '40'] : ['40', 'AD']
  const n = ['0', '15', '30', '40']
  return [n[a], n[b]]
}

function refSteps(r) {
  const [a, b] = r.p
  if (r.tb) return null
  if (a >= 3 && b >= 3) return [a > b ? 4 : 3, b > a ? 4 : 3]
  return [a, b]
}

function refSide(r) {
  if (r.winner !== null) return null
  if (decidingPoint(r)) return 'choice'
  return (r.p[0] + r.p[1]) % 2 === 0 ? 'right' : 'left'
}

function refDeuce(r) {
  const [a, b] = r.p
  if (r.tb || r.winner !== null || a !== b || a < 3) return null
  if (r.cfg.mode === 'golden') return { key: 'golden' }
  if (r.cfg.mode === 'star') return r.deuces >= 3 ? { key: 'star' } : { key: 'deuceN', n: r.deuces }
  return { key: 'deuce' }
}

const refSetsText = (r) => r.sets.map((s) => (s.mtb ? `[${s.tb[0]}:${s.tb[1]}]` : `${s.g[0]}:${s.g[1]}`)).join('  ')

// ---------- random matches ----------

// Small seeded generator, so a failure can be repeated exactly.
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let x = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const CONFIGS = []
for (const mode of ['adv', 'golden', 'star'])
  for (const bestOf of [1, 3])
    for (const decider of ['set', 'noTb', 'mtb7', 'mtb'])
      for (const firstServer of [0, 1])
        for (const sides of ['fip', 'set', 'never'])
          for (const games of [6, 4]) CONFIGS.push({ mode, bestOf, decider, firstServer, sides, games })

const MATCHES_PER_CONFIG = 100
const tally = {
  matches: 0,
  points: 0,
  tiebreaks: 0,
  matchTiebreaks: 0,
  matchTiebreaks7: 0,
  advantageSets: 0,
  shortSetTiebreaks: 0,
  starPoints: 0,
  goldenPoints: 0,
  longDeuce: 0,
}

// Compares the engine with the model after every point and returns the moves and states.
function checkMatch(cfg, rand) {
  // Close, even matches give many deuces and tiebreaks; now and then a one-sided one.
  const bias = rand() < 0.8 ? 0.45 + rand() * 0.1 : rand()
  let s = E.newMatch(cfg, 0)
  const r = refNew(cfg)
  const moves = []
  const states = [s]
  const where = () => `${JSON.stringify(cfg)} nach ${moves.length} Punkten: ${moves.join('')}`
  let guard = 0
  while (r.winner === null) {
    assert.ok(guard++ < 5000, 'match ends')
    if (decidingPoint(r)) tally[cfg.mode === 'star' ? 'starPoints' : 'goldenPoints']++
    if (!r.tb && r.deuces >= 4) tally.longDeuce++
    const t = rand() < bias ? 0 : 1
    const { state, events } = E.addPoint(s, t)
    const ev = refPoint(r, t)
    s = state
    moves.push(t)
    states.push(s)
    tally.points++
    const fresh = r.p[0] + r.p[1] === 0
    if (fresh && r.tb && !r.mtb) tally.tiebreaks++
    if (fresh && r.tb && !r.mtb && cfg.games === 4) tally.shortSetTiebreaks++
    if (fresh && r.mtb) tally[r.tb === 10 ? 'matchTiebreaks' : 'matchTiebreaks7']++
    // a deciding advantage set that went past 7:5 (8:6, 9:7 …; 5:3 → 6:4 … in short sets),
    // counted when it ends
    const last = r.sets[r.sets.length - 1]
    const beyond = cfg.games === 4 ? 9 : 13
    if (ev.match && cfg.decider === 'noTb' && r.sets.length === 3 && last.g[0] + last.g[1] > beyond)
      tally.advantageSets++

    assert.equal(events.includes('switch'), ev.switch, `Seitenwechsel, ${where()}`)
    assert.equal(events.includes('match'), ev.match, `Matchende, ${where()}`)
    assert.equal(s.winner, r.winner, `Sieger, ${where()}`)
    assert.equal(E.setsText(s), refSetsText(r), `Sätze, ${where()}`)
    assert.deepEqual(s.games, r.g, `Spiele, ${where()}`)
    assert.equal(s.tb, r.tb > 0, `Tiebreak, ${where()}`)
    if (r.tb) assert.equal(s.tbTarget, r.tb, `Tiebreak-Ziel, ${where()}`)
    assert.equal(s.mtb, r.mtb, `Match-Tiebreak, ${where()}`)
    assert.deepEqual(E.pointLabels(s), refLabels(r), `Punktanzeige, ${where()}`)
    assert.deepEqual(E.pointSteps(s), refSteps(r), `Balken, ${where()}`)
    assert.deepEqual(E.deuceInfo(s), refDeuce(r), `Einstand-Hinweis, ${where()}`)
    assert.equal(E.serveSide(s), refSide(r), `Aufschlagseite, ${where()}`)
    if (r.winner === null) assert.equal(E.currentServer(s), refServer(r), `Aufschläger, ${where()}`)
  }
  tally.matches++
  return { s, moves, states }
}

test(`every point of ${CONFIGS.length * MATCHES_PER_CONFIG} random matches follows the rules`, () => {
  const rand = rng(20261015)
  for (const cfg of CONFIGS) for (let i = 0; i < MATCHES_PER_CONFIG; i++) checkMatch(cfg, rand)
  // The random matches must really reach the rare situations, otherwise they prove little.
  assert.ok(tally.tiebreaks > 500, `Tiebreaks: ${tally.tiebreaks}`)
  assert.ok(tally.matchTiebreaks > 500, `Match-Tiebreaks: ${tally.matchTiebreaks}`)
  assert.ok(tally.matchTiebreaks7 > 500, `Match-Tiebreaks bis 7: ${tally.matchTiebreaks7}`)
  assert.ok(tally.advantageSets > 50, `Vorteilssätze über 7:5: ${tally.advantageSets}`)
  assert.ok(tally.shortSetTiebreaks > 500, `Tiebreaks bei 4:4: ${tally.shortSetTiebreaks}`)
  assert.ok(tally.starPoints > 1000, `Star Points: ${tally.starPoints}`)
  assert.ok(tally.goldenPoints > 1000, `Golden Points: ${tally.goldenPoints}`)
  assert.ok(tally.longDeuce > 100, `lange Einstände: ${tally.longDeuce}`)
  console.log('Regel-Test:', JSON.stringify(tally))
})

test('undo at any point gives exactly the earlier state, and a won match takes no more points', () => {
  const rand = rng(7)
  for (const cfg of CONFIGS) {
    for (let i = 0; i < 20; i++) {
      const { s, moves, states } = checkMatch(cfg, rand)
      assert.deepEqual(E.replay(cfg, 0, moves), s)
      for (let k = 0; k < 5; k++) {
        const n = Math.floor(rand() * moves.length)
        assert.deepEqual(E.replay(cfg, 0, moves.slice(0, n)), states[n], `Rückgängig bis Punkt ${n}`)
      }
      for (const t of [0, 1]) {
        const r = E.addPoint(s, t)
        assert.equal(r.state, s)
        assert.deepEqual(r.events, [])
      }
      const e = E.summary(s, 1)
      assert.equal(e.abandoned, false)
      assert.equal(e.winner, s.winner)
      assert.equal(E.setsText(e), E.setsText(s))
    }
  }
})

test('an abandoned match keeps the running set in the history', () => {
  const rand = rng(99)
  for (const cfg of CONFIGS) {
    for (let i = 0; i < 20; i++) {
      const { moves } = checkMatch(cfg, rand)
      const n = 1 + Math.floor(rand() * (moves.length - 1))
      const s = E.replay(cfg, 0, moves.slice(0, n))
      const e = E.summary(s, 1)
      assert.equal(e.abandoned, true)
      const running = s.games[0] + s.games[1] + s.points[0] + s.points[1] > 0
      assert.equal(e.sets.length, s.sets.length + (running ? 1 : 0), `${JSON.stringify(cfg)} bei ${n}`)
    }
  }
})

// ---------- fixed examples from the rules ----------

const play = (cfg, seq) => {
  let s = E.newMatch({ mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0, ...cfg }, 0)
  for (const ch of seq) s = E.addPoint(s, ch === 'a' ? 0 : 1).state
  return s
}
const G = (w) => (w === 'a' ? 'aaaa' : 'bbbb')
const games = (pattern) => [...pattern].map(G).join('')

test('rule examples: game', () => {
  assert.deepEqual(play({}, 'aaab').games, [0, 0], '40:15 is not a game yet')
  assert.deepEqual(play({}, 'aaabbba').games, [0, 0], 'advantage is not a game')
  assert.deepEqual(play({}, 'aaabbbaa').games, [1, 0], 'advantage plus a point wins')
  assert.deepEqual(play({}, 'aaabbb' + 'ab'.repeat(20)).games, [0, 0], 'deuce can go on forever')
  assert.deepEqual(play({ mode: 'golden' }, 'aaabbbb').games, [0, 1], 'golden point decides at once')
  assert.deepEqual(play({ mode: 'star' }, 'aaabbbab' + 'b').games, [0, 0], 'star: 2nd deuce, advantage only')
  assert.deepEqual(play({ mode: 'star' }, 'aaabbbabba' + 'b').games, [0, 1], 'star: 3rd deuce decides')
})

test('rule examples: set and tiebreak', () => {
  assert.equal(play({}, games('aaaaabbbbb') + G('a')).sets.length, 0, '6:5 is not a set')
  assert.equal(E.setsText(play({}, games('aaaaabbbbb') + games('aa'))), '7:5')
  const at66 = games('ab'.repeat(6))
  assert.ok(play({}, at66).tb, '6:6 starts the tiebreak')
  assert.equal(play({}, at66 + 'aaaaaab').sets.length, 0, '6:1 in the tiebreak is not enough')
  assert.equal(play({}, at66 + 'aaaaaabbbbb').sets.length, 0, '6:5 in the tiebreak is not enough')
  assert.equal(E.setsText(play({}, at66 + 'aaaaaabbbbbaa')), '7:6', '8:6 wins the tiebreak, set counts 7:6')
  assert.equal(E.setsText(play({}, at66 + 'aaaaaaa')), '7:6', '7:0 wins the tiebreak')
})

test('rule examples: match', () => {
  assert.equal(play({ bestOf: 1 }, games('aaaaaa')).winner, 0, 'one set')
  assert.equal(play({}, games('aaaaaa')).winner, null, 'best of 3 needs two sets')
  const oneAll = games('aaaaaa') + games('bbbbbb')
  assert.equal(play({ decider: 'set' }, oneAll).tb, false, 'third set is a normal set')
  assert.equal(play({ decider: 'mtb' }, oneAll).tbTarget, 10, 'or a match tiebreak to 10')
  assert.equal(
    play({ decider: 'mtb' }, oneAll + 'a'.repeat(9) + 'b'.repeat(9) + 'a').winner,
    null,
    '10:9 is not enough',
  )
  assert.equal(play({ decider: 'mtb' }, oneAll + 'a'.repeat(9) + 'b'.repeat(9) + 'aa').winner, 0, '11:9 wins')
  assert.equal(play({ bestOf: 1, decider: 'mtb' }, games('aaaaaa')).winner, 0, 'no match tiebreak with one set')
})

test('rule examples: third set without tiebreak (advantage set)', () => {
  const oneAll = games('aaaaaa') + games('bbbbbb')
  const at66 = games('ab'.repeat(6))
  const c = { decider: 'noTb' }
  assert.ok(play(c, at66).tb, 'the first set still has its tiebreak')
  assert.ok(play(c, games('aaaaaa') + at66).tb, 'so does the second')
  assert.equal(play(c, oneAll + at66).tb, false, 'no tiebreak at 6:6 in the third set')
  assert.equal(play(c, oneAll + at66 + G('a')).winner, null, '7:6 is not enough')
  assert.equal(E.setsText(play(c, oneAll + at66 + games('aa'))), '6:0  0:6  8:6', '8:6 wins')
  const long = oneAll + at66 + games('ab'.repeat(4)) + games('aa')
  assert.equal(E.setsText(play(c, long)), '6:0  0:6  12:10', '12:10 wins')
  assert.equal(play(c, long).winner, 0)
  assert.equal(play({ ...c, bestOf: 1 }, at66).tb, true, 'one set: the tiebreak stays')
})

test('rule examples: short sets to 4 games (FIP alternative scoring 1a)', () => {
  const c = { games: 4 }
  assert.equal(E.setsText(play(c, games('aaaa'))), '4:0', '4:0 wins the set')
  assert.equal(play(c, games('aaabbb') + G('a')).sets.length, 0, '4:3 is not a set')
  assert.equal(E.setsText(play(c, games('aaabbb') + games('aa'))), '5:3')
  const at44 = games('ab'.repeat(4))
  assert.ok(play(c, at44).tb, '4:4 starts the tiebreak')
  assert.equal(play(c, at44).tbTarget, 7, 'to 7')
  assert.equal(E.setsText(play(c, at44 + 'aaaaaaa')), '5:4', 'the set then counts 5:4')
  assert.equal(play(c, games('ab'.repeat(3))).tb, false, 'no tiebreak at 3:3')
  assert.equal(play({}, at44).tb, false, 'normal sets: no tiebreak at 4:4')
  const oneAll = games('aaaa') + games('bbbb')
  assert.equal(play({ ...c, decider: 'noTb' }, oneAll + at44).tb, false, 'advantage set: no tiebreak at 4:4')
  assert.equal(E.setsText(play({ ...c, decider: 'noTb' }, oneAll + at44 + games('aa'))), '4:0  0:4  6:4')
  assert.equal(play({ ...c, decider: 'mtb' }, oneAll).tbTarget, 10, 'match tiebreak instead of a third set')
  assert.equal(play({ ...c, bestOf: 3 }, games('aaaa') + games('aaaa')).winner, 0, '4:0 4:0 wins the match')
})

test('rule examples: match tiebreak to 7', () => {
  const oneAll = games('aaaaaa') + games('bbbbbb')
  const c = { decider: 'mtb7' }
  const s = play(c, oneAll)
  assert.ok(s.tb && s.mtb, 'at one set all a match tiebreak starts')
  assert.equal(s.tbTarget, 7)
  assert.equal(play(c, oneAll + 'a'.repeat(6) + 'b'.repeat(6) + 'a').winner, null, '7:6 is not enough')
  const won = play(c, oneAll + 'a'.repeat(6) + 'b'.repeat(6) + 'aa')
  assert.equal(won.winner, 0, '8:6 wins')
  assert.equal(E.setsText(won), '6:0  0:6  [8:6]')
  // a normal tiebreak to 7 at 6:6 is not a match tiebreak
  const tb = play(c, games('ab'.repeat(6)) + 'a'.repeat(7))
  assert.equal(E.setsText(tb), '7:6')
  // abandoned in the match tiebreak: the history shows it as one
  const e = E.summary(play(c, oneAll + 'aab'), 1)
  assert.equal(E.setsText(e), '6:0  0:6  [2:1]')
})
