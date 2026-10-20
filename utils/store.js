// Persists the running match with its point list (moves, for undo) and the log of past matches.
// The match and its moves share one file, so a point costs a single write. Only the settings,
// start and end time are saved with the moves; the score is rebuilt from them on loading.
import { read, write, remove } from './files'
import { summary, replay, hasStarted } from './score'

const MAX_LOG = 30

const isMoves = (m) => Array.isArray(m) && m.every((t) => t === 0 || t === 1)
const isPair = (a) => Array.isArray(a) && a.length === 2 && a.every((n) => typeof n === 'number')

// The running match and its point winners in order: { state, moves }, state null if none.
// Before 1.1.0 'match' held the bare state and 'moves' was its own file.
// The score is rebuilt from the moves, so a damaged or outdated state can't break the match
// screen. Without usable moves (or with none although points were played) a well-formed
// state is kept; undo then starts from it.
export function loadGame() {
  const none = { state: null, moves: [] }
  const saved = read('match', null)
  if (!saved || typeof saved !== 'object') return none
  const state = saved.state || saved
  const moves = saved.state ? saved.moves : read('moves', [])
  if (!state.cfg || typeof state.cfg !== 'object' || typeof state.startedAt !== 'number') return none
  const wellFormed = Array.isArray(state.sets) && isPair(state.games) && isPair(state.points)
  if (isMoves(moves) && (moves.length > 0 || !wellFormed || !hasStarted(state))) {
    const rebuilt = replay(state.cfg, state.startedAt, moves)
    if (rebuilt.winner !== null) rebuilt.endedAt = typeof state.endedAt === 'number' ? state.endedAt : null
    return { state: rebuilt, moves }
  }
  if (wellFormed) return { state, moves: [] }
  return none
}

export function loadMatch() {
  return loadGame().state
}

// The settings a match keeps for itself: the rules, the first server, names and colors.
// Screen, heart rate, side change buzz and language always come from the current options.
const MATCH_CFG = ['mode', 'bestOf', 'games', 'decider', 'sides', 'firstServer', 'names', 'colors']

// Returns false if the match could not be saved. Writing the full score and all options as well
// would cost about twice the bytes on every point.
export function saveMatch(state, moves) {
  const cfg = {}
  for (const key of MATCH_CFG) cfg[key] = state.cfg[key]
  return write('match', { state: { cfg, startedAt: state.startedAt, endedAt: state.endedAt }, moves })
}

export function clearMatch() {
  remove('match')
  remove('moves')
}

// Newest first. Entries that can't be shown (damaged file) are left out.
export function loadLog() {
  const log = read('log', [])
  if (!Array.isArray(log)) return []
  return log.filter((e) => e && typeof e.startedAt === 'number' && Array.isArray(e.sets))
}

// Moves the saved match into the log and clears it. If the log can't be written (storage
// full), the match stays saved, so it is never lost; returns false then.
export function archiveMatch(state) {
  if (!write('log', [summary(state, Date.now()), ...loadLog()].slice(0, MAX_LOG))) return false
  clearMatch()
  return true
}

// Removes one match from the log; matches are told apart by their start time.
export function deleteLogEntry(startedAt) {
  write(
    'log',
    loadLog().filter((e) => e.startedAt !== startedAt),
  )
}

export function clearLog() {
  remove('log')
}
