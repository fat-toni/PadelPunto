// Padel scoring engine — pure functions, no Zepp OS APIs (testable with Node).
//
// Teams are indexed 0 (us) and 1 (them).
// cfg.mode:    'adv'    classic advantage
//              'golden' golden point at 40:40
//              'star'   star point (FIP 2026): two advantages, the third deuce is decided by one point
// cfg.bestOf:  1 | 3
// cfg.games:   6 (normal) | 4 (short sets, FIP alternative scoring 1a): a set is won with this many
//              games and a lead of two, at N:N a tiebreak to 7 decides it (N+1:N); missing = 6
// cfg.decider: the third set of a best of 3:
//              'set'   normal set with a tiebreak at 6:6 (4:4)
//              'noTb'  advantage set (FIP rule 1.4): no tiebreak at 6:6, played on until a lead of
//                      two games (8:6, 9:7 …); the first two sets keep their tiebreak
//              'mtb7'  match tiebreak to 7 instead of the set (FIP alternative scoring 1b)
//              'mtb'   match tiebreak to 10 instead of the set
// cfg.firstServer: 0 | 1
// cfg.sides:   'fip'   change ends after games 1, 3, 5 … of a set and every 6 points of a tiebreak
//              'set'   only after each set (common in leisure play)
//              'never' no change of ends; a missing value (older saved matches) means 'fip'

export function newMatch(cfg, now) {
  return {
    cfg: { ...cfg },
    sets: [], // { g: [a, b], tb: [a, b] | null, mtb: bool }
    games: [0, 0],
    points: [0, 0],
    deuces: 0,
    tb: false,
    tbTarget: 7,
    mtb: false, // the running tiebreak is a match tiebreak (replaces the deciding set)
    tbFirstServer: 0,
    server: cfg.firstServer,
    winner: null,
    startedAt: now,
    endedAt: null,
  }
}

function other(t) {
  return 1 - t
}

export function setsWon(s) {
  const won = [0, 0]
  for (const set of s.sets) won[set.g[0] > set.g[1] ? 0 : 1]++
  return won
}

// Games needed for a set (option "Spiele pro Satz").
function setGames(s) {
  return s.cfg.games === 4 ? 4 : 6
}

function isDecidingSet(s) {
  const won = setsWon(s)
  return s.cfg.bestOf === 3 && won[0] === 1 && won[1] === 1
}

function startTiebreak(s, target, mtb = false) {
  s.tb = true
  s.tbTarget = target
  s.mtb = mtb
  s.tbFirstServer = s.server
}

// Starts the next set; a match tiebreak replaces the deciding set if configured.
function startSet(s) {
  s.games = [0, 0]
  s.points = [0, 0]
  s.deuces = 0
  s.tb = false
  s.mtb = false
  if (!isDecidingSet(s)) return
  if (s.cfg.decider === 'mtb') startTiebreak(s, 10, true)
  else if (s.cfg.decider === 'mtb7') startTiebreak(s, 7, true)
}

export function currentServer(s) {
  if (!s.tb) return s.server
  const n = s.points[0] + s.points[1]
  if (n === 0) return s.tbFirstServer
  return Math.floor((n - 1) / 2) % 2 === 0 ? other(s.tbFirstServer) : s.tbFirstServer
}

// Copies only what addPoint changes; cfg and finished sets are never modified, so they are shared.
function clone(s) {
  return { ...s, sets: s.sets.slice(), games: s.games.slice(), points: s.points.slice() }
}

// Returns a new state and a list of events: 'point' | 'game' | 'set' | 'match' | 'switch'.
export function addPoint(prev, t) {
  if (prev.winner !== null) return { state: prev, events: [] }
  const s = clone(prev)
  const o = other(t)
  const events = ['point']
  const p = s.points
  p[t]++

  const sides = s.cfg.sides || 'fip'
  let gameWon = false
  if (s.tb) {
    gameWon = p[t] >= s.tbTarget && p[t] - p[o] >= 2
    if (!gameWon && sides === 'fip' && (p[0] + p[1]) % 6 === 0) events.push('switch')
  } else {
    const suddenDeath = s.cfg.mode === 'golden' || (s.cfg.mode === 'star' && s.deuces >= 3)
    if (p[t] >= 4 && (p[t] - p[o] >= 2 || (suddenDeath && p[o] >= 3))) {
      gameWon = true
    } else if (p[t] === p[o] && p[t] >= 3) {
      p[0] = p[1] = 3
      s.deuces++
    }
  }
  if (!gameWon) return { state: s, events }

  events.push('game')
  const wasTb = s.tb
  const tbScore = wasTb ? [p[0], p[1]] : null
  const isMtb = wasTb && s.mtb
  // A match tiebreak replaces a whole set, so it is not counted as a game.
  if (!isMtb) s.games[t]++
  s.points = [0, 0]
  s.deuces = 0
  s.server = wasTb ? other(s.tbFirstServer) : other(s.server)

  const g = s.games
  const n = setGames(s)
  const setWon = isMtb || (g[t] >= n && g[t] - g[o] >= 2) || (wasTb && g[t] === n + 1)
  if (!setWon) {
    const advantageSet = isDecidingSet(s) && s.cfg.decider === 'noTb'
    if (g[0] === n && g[1] === n && !advantageSet) startTiebreak(s, 7)
    if (sides === 'fip' && (g[0] + g[1]) % 2 === 1) events.push('switch')
    return { state: s, events }
  }

  events.push('set')
  s.sets.push({ g: isMtb ? [t === 0 ? 1 : 0, t === 1 ? 1 : 0] : [g[0], g[1]], tb: tbScore, mtb: isMtb })
  if (sides === 'set' || (sides === 'fip' && ((g[0] + g[1]) % 2 === 1 || isMtb))) events.push('switch')

  if (setsWon(s)[t] > s.cfg.bestOf / 2) {
    s.winner = t
    s.tb = false
    s.mtb = false
    events.push('match')
    // no side change after the last point
    const i = events.indexOf('switch')
    if (i >= 0) events.splice(i, 1)
    return { state: s, events }
  }
  startSet(s)
  return { state: s, events }
}

