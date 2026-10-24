// Score announcement.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STRINGS } from '../../locales/index.js'
import { T, CARD_Y, w, saved, tapTeam, points, startMatch, option, openOptions } from './helpers.mjs'

const listen = () => {
  for (let i = 0; i < 40; i++) w.tick(100)
}

test('announcement: off by default, no player at all', () => {
  w.launch()
  startMatch()
  points(0, 2)
  w.tick(3000)
  assert.equal(w.zos.sound.created, 0)
})

test('announcement: says the score after each point and undo', () => {
  w.files.set('cfg.json', JSON.stringify({ voice: 'on', volume: 'low' }))
  w.launch()
  startMatch()
  assert.equal(w.zos.sound.volume, 15, 'watch volume set for the match')
  tapTeam(0)
  listen()
  assert.deepEqual(w.zos.sound.played, ['voice/en/p15.mp3', 'voice/en/p0.mp3'])
  w.zos.sound.played.length = 0
  tapTeam(1)
  tapTeam(1)
  listen()
  // 15:15 had just begun ("fünfzehn"), the next point cut it off before "beide".
  assert.deepEqual(w.zos.sound.played, ['voice/en/p15.mp3', 'voice/en/p15.mp3', 'voice/en/p30.mp3'])
  w.zos.sound.played.length = 0
  w.press(T.undo)
  listen()
  assert.deepEqual(w.zos.sound.played, ['voice/en/p15.mp3', 'voice/en/all.mp3'])
  w.press(T.end).press(T.leave)
  assert.equal(w.zos.sound.volume, 60, 'old volume back after leaving')
})

test('announcement: leaving the match while a word loads plays nothing afterwards', () => {
  w.files.set('cfg.json', JSON.stringify({ voice: 'on' }))
  w.launch()
  startMatch()
  w.tapAt(60, CARD_Y[0] + 90) // point; the first word is loading (50 ms)
  w.press(T.end).press(T.leave)
  assert.equal(w.url, 'page/start')
  listen()
  assert.deepEqual(w.zos.sound.played, [])
})

test('announcement: a won game is called with the winner color, in every language', () => {
  w.files.set('cfg.json', JSON.stringify({ voice: 'on', colors: [2, 1] }))
  w.launch()
  startMatch()
  points(0, 4)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/c_orange.mp3', 'voice/en/won.mp3'])
  points(1, 3)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/p40.mp3', 'voice/en/p0.mp3'], 'team 1 serves now')
  tapTeam(1)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/c_blue.mp3', 'voice/en/won.mp3'])
  w.press(T.undo)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/p40.mp3', 'voice/en/p0.mp3'], 'undo calls the score')
})

test('announcement: always in English, also with a Spanish app', () => {
  const ES = STRINGS.es
  w.files.set('cfg.json', JSON.stringify({ voice: 'on', lang: 'es' }))
  w.launch()
  w.press(ES.newGame)
  w.tapAt(195, 300)
  w.tick(6000)
  for (let i = 0; i < 3; i++) tapTeam(0)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/p40.mp3', 'voice/en/p0.mp3'])
})

test('announcement: the color words match the team colors', async () => {
  const { COLOR_WORDS } = await import('../../utils/voice.js')
  const { TEAM_COLORS } = await import('../../utils/theme.js')
  assert.deepEqual(
    COLOR_WORDS,
    TEAM_COLORS.map((c) => c.key),
  )
})

test('announcement: in English with an English app too', () => {
  w.files.set('cfg.json', JSON.stringify({ voice: 'on', lang: 'en' }))
  w.launch()
  w.press(STRINGS.en.newGame)
  w.tapAt(195, 300)
  w.tick(6000)
  assert.equal(w.zos.sound.volume, 100)
  for (let i = 0; i < 3; i++) tapTeam(0)
  listen()
  assert.deepEqual(w.zos.sound.played.slice(-2), ['voice/en/p40.mp3', 'voice/en/p0.mp3'])
})

test('options: "Ansage" and its volume cycle and are saved', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.optVoice) && w.has(T.voiceOff) && w.has(T.volHigh))
  option(T.optVoice)
  assert.ok(w.has(T.voiceOn))
  option(T.optVolume)
  assert.ok(w.has(T.volLow))
  assert.deepEqual([saved('cfg').voice, saved('cfg').volume], ['on', 'low'])
})

test('options: "Lautstärke" is greyed out and does nothing while "Ansage" is off', async () => {
  const { C } = await import('../../utils/theme.js')
  w.launch()
  openOptions()
  assert.equal(w.find(T.volHigh).props.color, C.dim)
  assert.equal(w.find(T.optVolume).props.color, C.dim)
  option(T.optVolume)
  assert.ok(w.has(T.volHigh))
  assert.ok(!w.files.has('cfg.json'), 'nothing saved')
  option(T.optVoice) // on: the volume card wakes up
  assert.equal(w.find(T.volHigh).props.color, 0xffffff)
  assert.equal(w.find(T.optVolume).props.color, C.muted)
  option(T.optVolume)
  assert.equal(saved('cfg').volume, 'low')
  option(T.optVoice) // off again: greyed out, the chosen volume stays
  assert.equal(w.find(T.volLow).props.color, C.dim)
})
