// Diagnosis page and error log.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEVICE } from '../mock/zos.mjs'
import { T, w, saved, tapTeam, points, games, startMatch, openInfo, openDiag, openCourt, LOGO } from './helpers.mjs'

// ---- diagnosis and error log ----

test('diagnosis: five quick taps on the logo open it, slow or fewer taps or the version do not', () => {
  w.launch()
  openInfo()
  assert.ok(w.has('Version 1.8.0'))
  for (let i = 0; i < 5; i++) w.press('Version 1.8.0')
  assert.equal(w.url, 'page/info', 'the version line no longer counts')
  for (let i = 0; i < 4; i++) w.tapAt(...LOGO)
  assert.equal(w.url, 'page/info')
  w.tick(3000)
  w.tapAt(...LOGO)
  assert.equal(w.url, 'page/info', 'old taps no longer count')
  for (let i = 0; i < 4; i++) w.tapAt(...LOGO)
  assert.equal(w.url, 'page/diag')
  w.swipe('right')
  assert.equal(w.url, 'page/info')
})

test('diagnosis: watch, app version, storage and the match count', () => {
  w.launch()
  startMatch()
  games(0, 12)
  w.press(T.end)
  openDiag()
  for (const t of [
    DEVICE.deviceName,
    String(DEVICE.deviceSource),
    `${DEVICE.width}×${DEVICE.height} eckig`,
    '5.0 · API 4.2',
    '5.0.1.2',
    '1.8.0 (10)',
    '3.0 GB / 4.0 GB',
    '9.0 MB',
  ])
    assert.ok(w.has(t), t)
  const row = (label) => w.texts()[w.texts().indexOf(label) + 1]
  assert.equal(row(T.diagMatches), '1')
  const bytes = ['cfg', 'log'].reduce((sum, k) => sum + Buffer.byteLength(w.files.get(`${k}.json`) || ''), 0)
  assert.equal(row(T.diagAppData), bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`)
  assert.ok(w.has(T.diagNoErrors))
  assert.equal(w.has(T.diagClearErrors), false)
})

test('diagnosis: "Ton testen" plays the test phrase and says which path worked', () => {
  w.launch()
  openDiag()
  const row = (label) => w.texts()[w.texts().indexOf(label) + 1]
  assert.equal(row(T.diagSoundState), T.soundIdle)
  w.press(T.diagSoundTest)
  assert.equal(row(T.diagSoundState), T.soundLoading)
  w.tick(100)
  assert.equal(row(T.diagSoundState), `${T.soundPlaying} (1)`)
  assert.equal(row(T.diagVolume), '60 %')
  w.tick(1000)
  assert.equal(row(T.diagSoundState), `${T.soundDone} (1)`)
  w.zos.sound.okPaths = ['assets://sound/padel_punto.mp3']
  w.press(T.diagSoundTest)
  w.tick(100).tick(100) // the second path is tried after the first fails
  assert.equal(row(T.diagSoundState), `${T.soundPlaying} (2)`)
  w.zos.sound.okPaths = []
  w.tick(1000)
  w.press(T.diagSoundTest)
  w.tick(100).tick(100)
  assert.equal(row(T.diagSoundState), T.soundFailed)
  assert.deepEqual(w.zos.sound.played, ['sound/padel_punto.mp3', 'assets://sound/padel_punto.mp3'])
})

// Lets a whole call play: prepare and 1 s per word, in small steps (nested timers, see watch.mjs).
test('diagnosis: a watch without a player says so', () => {
  w.zos.sound.noPlayer = true
  w.launch()
  openDiag()
  w.press(T.diagSoundTest)
  assert.ok(w.has(T.soundNoPlayer))
})

test('diagnosis: missing watch info shows "?" instead of crashing', () => {
  w.zos.device = {}
  w.zos.system = null
  w.zos.disk = null
  w.launch()
  openDiag()
  assert.ok(w.has('?×? eckig'))
  assert.equal(w.has(T.diagFree), false)
})

// From now on the heart rate sensor throws when read (the hr object is new in every test).
function breakHeartRate() {
  Object.defineProperty(w.zos.hr, 'bpm', {
    get() {
      throw new Error('sensor broken')
    },
  })
}

test('error log: a failing page keeps the app running, logs where and why, toasts once', () => {
  w.allowErrors = true
  w.launch()
  startMatch()
  w.press(T.end)
  breakHeartRate()
  w.press(T.newGame).tapAt(195, 300)
  assert.equal(w.url, 'page/match')
  tapTeam(0)
  tapTeam(0)
  assert.equal(saved('match').moves.length, 2, 'points still count')
  const errors = saved('errors')
  assert.equal(errors[0].msg, 'sensor broken')
  assert.deepEqual(
    errors.map((e) => e.where),
    ['touch', 'touch', 'match.build'],
  )
  assert.deepEqual(
    w.zos.toasts.filter((t) => t === T.errorLogged),
    [T.errorLogged],
  )
})

test('error log: keeps the newest 10, shown on the diagnosis page, cleared with two taps', () => {
  w.allowErrors = true
  w.launch()
  startMatch()
  breakHeartRate()
  points(0, 12)
  assert.equal(saved('errors').length, 10)
  w.press(T.end).press(T.leave)
  openDiag()
  assert.ok(w.texts().some((t) => t.endsWith('touch: sensor broken')))
  assert.equal(w.has(T.diagNoErrors), false)
  w.press(T.diagClearErrors)
  assert.ok(w.files.has('errors.json'), 'first tap only asks')
  w.press(T.clearConfirm)
  assert.equal(w.files.has('errors.json'), false)
  assert.equal(w.url, 'page/diag')
  assert.ok(w.has(T.diagNoErrors))
})

test('error log: an unreadable log file counts as empty', () => {
  w.files.set('errors.json', '{broken')
  w.allowErrors = true
  w.launch()
  openDiag()
  assert.ok(w.has(T.diagNoErrors))
})

test('diagnosis: the court time file counts in the storage too', () => {
  w.launch()
  openCourt()
  w.press(T.courtSave)
  openDiag()
  const row = (label) => w.texts()[w.texts().indexOf(label) + 1]
  const bytes = Buffer.byteLength(w.files.get('court.json'))
  assert.ok(w.has('  court.json'))
  assert.equal(row('  court.json'), `${bytes} B`)
})