// Rebuilds a match from its list of point winners (team indices), e.g. after an undo.
// The moves are all that is saved per point, so undo has no step limit.
export function replay(cfg, startedAt, moves) {
  let s = newMatch(cfg, startedAt)
  for (const t of moves) s = addPoint(s, t).state
  return s
}

// Point labels for both teams, e.g. ['40', 'AD'] or ['5', '3'] in a tiebreak.
export function pointLabels(s) {
  const p = s.points
  if (s.tb) return [String(p[0]), String(p[1])]
  const names = ['0', '15', '30', '40']
  if (p[0] >= 3 && p[1] >= 3) {
    if (p[0] === p[1]) return ['40', '40']
    return p[0] > p[1] ? ['AD', '40'] : ['40', 'AD']
  }
  return [names[p[0]], names[p[1]]]
}

// What to hint at 40:40, depending on the mode: { key: 'deuce' | 'deuceN' | 'golden' | 'star', n }
// (n = deuces so far for star point), or null. The pages turn it into text via i18n.
export function deuceInfo(s) {
  if (s.tb || s.winner !== null) return null
  const p = s.points
  if (!(p[0] === 3 && p[1] === 3)) return null
  if (s.cfg.mode === 'golden') return { key: 'golden' }
  if (s.cfg.mode === 'star') return s.deuces >= 3 ? { key: 'star' } : { key: 'deuceN', n: s.deuces }
  return { key: 'deuce' }
}

// "6:4  3:6  [10:8]"; a set abandoned in its tiebreak shows the tiebreak points: "6:6(4:2)".
export function setsText(s) {
  return s.sets
    .map((set) => {
      if (set.mtb) return `[${set.tb[0]}:${set.tb[1]}]`
      const games = `${set.g[0]}:${set.g[1]}`
      return set.tb && set.g[0] === set.g[1] ? `${games}(${set.tb[0]}:${set.tb[1]})` : games
    })
    .join('  ')
}

export function durationText(s, now) {
  const ms = (s.endedAt || now) - s.startedAt
  const min = Math.max(0, Math.floor(ms / 60000))
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
}

// Filled point bars per team (0–4, 4 = advantage); null in a tiebreak.
export function pointSteps(s) {
  if (s.tb) return null
  const p = s.points
  if (p[0] >= 3 && p[1] >= 3) return [p[0] > p[1] ? 4 : 3, p[1] > p[0] ? 4 : 3]
  return [p[0], p[1]]
}

// Where the current server stands: 'right' (deuce side) when an even number of points
// has been played in the game or tiebreak, 'left' otherwise. At a golden or star point
// the receivers choose the side ('choice'). null once the match is over.
export function serveSide(s) {
  if (s.winner !== null) return null
  const p = s.points
  if (!s.tb && p[0] === 3 && p[1] === 3) {
    if (s.cfg.mode === 'golden' || (s.cfg.mode === 'star' && s.deuces >= 3)) return 'choice'
  }
  return (p[0] + p[1]) % 2 === 0 ? 'right' : 'left'
}

export function hasStarted(s) {
  return s.sets.length + s.games[0] + s.games[1] + s.points[0] + s.points[1] > 0
}

// Compact record for the match log. An unfinished match keeps its running set
// (or match tiebreak) as the last set and is marked as abandoned.
export function summary(s, now) {
  const sets = s.sets.map((set) => ({ ...set }))
  const abandoned = s.winner === null
  if (abandoned && s.games[0] + s.games[1] + s.points[0] + s.points[1] > 0) {
    const tb = s.tb ? [s.points[0], s.points[1]] : null
    if (s.tb && s.mtb) sets.push({ g: [0, 0], tb, mtb: true })
    else sets.push({ g: [s.games[0], s.games[1]], tb, mtb: false })
  }
  return {
    startedAt: s.startedAt,
    endedAt: s.endedAt || now,
    mode: s.cfg.mode,
    names: s.cfg.names,
    colors: s.cfg.colors,
    winner: s.winner,
    abandoned,
    sets,
  }
}

// Highest tiebreak number with a spoken word (n0 … n20, see utils/voice.js).
export const MAX_SPOKEN = 20

// What the voice says after a point, server first, as word keys of utils/voice.js:
// ['p30', 'p15'], ['p15', 'all'], ['deuce'], ['golden'], ['star'], ['advIn'] / ['advOut'],
// ['n5', 'n3'] in a tiebreak. Nothing at 0:0 (a new game) and once the match is won.
export function spokenWords(s) {
  if (s.winner !== null) return []
  const p = s.points
  const srv = currentServer(s)
  const [a, b] = [p[srv], p[other(srv)]]
  if (a === 0 && b === 0) return []
  if (s.tb) {
    if (a > MAX_SPOKEN || b > MAX_SPOKEN) return []
    return a === b ? [`n${a}`, 'all'] : [`n${a}`, `n${b}`]
  }
  const deuce = deuceInfo(s)
  if (deuce) return [deuce.key === 'deuceN' ? 'deuce' : deuce.key]
  if (a >= 3 && b >= 3) return [a > b ? 'advIn' : 'advOut']
  const names = ['p0', 'p15', 'p30', 'p40']
  return a === b ? [names[a], 'all'] : [names[a], names[b]]
}
