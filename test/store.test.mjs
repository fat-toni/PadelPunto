// Run with: npm test (needs the @zos/fs stand-in from test/mock)
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { newMatch, addPoint } from '../utils/score.js'
import { loadCfg, saveCfg, DEFAULT_CFG, COLOR_COUNT } from '../utils/config.js'
import { loadGame, saveMatch, archiveMatch, loadLog } from '../utils/store.js'

const files = globalThis.zosFiles
const put = (key, value) => files.set(`${key}.json`, typeof value === 'string' ? value : JSON.stringify(value))
const cfg = { mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0 }

function played(moves) {
  let s = newMatch(cfg, 1000)
  for (const t of moves) s = addPoint(s, t).state
  return s
}

beforeEach(() => {
  files.clear()
  globalThis.zosFull = false
})

test('a match is saved and loaded with its moves', () => {
  const moves = [0, 0, 1, 0]
  assert.equal(saveMatch(played(moves), moves), true)
  const { state, moves: back } = loadGame()
  assert.deepEqual(back, moves)
  assert.deepEqual(state.points, [3, 1])
})

test('the score is rebuilt from the moves, a damaged state does not matter', () => {
  put('match', { state: { ...played([0, 0]), games: 'kaputt', points: null }, moves: [0, 0] })
  assert.deepEqual(loadGame().state.points, [2, 0])
})

test('the end time of a won match survives loading', () => {
  const moves = Array(24).fill(0)
  const s = { ...played(moves), endedAt: 99999 }
  put('match', { state: { ...s, cfg: { ...cfg, bestOf: 1 } }, moves })
  const { state } = loadGame()
  assert.equal(state.winner, 0)
  assert.equal(state.endedAt, 99999)
})

test('match files from before 1.1.0 still load', () => {
  put('match', played([1, 1, 1]))
  put('moves', [1, 1, 1])
  assert.deepEqual(loadGame().state.points, [0, 3])
  put('moves', 'kaputt')
  const { state, moves } = loadGame()
  assert.deepEqual(state.points, [0, 3], 'without moves the saved state is kept')
  assert.deepEqual(moves, [])
})

test('broken match files give no match instead of a crash', () => {
  for (const bad of ['{halb', '"text"', '42', '{}', { state: { cfg: null }, moves: [] }, { state: {}, moves: 'x' }]) {
    put('match', bad)
    assert.equal(loadGame().state, null, JSON.stringify(bad))
  }
})

test('a full storage keeps the match instead of losing it', () => {
  const moves = [0, 1, 0]
  saveMatch(played(moves), moves)
  globalThis.zosFull = true
  assert.equal(archiveMatch(loadGame().state), false)
  assert.deepEqual(loadGame().moves, moves, 'match still saved')
  assert.deepEqual(loadLog(), [])
  globalThis.zosFull = false
  assert.equal(archiveMatch(loadGame().state), true)
  assert.equal(loadGame().state, null)
  assert.equal(loadLog().length, 1)
})

test('a broken log reads as empty or loses only the broken entries', () => {
  put('log', '{"kein":"array"}')
  assert.deepEqual(loadLog(), [])
  put('log', [null, { startedAt: 5, sets: [] }, { startedAt: 'x', sets: [] }, { startedAt: 6 }])
  assert.deepEqual(loadLog(), [{ startedAt: 5, sets: [] }])
  assert.equal(archiveMatch(played([0])), true)
  assert.equal(loadLog().length, 2)
})

test('unknown option values fall back to the defaults', () => {
  put('cfg', { mode: 'golden', bestOf: 7, lang: 'fr', hr: 'off', names: ['A', 5], colors: [2, COLOR_COUNT] })
  const c = loadCfg()
  assert.equal(c.mode, 'golden')
  assert.equal(c.bestOf, DEFAULT_CFG.bestOf)
  assert.equal(c.lang, 'auto')
  assert.equal(c.hr, 'off')
  assert.deepEqual(c.names, ['', ''])
  assert.deepEqual(c.colors, DEFAULT_CFG.colors)
  put('cfg', '[1,2]')
  assert.deepEqual(loadCfg(), DEFAULT_CFG)
})

test('options are saved with names and team colors', () => {
  saveCfg({ ...DEFAULT_CFG, mode: 'star', names: ['ICH', ''], colors: [3, 4] })
  assert.equal(loadCfg().mode, 'star')
  assert.deepEqual(loadCfg().names, ['ICH', ''])
  assert.deepEqual(loadCfg().colors, [3, 4])
})

test('an old match without its moves file keeps its score', () => {
  put('match', played([0, 0, 1]))
  assert.deepEqual(loadGame().state.points, [2, 1])
})
