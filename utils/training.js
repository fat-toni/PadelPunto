// Training rules (cone button on the start screen) — pure functions, no Zepp OS APIs.
// A training counts only points; utils/score.js plays it as one match tiebreak and asks this
// file who serves and when it is over. The match screen shows the rest from here.
//
// cfg.target:     "Bis Ziel": up to this number with a lead of two, but at TRAIN_CAP[target] at
//                 the latest whoever is ahead wins (21 → 25). The serve changes every 2 points.
// cfg.total:      Americano: this many points in all, then it ends, also level (winner -1).
// cfg.serveEvery: Americano: the serve changes every 2 or 4 points.
// target and total are both missing for a normal match.

// The point at which a "Bis Ziel" training ends at the latest, per target.
export const TRAIN_CAP = { 7: 9, 11: 15, 15: 19, 21: 25 }

export function isTraining(cfg) {
  return !!(cfg && (cfg.target || cfg.total))
}

// Points per serve turn.
function serveTurn(cfg) {
  return cfg.total ? cfg.serveEvery || 4 : 2
}

// The first server serves the first turn, then the teams take turns.
export function trainingServer(s) {
  const turn = Math.floor((s.points[0] + s.points[1]) / serveTurn(s.cfg))
  return turn % 2 === 0 ? s.server : 1 - s.server
}

// 0 or 1 once a training is won, -1 for an Americano that ends level, null while it goes on.
export function trainingWinner(cfg, p) {
  if (cfg.total) {
    if (p[0] + p[1] < cfg.total) return null
    return p[0] === p[1] ? -1 : p[0] > p[1] ? 0 : 1
  }
  const cap = TRAIN_CAP[cfg.target] || Infinity
  for (const t of [0, 1]) {
    if ((p[t] >= cfg.target && p[t] - p[1 - t] >= 2) || p[t] >= cap) return t
  }
  return null
}

// "Bis Ziel": the points team t still needs if it wins every point from now on, counted
// honestly (at 20:20 to 21 it is 2, as only 22 wins; never past the cap).
export function pointsToWin(s, t) {
  const p = s.points
  const cap = TRAIN_CAP[s.cfg.target] || Infinity
  return Math.min(cap, Math.max(s.cfg.target, p[1 - t] + 2)) - p[t]
}

// "Bis Ziel": the teams one point away from winning (both at e.g. 24:24 with the cap at 25).
export function matchBalls(s) {
  if (!s.cfg.target || s.winner !== null) return []
  return [0, 1].filter((t) => pointsToWin(s, t) === 1)
}

// Americano: points still to play, the server's serves left in this turn, and how many the
// other team gets in the turn after (fewer near the end, 0 if the training ends before).
export function americanoInfo(s) {
  const n = s.points[0] + s.points[1]
  const turn = serveTurn(s.cfg)
  const left = s.cfg.total - n
  const serves = Math.min(turn - (n % turn), left)
  return { left, serves, next: Math.min(turn, left - serves) }
}

// How far team t has come, 0…1: to the target, or through all Americano points.
export function trainingProgress(s, t) {
  const goal = s.cfg.total || s.cfg.target
  return Math.min(1, s.points[t] / goal)
}
