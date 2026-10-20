// The whole app on a simulated watch (test/mock/watch.mjs): every page, every button, the options,
// the history, storage problems, languages and the screen layout, used the way a player would.
// Run with: npm test
import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Watch, SCREEN } from './mock/watch.mjs'
import { STRINGS } from '../locales/index.js'
import { getTextLayout } from './mock/zos.mjs'

const T = STRINGS.de
const CARD_Y = [238, 54] // own team below, opponents on top
// Default team colors: green (own team) and blue, as dark tints on the cards.
const GREEN_CARD = 0x1c2c26
const BLUE_CARD = 0x1e2632
let w

beforeEach(() => {
  w = new Watch()
})
afterEach(() => w.done())

// ---- helpers ----

const inst = () => w.page.inst
const team = (t) => inst().teams[t]
const pointText = (t) => team(t).points.w.props.text
const gamesText = (t) => team(t).games.w.props.text
const setTexts = (t) =>
  team(t)
    .sets.filter((c) => c.w.props.visible)
    .map((c) => c.w.props.text)
const hint = () => (inst().hintW.w.props.visible ? inst().hintW.w.props.text : '')
const won = (t) => team(t).win.w.props.visible
const saved = (key) => JSON.parse(w.files.get(`${key}.json`))
const log = () => (w.files.has('log.json') ? saved('log') : [])

// Taps a team card in the points area, then waits long enough for the next tap to count.
// One point for team t. A banner from a won set is tapped away first (between the cards, so
// the tap hits only the banner), as a player would.
function tapTeam(t) {
  if (w.page && w.page.inst.bannerOn) {
    w.tapAt(195, 222)
    w.tick(400)
  }
  w.tapAt(60, CARD_Y[t] + 90)
  w.tick(200)
}
const points = (t, n) => {
  for (let i = 0; i < n; i++) tapTeam(t)
}
const games = (t, n) => points(t, 4 * n)

// From the start screen to a fresh match; t = first server. Confirms replacing an open match.
function startMatch(t = 0) {
  w.press(T.newGame)
  if (w.url === 'page/start') w.press(T.endOld)
  assert.equal(w.url, 'page/serve')
  w.tapAt(195, t === 0 ? 300 : 160)
  assert.equal(w.url, 'page/match')
  w.tick(6000) // let any hint from the start fade
}

// Info → diagnosis: five quick taps on the logo.
const LOGO = [195, 150]
function openDiag() {
  w.press('i')
  for (let i = 0; i < 5; i++) w.tapAt(...LOGO)
  assert.equal(w.url, 'page/diag')
}

// Options page: tap the card with this title n times.
function option(title, n = 1) {
  for (let i = 0; i < n; i++) {
    w.press(title)
    w.tick(200)
  }
}

// Court time: the clock button left of the logo (y depends on "Weiter" being there).
function openCourt() {
  w.tapAt(62, w.has(T.resume) ? 97 : 123)
  assert.equal(w.url, 'page/court')
}
// Alarm time (seconds) for h:m today (or days later) on the simulated watch.
const at = (h, m, days = 0) => {
  const d = new Date(Date.now())
  d.setHours(h, m, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime() / 1000
}
const courtTime = () =>
  w
    .texts()
    .slice(w.texts().indexOf(T.courtUntilLabel) + 1, w.texts().indexOf(T.courtUntilLabel) + 4)
    .join('')

function openOptions() {
  w.press(T.options)
  assert.equal(w.url, 'page/options')
}

// A finished 6:0 6:0 match for team t, ended with "Ende" (one tap once someone has won).
function playWonMatch(t = 0) {
  startMatch()
  games(t, 12)
  w.press(T.end)
  assert.equal(w.url, 'page/start')
}

// ---- start screen, info, navigation ----

test('first start: start screen without "Weiter", own clock, no system bar', () => {
  w.launch()
  assert.equal(w.url, 'page/start')
  assert.deepEqual(w.texts(), ['18:00', 'i', 'Padel Punto', T.newGame, T.options, T.history])
  assert.equal(w.zos.statusBar, false)
})

test('the clock follows the minute and the 12-hour setting', () => {
  w.zos.hour12 = true
  w.launch()
  assert.ok(w.has('6:00'))
  w.tick(60100)
  assert.ok(w.has('6:01'))
})

test('info shows version 1.7.0 and the developers; back returns without rebuilding start', () => {
  w.launch()
  w.press('i')
  assert.equal(w.url, 'page/info')
  assert.ok(w.has('Version 1.7.0'))
  assert.ok(w.has('Fat Toni & Claude'))
  assert.ok(w.has(T.info))
  w.press(T.back)
  assert.equal(w.url, 'page/start')
  assert.equal(w.log.filter((u) => u === 'page/start').length, 1)
  w.press('i').swipe('right')
  assert.equal(w.url, 'page/start')
})

// ---- diagnosis and error log ----

test('diagnosis: five quick taps on the logo open it, slow or fewer taps or the version do not', () => {
  w.launch()
  w.press('i')
  assert.ok(w.has('Version 1.7.0'))
  for (let i = 0; i < 5; i++) w.press('Version 1.7.0')
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
    'Amazfit Bip 6',
    '10223873',
    '390×450 eckig',
    '5.0 · API 4.2',
    '5.0.1.2',
    '1.7.0 (9)',
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
  const { COLOR_WORDS } = await import('../utils/voice.js')
  const { TEAM_COLORS } = await import('../utils/theme.js')
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
  const { C } = await import('../utils/theme.js')
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

test('diagnosis: greets with one of the jokes, in the app language', () => {
  w.launch()
  openDiag()
  const jokes = [T.joke1, T.joke2, T.joke3]
  assert.equal(w.texts().filter((t) => jokes.includes(t)).length, 1)
})

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

test('the back key on the start screen closes the app', () => {
  w.launch().key('back')
  assert.equal(w.url, 'watchface')
})

test('"Wer schlägt auf?" shows both teams the match way round; "Abbrechen" goes back', () => {
  w.launch().press(T.newGame)
  assert.equal(w.url, 'page/serve')
  assert.deepEqual(w.texts(), ['18:00', T.whoServes, T.them, T.us, T.cancel, T.random])
  w.press(T.cancel)
  assert.equal(w.url, 'page/start')
  assert.equal(w.files.has('match.json'), false)
})

// ---- the match screen ----

test('points count 0, 15, 30, 40, game; the own team is the lower card', () => {
  w.launch()
  startMatch()
  assert.deepEqual([pointText(0), pointText(1)], ['0', '0'])
  const labels = []
  for (let i = 0; i < 3; i++) {
    tapTeam(0)
    labels.push(pointText(0))
  }
  assert.deepEqual(labels, ['15', '30', '40'])
  assert.equal(pointText(1), '0')
  tapTeam(0)
  assert.deepEqual([gamesText(0), gamesText(1)], ['1', '0'])
  assert.deepEqual([pointText(0), pointText(1)], ['0', '0'])
  // the point bars fill per point
  tapTeam(1)
  tapTeam(1)
  const lit = team(1).bars.filter((b) => b.w.props.color === inst().colors[1].text).length
  assert.equal(lit, 2)
})

test('"Rückgängig" takes back points across a game, and does nothing at 0:0', () => {
  w.launch()
  startMatch()
  w.press(T.undo)
  assert.equal(pointText(0), '0')
  games(0, 1)
  tapTeam(1)
  w.tick(400).press(T.undo)
  w.tick(400).press(T.undo)
  assert.deepEqual([gamesText(0), pointText(0), pointText(1)], ['0', '40', '0'])
  assert.deepEqual(saved('match').moves, [0, 0, 0])
})

test('every point is saved at once', () => {
  w.launch()
  startMatch()
  points(0, 2)
  points(1, 1)
  assert.deepEqual(saved('match').moves, [0, 0, 1])
  w.closeApp()
  w.launch().press(T.resume)
  assert.deepEqual([pointText(0), pointText(1)], ['30', '15'])
})

test('watch keys and swipes do nothing during a match', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.key('back').key('home').swipe('right').swipe('left')
  assert.equal(w.url, 'page/match')
  assert.equal(pointText(0), '15')
})

test('sliding across a card or holding it too long gives no point', () => {
  w.launch()
  startMatch()
  w.tapAt(60, CARD_Y[0] + 90, {
    ms: 200,
    moves: [
      [0, 10],
      [0, 30],
    ],
  })
  w.tick(200)
  w.tapAt(60, CARD_Y[0] + 90, { ms: 1000 })
  w.tick(200)
  w.tapAt(60, CARD_Y[0] + 90, { leave: true })
  w.tick(200)
  assert.equal(pointText(0), '0')
  // and the card is dark again
  assert.equal(team(0).points.w.props.visible, true)
  const card = w.page.widgets.find((x) => x.type === 'FILL_RECT' && x.props.y === CARD_Y[0])
  assert.equal(card.props.color, GREEN_CARD)
})

test('team cards are tinted in the team colors, also on "Wer schlägt auf?"', () => {
  w.launch().press(T.newGame)
  const cardAt = (y) => w.page.widgets.find((x) => x.type === 'FILL_RECT' && x.props.y === y).props.color
  assert.equal(cardAt(236), GREEN_CARD, 'own team below')
  assert.equal(cardAt(96), BLUE_CARD)
  w.tapAt(195, 300)
  assert.equal(cardAt(CARD_Y[0]), GREEN_CARD)
  assert.equal(cardAt(CARD_Y[1]), BLUE_CARD)
  w.press(T.end)
  w.press(T.options)
  option(T.optColor1) // blue → orange
  option(T.optColor0) // green → blue (free now)
  w.press(T.done).press(T.newGame).tapAt(195, 300)
  assert.equal(cardAt(CARD_Y[0]), BLUE_CARD)
})

test("a won game lights up the winner's games tile for a moment; undo puts it out", () => {
  w.launch()
  startMatch()
  const tile = (t) => team(t).tile.w.props.color
  const normal = tile(0)
  points(0, 3)
  assert.equal(tile(0), normal)
  w.tapAt(60, CARD_Y[0] + 90)
  assert.equal(tile(0), 0xd4f53c)
  assert.equal(team(0).games.w.props.color, 0x000000)
  assert.equal(tile(1), team(1).tile.w.props.color)
  w.tick(800)
  assert.equal(tile(0), normal)
  assert.equal(team(0).games.w.props.color, 0xffffff)
  w.tapAt(60, CARD_Y[1] + 90).tick(250)
  points(1, 3)
  assert.equal(tile(1), 0xd4f53c)
  w.press(T.undo)
  assert.notEqual(tile(1), 0xd4f53c)
})

test('a won set buzzes once long, the won match three times', () => {
  w.launch()
  startMatch()
  games(0, 5)
  points(0, 3)
  w.zos.vibes.length = 0
  tapTeam(0) // 6:0
  assert.deepEqual(w.zos.vibes, [[{ type: 'continuous', duration: 600 }]])
  games(0, 5)
  points(0, 3)
  w.zos.vibes.length = 0
  tapTeam(0) // 6:0 6:0
  assert.equal(w.zos.vibes.length, 1)
  assert.deepEqual(
    w.zos.vibes[0].map((x) => [x.type, x.duration]),
    [
      ['continuous', 600],
      ['pause', 250],
      ['continuous', 600],
      ['pause', 250],
      ['continuous', 600],
    ],
  )
})

// ---- break at a change of ends ----

const pauseEnd = ['strong', 'pause', 'strong']
const vibeTypes = () => w.zos.vibes.map((v) => v.map((x) => x.type))

test('break: 90 s countdown after the side change, buzz at the end; none after the first game', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 1) // 1:0, change of ends without a break
  assert.equal(hint(), T.switchSides)
  w.tick(6000)
  assert.equal(hint(), '')
  games(0, 2) // 3:0
  assert.equal(hint(), T.switchSides)
  w.tick(5100)
  assert.equal(hint(), 'Pause 1:25')
  w.tick(25000)
  assert.equal(hint(), 'Pause 1:00')
  w.zos.vibes.length = 0
  w.tick(59000)
  assert.equal(hint(), 'Pause 0:01')
  assert.deepEqual(vibeTypes(), [])
  w.tick(1000)
  assert.equal(hint(), '')
  assert.deepEqual(vibeTypes(), [pauseEnd])
})

test('break: the next point or undo ends it', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 3)
  w.tick(10000)
  assert.equal(hint(), 'Pause 1:20')
  tapTeam(1)
  assert.equal(hint(), '')
  w.tick(90000)
  assert.ok(!vibeTypes().some((v) => v.join() === pauseEnd.join()), 'no buzz for a break that ended')
  w.press(T.undo) // back to 3:0 at 0:0 points, the break does not come back
  w.tick(6000)
  assert.equal(hint(), '')
  games(0, 2) // 5:0
  w.tick(6000)
  assert.equal(hint(), 'Pause 1:24')
  w.press(T.undo)
  assert.equal(hint(), '')
})

test('option "Seitenwechsel": cycles, is saved and goes into the new match', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.sidesFip))
  option(T.optSides)
  assert.ok(w.has(T.sidesSet))
  w.press(T.done)
  assert.equal(saved('cfg').sides, 'set')
  startMatch()
  games(0, 1) // 1:0: no change of ends in this variant
  assert.equal(hint(), '')
  games(1, 1)
  games(0, 4) // 6:1
  assert.equal(saved('match').state.cfg.sides, 'set', 'the match keeps its variant')
})

test('option "Seitenwechsel: Nach dem Satz": the hint comes at the set end, also at 6:4', () => {
  w.files.set('cfg.json', JSON.stringify({ sides: 'set', pause: 'off' }))
  w.launch()
  startMatch()
  for (let i = 0; i < 4; i++) {
    games(0, 1)
    assert.equal(hint(), '', 'no change of ends inside the set')
    games(1, 1)
  }
  games(0, 2) // 6:4
  assert.equal(hint(), T.switchSides)
})

test('break: after every set 2 minutes, also without a change of ends; none after the match', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 3) // 3:0, change of ends
  w.tick(91000)
  games(1, 3)
  w.tick(91000)
  games(0, 3) // 6:3 → set, odd: change of ends and the longer break
  assert.equal(hint(), T.switchSides)
  w.tick(5100)
  assert.equal(hint(), 'Pause 1:55')
  w.tick(115000)
  assert.equal(hint(), '')
  games(0, 2)
  w.tick(91000)
  games(1, 4)
  w.tick(91000)
  games(0, 4) // 6:4 → set and match: no break
  w.tick(6000)
  assert.equal(hint(), T.matchOver)
})

test('break: a set won 6:4 (no change of ends) still gets one', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'on' }))
  w.launch()
  startMatch()
  games(0, 2)
  w.tick(91000)
  games(1, 4)
  w.tick(91000)
  games(0, 4) // 6:4 (the change of ends at 5:4 is still on screen for a moment)
  w.tick(6000)
  assert.equal(hint(), 'Pause 1:54', 'FIP: up to 120 s after a set')
})

test('break: off by default; the option switches it on, old seconds values fall back to off', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.pauseTimes))
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'on')
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'off')
  w.press(T.done)
  startMatch()
  games(0, 3)
  w.tick(6000)
  assert.equal(hint(), '', 'no break when off')
  w.files.set('cfg.json', JSON.stringify({ pause: 90 }))
  w.press(T.end).press(T.leave)
  openOptions()
  assert.equal(saved('cfg').pause, 90)
  option(T.optPause)
  assert.equal(saved('cfg').pause, 'on', 'an old 90 counts as off, one tap turns it on')
})

test('break: off in the options, and never after the match', () => {
  w.files.set('cfg.json', JSON.stringify({ pause: 'off', bestOf: 1 }))
  w.launch()
  startMatch()
  games(0, 3)
  w.tick(6000)
  assert.equal(hint(), '')
  w.press(T.end).press(T.endConfirm)
  w.files.set('cfg.json', JSON.stringify({ bestOf: 1 }))
  w.press(T.newGame).tapAt(195, 300)
  games(0, 2)
  games(1, 3)
  games(0, 4) // 6:3, odd: change of ends, but the match is over
  w.tick(6000)
  assert.equal(hint(), T.matchOver)
})

test('break: leaving the match stops the countdown', () => {
  w.launch()
  startMatch()
  games(0, 3)
  w.press(T.end).press(T.leave)
  w.zos.vibes.length = 0
  w.tick(100000)
  assert.deepEqual(vibeTypes(), [])
})

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

// ---- banner after a won set ----

const banner = () => inst().banner.map((b) => b.w.props)
const bannerTexts = () =>
  banner()
    .slice(1)
    .map((p) => p.text)

test('banner: every won set, for both teams, in the winner color with the score from its side', () => {
  w.launch()
  startMatch(1)
  assert.equal(inst().bannerOn, false)
  assert.ok(banner().every((p) => p.visible === false))
  games(1, 6) // DIE 6:0
  assert.ok(banner().every((p) => p.visible !== false))
  assert.deepEqual(bannerTexts(), [T.setWon, T.them, '6:0'])
  assert.equal(banner()[0].color, inst().colors[1].text)
  w.tick(3100)
  assert.equal(inst().bannerOn, false, 'gone after 3 s')
  games(0, 6) // WIR 6:0
  assert.deepEqual(bannerTexts(), [T.setWon, T.us, '6:0'])
  assert.equal(banner()[0].color, inst().colors[0].text)
})

test('banner: a tap closes it without counting a point; the won match says SIEG', () => {
  w.launch()
  startMatch()
  games(0, 5)
  points(0, 3)
  w.tapAt(60, CARD_Y[0] + 90) // 6:0
  w.tick(200)
  assert.equal(inst().bannerOn, true)
  w.tapAt(60, CARD_Y[1] + 90) // closes it, no point for DIE
  assert.equal(inst().bannerOn, false)
  assert.equal(pointText(1), '0')
  w.tapAt(60, CARD_Y[1] + 90) // right after: still no point
  assert.equal(pointText(1), '0')
  w.tick(500)
  tapTeam(1)
  assert.equal(pointText(1), '15')
  points(1, 3)
  games(0, 5)
  points(0, 3)
  w.tapAt(60, CARD_Y[0] + 90) // 6:0 6:1
  assert.deepEqual(bannerTexts(), [T.win, T.us, '6:1'])
  w.press(T.undo)
  assert.equal(inst().bannerOn, false, 'undo closes it')
})

test('"Rückgängig" after the last point brings the match back', () => {
  w.launch()
  startMatch()
  games(0, 12)
  w.press(T.undo)
  assert.equal(won(0), false)
  assert.equal(pointText(0), '40')
  tapTeam(0)
  assert.ok(won(0))
})

test('the edge bar shows who serves and from which side', () => {
  w.launch()
  startMatch(1)
  // [left, right] edge bar of a card, as the player sees it
  const lit = (t) => team(t).edges.map((b) => b.w.props.visible && b.w.props.color === 0xd4f53c)
  assert.deepEqual(lit(0), [false, false])
  assert.deepEqual(lit(1), [true, false]) // opponents serve from their right = player's left
  tapTeam(0)
  assert.deepEqual(lit(1), [false, true])
  games(1, 1) // next game: own team serves
  assert.deepEqual(lit(1), [false, false])
  assert.deepEqual(lit(0), [false, true]) // own team serves from the right
  tapTeam(0)
  assert.deepEqual(lit(0), [true, false])
})

// "Zufall" on the serve page brings up the racket, "Drehen" spins it: it stops pointing at a team, and that team serves.
// Every frame starts the next timer, so the clock runs in frame steps.
const run = (ms) => {
  for (let t = 0; t < ms; t += 40) w.tick(40)
}
for (const [random, server, angle] of [
  [0.2, 0, 180],
  [0.8, 1, 0],
]) {
  test(`racket spin picks the first server (team ${server})`, (ctx) => {
    ctx.mock.method(Math, 'random', () => random)
    w.launch()
    w.press(T.newGame)
    assert.equal(w.url, 'page/serve')
    assert.ok(!w.widgets.some((x) => x.type === 'IMG'), 'no racket before "Zufall"')
    w.press(T.random)
    const racket = inst().racket
    assert.equal(racket.props.visible, true)
    assert.equal(racket.props.angle, 0, 'racket waits head up')
    assert.ok(w.has(T.spin) && !w.has(T.random))
    run(1000)
    assert.equal(racket.props.angle, 0, 'no spin before "Drehen"')
    w.press(T.spin)
    run(1000)
    assert.equal(w.url, 'page/serve', 'still spinning')
    w.tapAt(195, 160) // taps on a card while spinning do nothing
    w.press(T.spin)
    assert.equal(w.url, 'page/serve')
    run(1500)
    assert.equal(racket.props.angle, angle)
    assert.ok(w.has(T.serveFor.replace('{name}', server === 0 ? T.us : T.them)))
    run(1500)
    assert.equal(w.url, 'page/match')
    assert.equal(inst().state.server, server)
  })
}

test('"Abbrechen" during the racket spin goes back and leaves no timer', () => {
  w.launch()
  w.press(T.newGame)
  w.press(T.random)
  w.press(T.spin)
  run(500)
  w.press(T.cancel)
  assert.equal(w.url, 'page/start')
  w.tick(5000)
  assert.equal(w.url, 'page/start')
})

test('heart rate: "--" until the sensor has a value; option "Aus" leaves the sensor off', () => {
  w.launch()
  startMatch()
  assert.ok(w.has('--'))
  w.heartRate(142)
  assert.ok(w.has('142'))
  w.press(T.end) // nothing played: leaves at once
  assert.equal(w.zos.hr.listeners.length, 0)
  openOptions()
  option(T.optHr)
  w.press(T.done)
  const before = w.zos.hr.created
  startMatch()
  assert.equal(w.zos.hr.created, before)
  assert.equal(w.has('--'), false)
})

test('"Display im Match": "Immer an" keeps the screen lit and gives it back afterwards', () => {
  w.launch()
  startMatch()
  assert.ok(w.zos.display.dropWristPaused && w.zos.display.palmPaused)
  assert.ok(w.zos.display.brightTime > 0)
  w.press(T.end)
  assert.equal(w.zos.display.dropWristPaused, false)
  openOptions()
  option(T.optScreen)
  assert.ok(w.has(T.screenAuto))
  w.press(T.done)
  startMatch()
  assert.equal(w.zos.display.dropWristPaused, false)
})

test('the match duration counts whole minutes', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.tick(61 * 60000)
  assert.ok(w.has('1:01'))
})

test('team names: short ones big, long ones smaller but whole, never below 16 px', () => {
  for (const name of ['WIR', 'MARIA', 'WWWWWWWW', 'MMMMMMMM', 'Iiiiiiii']) {
    w.done()
    w = new Watch()
    w.files.set('cfg.json', JSON.stringify({ names: [name, ''] }))
    w.launch()
    startMatch()
    const label = team(0).name.w.props
    assert.equal(label.text, name)
    assert.ok(label.text_size >= 16 && label.text_size <= 24)
    assert.ok(getTextLayout(name, { text_size: label.text_size }).width <= label.w)
    if (name === 'WIR') assert.equal(label.text_size, 24)
  }
})

// ---- leaving and coming back ----

test('"Ende" first asks; "Rückgängig" turns into "Verlassen" for 3 seconds', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.press(T.end)
  assert.ok(w.has(T.endConfirm) && w.has(T.leave))
  w.tick(3100)
  assert.ok(w.has(T.end) && w.has(T.undo))
  assert.equal(w.url, 'page/match')
})

test('"Ende" twice files an unfinished match as abandoned', () => {
  w.launch()
  startMatch()
  games(0, 2)
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.url, 'page/start')
  assert.equal(log()[0].abandoned, true)
  assert.equal(w.files.has('match.json'), false)
  w.press(T.history)
  assert.ok(w.has(T.abandoned))
  assert.ok(w.has('2:0'))
})

test('"Ende" at 0:0 leaves at once and keeps nothing', () => {
  w.launch()
  startMatch()
  w.press(T.end)
  assert.equal(w.url, 'page/start')
  assert.equal(log().length, 0)
  assert.equal(w.files.has('match.json'), false)
})

test('"Verlassen" goes back to the start page; "Weiter" continues the same match with undo', () => {
  w.launch()
  startMatch()
  games(0, 1)
  points(1, 2)
  w.press(T.end).press(T.leave)
  assert.equal(w.url, 'page/start')
  assert.ok(w.has(T.resume))
  w.press(T.resume)
  assert.deepEqual([gamesText(0), pointText(1)], ['1', '30'])
  w.press(T.undo)
  assert.equal(pointText(1), '15')
})

test('"Neues Spiel" over an open match asks first and files the old one', () => {
  w.launch()
  startMatch()
  games(1, 1)
  w.press(T.end).press(T.leave)
  w.press(T.newGame)
  assert.ok(w.has(T.endOld))
  assert.equal(w.url, 'page/start')
  w.tick(3100)
  assert.ok(w.has(T.newGame))
  startMatch()
  assert.equal(log().length, 1)
  assert.equal(log()[0].abandoned, true)
  assert.equal(pointText(0), '0')
})

test('a won match that was never ended goes to the history on the next start', () => {
  w.launch()
  startMatch()
  games(0, 12)
  w.closeApp() // e.g. the battery ran out
  w.launch()
  assert.equal(w.has(T.resume), false)
  assert.equal(log().length, 1)
  assert.equal(log()[0].winner, 0)
})

test('waking the watch: back into the match during it, the watch face after it', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.screenOff(15000)
  assert.equal(w.url, 'page/match')
  assert.equal(pointText(0), '15')
  w.press(T.end).press(T.endConfirm)
  w.screenOff(5000) // back within 10 s: the app is still there
  assert.equal(w.url, 'page/start')
  w.screenOff(15000)
  assert.equal(w.url, 'watchface')
})

test('after "Verlassen" the next app start has no wake-up relaunch left over', () => {
  w.launch()
  startMatch()
  tapTeam(0)
  w.press(T.end).press(T.leave)
  assert.equal(w.zos.relaunch, false)
})

// ---- options ----

test('every option is saved and survives an app restart', () => {
  w.launch()
  openOptions()
  option(T.optMode) // golden
  option(T.optSets) // 1 set
  option(T.optDecider) // no tiebreak
  option(T.optColor0, 2) // green → pink (blue is skipped)
  option(T.optColor1, 2) // blue → purple (pink is skipped)
  option(T.optSwitch) // off
  option(T.optHr) // off
  option(T.optScreen) // auto
  w.press(T.done)
  w.key('back')
  assert.equal(w.url, 'watchface')
  w.launch()
  openOptions()
  for (const t of [T.golden, T.oneSet, T.deciderNoTb, T.pink, T.purple, T.switchOff, T.hrOff, T.screenAuto]) {
    assert.ok(w.has(t), t)
  }
})

test('team colors reach the match and the history', () => {
  w.launch()
  openOptions()
  option(T.optColor0) // orange (blue belongs to team 2)
  w.press(T.done)
  startMatch()
  assert.equal(team(0).name.w.props.color, 0xffa24c)
  games(0, 12)
  w.press(T.end).press(T.history)
  assert.equal(w.find('Sieg Wir').props.color, 0xffa24c)
})

test('a color card skips the color of the other team', () => {
  w.launch()
  openOptions()
  for (let i = 0; i < 20; i++) {
    option(i % 3 ? T.optColor0 : T.optColor1)
    const [a, b] = saved('cfg').colors
    assert.notEqual(a, b)
  }
})

test('after "Verlassen": new names and colors count in the open match, new rules only in the next', () => {
  w.launch()
  openOptions()
  assert.equal(w.has(T.rulesLater), false, 'no hint without an open match')
  w.press(T.done)
  startMatch()
  points(0, 3)
  w.press(T.end).press(T.leave)
  openOptions()
  assert.ok(w.has(T.rulesLater))
  option(T.optMode) // golden point, for the next match
  option(T.optColor0) // orange
  w.press(T.optName0).type('Toni')
  w.press(T.done).press(T.resume)
  assert.equal(team(0).name.w.props.text, 'Toni')
  assert.equal(team(0).name.w.props.color, 0xffa24c)
  points(1, 3)
  assert.equal(hint(), T.deuce, 'still advantage scoring')
  w.press(T.end).press(T.endConfirm)
  assert.deepEqual(
    [log()[0].names, log()[0].colors],
    [
      ['Toni', ''],
      [2, 1],
    ],
  )
  startMatch()
  points(0, 3)
  points(1, 3)
  assert.notEqual(hint(), T.deuce, 'new match uses golden point')
  assert.equal(inst().state.cfg.mode, 'golden')
})

test('short sets: option "Spiele pro Satz" 4, tiebreak at 4:4, the match is won 4:0 5:4', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.games6))
  option(T.optGames)
  assert.ok(w.has(T.games4))
  assert.equal(saved('cfg').games, 4)
  w.press(T.done)
  startMatch()
  games(0, 3)
  assert.equal(gamesText(0), '3')
  games(0, 1) // 4:0 → set
  assert.deepEqual(setTexts(0), ['4'])
  assert.equal(gamesText(0), '0')
  for (let i = 0; i < 4; i++) {
    games(0, 1)
    games(1, 1)
  }
  w.tick(6000)
  assert.equal(hint(), T.tiebreak, '4:4 → tiebreak')
  points(0, 7)
  assert.ok(won(0))
  assert.equal(saved('match').state.cfg.games, 4, 'the match keeps its set length')
  w.press(T.end).press(T.history)
  assert.ok(w.has('4:0  5:4'))
})

test('short sets: changing "Spiele pro Satz" after "Verlassen" counts only from the next match', () => {
  w.launch()
  startMatch()
  games(0, 2)
  w.press(T.end).press(T.leave)
  openOptions()
  option(T.optGames)
  w.press(T.done).press(T.resume)
  games(0, 2) // 4:0 is no set in a normal match
  assert.deepEqual(setTexts(0), [])
  assert.equal(gamesText(0), '4')
})

test('a match saved before "Spiele pro Satz" existed still plays 6-game sets', () => {
  w.files.set(
    'match.json',
    JSON.stringify({
      state: {
        cfg: { mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0, names: ['', ''], colors: [0, 1] },
        startedAt: 1,
        endedAt: null,
      },
      moves: Array(16).fill(0),
    }),
  )
  w.launch()
  w.press(T.resume)
  assert.equal(gamesText(0), '4')
  assert.deepEqual(setTexts(0), [])
})

test('team names via the keyboard: trimmed, at most 8 characters, empty = default', () => {
  w.launch()
  openOptions()
  assert.ok(w.has('WIR (Standard)'))
  w.press(T.optName0).type('  Maria  ')
  assert.ok(w.has('Maria'))
  w.press(T.optName1).type('Superlangername')
  assert.ok(w.has('Superlan'))
  w.press(T.optName1).type(null) // cancel keeps the name
  assert.ok(w.has('Superlan'))
  w.press(T.optName0).type('')
  assert.ok(w.has('WIR (Standard)'))
  assert.deepEqual(saved('cfg').names, ['', 'Superlan'])
  w.press(T.done)
  w.press(T.newGame)
  assert.ok(w.has('Superlan'))
})

test('team names: a long press restores the default, a short tap still opens the keyboard', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.holdName))
  w.press(T.optName0).type('Maria')
  w.press(T.optName1).type('Pepe')
  w.hold('Maria')
  assert.ok(w.has('WIR (Standard)'))
  assert.equal(w.zos.keyboard, null)
  assert.deepEqual(w.zos.toasts, [T.nameReset])
  assert.deepEqual(saved('cfg').names, ['', 'Pepe'])
  w.hold('WIR (Standard)') // already the default: nothing happens
  assert.deepEqual(w.zos.toasts, [T.nameReset])
  w.scrollOn('Pepe') // scrolling the page over the card keeps the name
  w.slide('Pepe')
  assert.ok(w.has('Pepe'))
  w.press('Pepe').type('Pepa')
  assert.deepEqual(saved('cfg').names, ['', 'Pepa'])
})

test('a watch without keyboard shows a hint instead', () => {
  w.zos.noKeyboard = true
  w.launch()
  openOptions()
  w.press(T.optName0)
  assert.deepEqual(w.zos.toasts, [T.noKeyboard])
})

test('language: the page redraws at once, start follows, and the choice stays', () => {
  w.launch()
  openOptions()
  option(T.optLang) // auto → Deutsch
  assert.ok(w.has('Deutsch'))
  option(T.optLang) // → English
  assert.equal(w.url, 'page/options')
  assert.ok(w.has(STRINGS.en.options))
  w.press(STRINGS.en.done)
  assert.ok(w.has(STRINGS.en.newGame))
  w.key('back').launch()
  assert.ok(w.has(STRINGS.en.newGame))
})

test('"Wie die Uhr": German, English and Spanish watches get theirs, other languages English', () => {
  for (const [code, lang] of [
    [7, 'de'],
    [2, 'en'],
    [3, 'es'],
    [4, 'en'],
    [99, 'en'],
  ]) {
    w.done()
    w = new Watch()
    w.zos.language = code
    w.launch()
    assert.ok(w.has(STRINGS[lang].newGame), `language code ${code}`)
  }
})

test('options are left with "Fertig", a swipe right or the back key, always to a fresh start', () => {
  w.launch()
  for (const leave of [() => w.press(T.done), () => w.swipe('right'), () => w.key('back')]) {
    openOptions()
    leave()
    assert.equal(w.url, 'page/start')
  }
  assert.equal(w.log.filter((u) => u === 'page/start').length, 4)
})

test('renaming a team later does not change matches in the history', () => {
  w.files.set('cfg.json', JSON.stringify({ names: ['ANNA', ''] }))
  w.launch()
  playWonMatch(0)
  openOptions()
  w.press(T.optName0).type('BEA')
  w.press(T.done).press(T.history)
  assert.ok(w.has('Sieg ANNA'))
})

// ---- history ----

test('empty history: a note, no delete button', () => {
  w.launch().press(T.history)
  assert.ok(w.has(T.noMatches))
  assert.equal(w.has(T.clearLog), false)
  w.press(T.back)
  assert.equal(w.url, 'page/start')
})

test('history: newest first with date, mode, duration, sets and result', () => {
  w.launch()
  playWonMatch(0)
  w.tick(3600000)
  startMatch()
  games(1, 1)
  w.press(T.end).press(T.endConfirm)
  w.press(T.history)
  const t = w.texts()
  assert.ok(t.indexOf(T.abandoned) < t.indexOf('Sieg Wir'))
  assert.ok(t.includes('6:0  6:0'))
  assert.ok(t.includes('0:1'))
  assert.ok(
    t.some((x) => /^\d\d\.\d\d\. 1[89]:\d\d · Vorteil · 0:\d\d$/.test(x)),
    JSON.stringify(t),
  )
})

test('history shows 10 matches, "Ältere anzeigen" the rest, at most 30 are kept', () => {
  const entries = Array.from({ length: 34 }, (_, i) => ({
    startedAt: Date.parse('2026-10-01T10:00:00') + i * 3600000,
    endedAt: Date.parse('2026-10-01T10:30:00') + i * 3600000,
    mode: 'adv',
    names: ['', ''],
    colors: [0, 1],
    winner: 0,
    abandoned: false,
    sets: [{ g: [6, i % 5], tb: null, mtb: false }],
  }))
  w.files.set('log.json', JSON.stringify(entries.slice(0, 29).reverse()))
  w.launch()
  playWonMatch(0)
  assert.equal(log().length, 30)
  playWonMatch(0)
  assert.equal(log().length, 30)
  w.press(T.history)
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 10)
  w.zos.scrollTop = 700
  w.press('Ältere anzeigen (20)')
  assert.equal(w.texts().filter((x) => x.startsWith('Sieg ')).length, 30)
  assert.equal(w.zos.scrolledTo, -700)
})

test('history: hold to arm a card, tap again to delete it, the list stays in place', () => {
  w.launch()
  playWonMatch(0)
  playWonMatch(1)
  w.press(T.history)
  w.hold('Sieg Die')
  assert.ok(w.has(T.deleteEntry))
  w.zos.scrollTop = 120
  w.press(T.deleteEntry)
  assert.equal(log().length, 1)
  assert.equal(log()[0].winner, 0)
  assert.equal(w.has('Sieg Die'), false)
  assert.equal(w.zos.scrolledTo, -120)
})

test('history: an armed card falls back after 3 s, a short tap never deletes', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.press('Sieg Wir')
  assert.equal(w.has(T.deleteEntry), false)
  w.hold('Sieg Wir').tick(3100)
  assert.ok(w.has('Sieg Wir'))
  w.press('Sieg Wir')
  assert.equal(log().length, 1)
})

test('history: scrolling on an armed card does not delete it', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.hold('Sieg Wir')
  w.slide(T.deleteEntry, -80)
  assert.equal(log().length, 1)
})

test('history: scrolling the page over a card never arms or deletes it', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history)
  w.scrollOn('Sieg Wir')
  assert.equal(w.has(T.deleteEntry), false)
  w.scrollOn('Sieg Wir', -120, 80)
  assert.equal(log().length, 1)
  w.hold('Sieg Wir')
  w.scrollOn(T.deleteEntry, 120, 80)
  assert.equal(log().length, 1)
})

test('history: only one card is armed at a time', () => {
  w.launch()
  playWonMatch(0)
  playWonMatch(1)
  w.press(T.history)
  w.hold('Sieg Wir')
  w.hold('Sieg Die')
  assert.equal(w.texts().filter((x) => x === T.deleteEntry).length, 1)
  assert.ok(w.has('Sieg Wir'))
})

test('"Verlauf löschen" needs a second tap within 3 s', () => {
  w.launch()
  playWonMatch(0)
  w.press(T.history).press(T.clearLog)
  assert.ok(w.has(T.clearConfirm))
  w.tick(3100)
  assert.ok(w.has(T.clearLog))
  assert.equal(log().length, 1)
  w.press(T.clearLog).press(T.clearConfirm)
  assert.ok(w.has(T.noMatches))
  assert.equal(w.files.has('log.json'), false)
})

// ---- storage problems and damaged files ----

test('storage full during a match: points go on, one notice', () => {
  w.launch()
  startMatch()
  w.full = true
  points(0, 5)
  assert.equal(gamesText(0), '1')
  assert.deepEqual(w.zos.toasts, [T.saveFailed])
})

test('storage full at "Ende": the match is kept for "Weiter" and filed once there is room', () => {
  w.launch()
  startMatch()
  games(0, 1)
  w.full = true
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.saveFailed))
  assert.ok(w.has(T.resume))
  w.full = false
  w.press(T.resume).press(T.end).press(T.endConfirm)
  assert.equal(log().length, 1)
  assert.equal(w.has(T.resume), false)
})

test('storage full at "Neues Spiel": the old match is not overwritten', () => {
  w.launch()
  startMatch()
  games(0, 1)
  w.press(T.end).press(T.leave)
  w.full = true
  w.press(T.newGame).press(T.endOld)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.saveFailed))
  assert.equal(saved('match').moves.length, 4)
})

test('storage full on the serve page: no match starts, one notice, it works once there is room', () => {
  w.launch()
  w.press(T.newGame)
  w.full = true
  w.tapAt(195, 300)
  assert.equal(w.url, 'page/serve')
  assert.deepEqual(w.zos.toasts, [T.saveFailed])
  w.full = false
  w.tapAt(195, 300)
  assert.equal(w.url, 'page/match')
})

test('damaged files never crash the app', () => {
  for (const [key, value] of [
    ['match', '{"state": {"cfg": 5}}'],
    ['match', 'not json'],
    ['match', '[1, 2, 3]'],
    ['log', '{"a": 1}'],
    ['log', '[null, 5, {"startedAt": "x"}]'],
    ['log', '[{"startedAt": 1, "endedAt": 2, "mode": "adv", "winner": null, "abandoned": false, "sets": []}]'],
    ['cfg', '"text"'],
    ['cfg', '{"mode": "tennis", "colors": [99, -1], "names": [1, 2]}'],
  ]) {
    w.done()
    w = new Watch()
    w.files.set(`${key}.json`, value)
    w.launch()
    assert.equal(w.url, 'page/start', `${key}: ${value}`)
    w.press(T.history)
    w.press(T.back)
    openOptions()
    w.press(T.done)
    startMatch()
    tapTeam(0)
    assert.equal(pointText(0), '15')
  }
})

test('"Weiter" rebuilds the score from the saved points, even if the saved score is wrong', () => {
  w.launch()
  startMatch()
  points(0, 2)
  w.press(T.end).press(T.leave)
  const m = saved('match')
  m.state.points = [3, 3]
  w.files.set('match.json', JSON.stringify(m))
  w.closeApp()
  w.launch().press(T.resume)
  assert.equal(pointText(0), '30')
})

// ---- court time ----

test('court time: clock button, suggestion, - / +, reminder choice, two alarms, end time on start', () => {
  w.launch()
  openCourt()
  assert.equal(courtTime(), '19:30', 'next half hour + 1 hour (it is 18:00)')
  assert.equal(w.has(T.courtClear), false)
  w.press('+', 0) // hours +
  w.press('-', 1) // minutes -5
  assert.equal(courtTime(), '20:25')
  w.press('-', 0)
  w.press('-', 0)
  w.press('+', 1)
  w.press('+', 1)
  assert.equal(courtTime(), '18:35')
  assert.ok(w.has(T.courtWarn.replace('{n}', 5)))
  w.press(T.courtWarn.replace('{n}', 5))
  assert.ok(w.has(T.courtWarn.replace('{n}', 10)))
  w.press(T.courtSave)
  assert.equal(w.url, 'page/start')
  assert.ok(w.zos.toasts.includes(T.courtSaved))
  assert.deepEqual(
    w.zos.alarms.map((a) => [a.url, a.time, a.store]),
    [
      ['page/courtAlert', at(18, 25), true],
      ['page/courtAlert', at(18, 35), true],
    ],
  )
  assert.ok(w.has('18:35'), 'end time below the clock button')
  assert.deepEqual(saved('court').warn, 10)
})

test('court time: reminder and end open the alert page, also from a closed app; OK goes back to the match', () => {
  w.launch()
  openCourt()
  w.press(T.courtSave) // 19:30, reminder 19:25
  startMatch()
  points(0, 2)
  w.zos.vibes.length = 0
  w.tick(85 * 60000) // 19:25 and a bit
  assert.equal(w.alarmsDue(), 1)
  assert.equal(w.url, 'page/courtAlert')
  assert.ok(w.has(T.courtLeft.replace('{n}', 5)) || w.has(T.courtLeft.replace('{n}', 4)))
  assert.ok(w.has(T.courtUntil.replace('{t}', '19:30')))
  assert.ok(w.zos.vibes.length > 0, 'it vibrates')
  w.press(T.ok)
  assert.equal(w.url, 'page/match')
  assert.equal(pointText(0), '30', 'the match goes on')
  w.press(T.end).press(T.leave)
  w.closeApp()
  w.tick(6 * 60000)
  assert.equal(w.alarmsDue(), 1)
  assert.equal(w.url, 'page/courtAlert', 'the app starts for the end')
  assert.ok(w.has(T.courtOver))
  w.press(T.ok)
  assert.equal(w.url, 'page/match', 'open match: back into it')
  w.press(T.end).press(T.leave)
  assert.equal(w.has('19:30'), false, 'no end time after it is over')
})

test('court time: "Löschen" removes the alarms; swipe right leaves without saving', () => {
  w.launch()
  openCourt()
  w.press(T.courtSave)
  openCourt()
  assert.equal(courtTime(), '19:30', 'the saved time')
  w.press('+', 0)
  w.swipe('right')
  assert.equal(w.url, 'page/start')
  assert.ok(w.has('19:30'), 'not changed')
  openCourt()
  w.press(T.courtClear)
  assert.deepEqual(w.zos.alarms, [])
  assert.ok(w.zos.toasts.includes(T.courtCleared))
  assert.equal(w.has('19:30'), false)
  assert.equal(saved('court').end, null)
})

test('court time: a time that has passed today means tomorrow', () => {
  w.launch()
  openCourt()
  for (let i = 0; i < 2; i++) w.press('-', 0) // 17:30
  assert.equal(courtTime(), '17:30')
  w.press(T.courtSave)
  assert.equal(w.zos.alarms.at(-1).time, at(17, 30, 1))
})

test('court time: a reminder that would already be due is left out, the end alarm stays', () => {
  w.launch()
  openCourt()
  w.press('-', 0) // 18:30
  for (let i = 0; i < 5; i++) w.press('-', 1) // 18:05, it is 18:00
  assert.equal(courtTime(), '18:05')
  w.press(T.courtSave) // reminder 5 min before = now
  assert.deepEqual(
    w.zos.alarms.map((a) => a.time),
    [at(18, 5)],
  )
})

test('court time: the watch refusing the alarm says so', () => {
  w.zos.alarmFails = true
  w.launch()
  openCourt()
  w.press(T.courtSave)
  assert.ok(w.zos.toasts.includes(T.courtFailed))
})

// ---- languages and layout ----

const keys = new Set(Object.keys(T))

// Visits every page (and the match in its main states) and collects the texts on screen.
function tour(L) {
  const seen = []
  const look = () => seen.push(...w.texts().map((t) => [w.url, t]))
  w.launch()
  look()
  openDiag()
  look()
  w.key('back').key('back')
  w.press(L.options)
  look()
  w.swipe('right')
  openCourt()
  look()
  w.press(L.courtSave)
  look()
  w.tick(85 * 60000) // 19:25, the reminder
  w.alarmsDue()
  look()
  w.press(L.ok)
  w.press(L.newGame)
  look()
  w.tapAt(195, 300)
  look()
  points(0, 3)
  points(1, 3)
  look()
  games(0, 12)
  look()
  w.tick(6000)
  look()
  w.press(L.end)
  w.press(L.history)
  look()
  w.hold(w.texts().find((t) => t.includes('6:0')))
  look()
  return seen
}

for (const lang of ['de', 'en', 'es']) {
  test(`${lang}: every page shows real texts, nothing missing or untranslated`, () => {
    w.files.set('cfg.json', JSON.stringify({ lang }))
    const seen = tour(STRINGS[lang])
    for (const [url, t] of seen) {
      assert.ok(!keys.has(t), `${url}: raw key "${t}"`)
      assert.ok(!/\{\w+\}/.test(t), `${url}: placeholder in "${t}"`)
      assert.ok(!/undefined|NaN|null/.test(t), `${url}: "${t}"`)
    }
    if (lang !== 'de') {
      const german = new Set(
        Object.entries(T)
          .filter(([k, v]) => STRINGS[lang][k] !== v)
          .map(([, v]) => v),
      )
      const left = seen.filter(([, t]) => german.has(t))
      assert.deepEqual(left, [], 'German text in another language')
    }
  })
}

// Pages that do not scroll must fit the screen; scrolling pages must fit its width.
test('layout: every widget on every page stays on the screen', () => {
  const check = () => {
    const scrolls = ['page/options', 'page/history', 'page/diag'].includes(w.url)
    for (const x of w.visible()) {
      const p = x.props
      const b =
        x.type === 'CIRCLE'
          ? { x: p.center_x - p.radius, y: p.center_y - p.radius, w: 2 * p.radius, h: 2 * p.radius }
          : p
      const where = `${w.url} ${x.type} "${p.text || ''}" ${JSON.stringify(b)}`
      assert.ok(b.x >= 0 && b.x + b.w <= SCREEN.w, where)
      if (!scrolls) assert.ok(b.y >= 0 && b.y + b.h <= SCREEN.h, where)
    }
  }
  w.launch()
  check()
  openDiag()
  check()
  w.press(T.back)
  check()
  w.press(T.back)
  openCourt()
  check()
  w.press(T.courtSave)
  check()
  w.tick(85 * 60000)
  w.alarmsDue()
  check()
  w.press(T.ok)
  openCourt()
  check()
  w.swipe('right')
  openOptions()
  check()
  w.press(T.done).press(T.newGame)
  check()
  w.tapAt(195, 300)
  check()
  games(0, 12)
  check()
  w.press(T.end).press(T.history)
  check()
})

test('third set without tiebreak: two-digit games (12:10) fit on the card, the banner and in the history', () => {
  w.files.set('cfg.json', JSON.stringify({ decider: 'noTb', pause: 'off' }))
  const tooWide = []
  const check = () => {
    for (const x of w.visible()) {
      const p = x.props
      if (x.type !== 'TEXT' || !p.text) continue
      const wide = getTextLayout(p.text, { text_size: p.text_size }).width
      if (wide > p.w) tooWide.push(`${w.url} "${p.text}" ~${Math.round(wide)}/${p.w} px`)
    }
  }
  w.launch()
  startMatch()
  games(0, 6)
  games(1, 6)
  for (let i = 0; i < 10; i++) games(i % 2, 1) // 5:5
  games(0, 1)
  games(1, 1) // 6:6: no tiebreak in the third set
  w.tick(6000) // the change of ends from 6:5 fades
  assert.equal(hint(), '')
  assert.equal(pointText(0), '0')
  for (let i = 0; i < 8; i++) games(i % 2, 1) // 10:10
  assert.deepEqual([gamesText(0), gamesText(1)], ['10', '10'])
  check()
  games(0, 1) // 11:10, no set yet
  assert.equal(won(0), false)
  games(0, 1) // 12:10
  assert.ok(won(0))
  assert.deepEqual(setTexts(0), ['6', '0', '12'])
  assert.deepEqual(setTexts(1), ['0', '6', '10'])
  assert.ok(w.has('12:10'), 'banner score')
  check()
  w.tick(4000)
  w.press(T.end).press(T.history)
  assert.ok(w.has('6:0  0:6  12:10'))
  check()
  assert.deepEqual(tooWide, [])
})

// One-line texts must fit their widget at its text size (widths estimated like a watch font).
// Names of the 8 colors and the history lines are checked too, via the tour.
for (const lang of ['de', 'en', 'es']) {
  test(`${lang}: every text fits its box`, () => {
    w.files.set('cfg.json', JSON.stringify({ lang, mode: 'star', names: ['WWWWWWWW', 'MMMMMMMM'] }))
    w.zos.hour12 = true // "pm" makes the history lines longest
    const L = STRINGS[lang]
    const tooWide = []
    const check = () => {
      for (const x of w.visible()) {
        const p = x.props
        if (!['TEXT', 'BUTTON'].includes(x.type) || !p.text || p.text_style === 1) continue
        const wide = getTextLayout(p.text, { text_size: p.text_size }).width
        if (wide > p.w) tooWide.push(`${w.url} "${p.text}" ~${Math.round(wide)}/${p.w} px`)
      }
    }
    w.launch()
    check()
    openDiag()
    check()
    w.key('back').key('back').press(L.options)
    check()
    for (let i = 0; i < 7; i++) {
      w.press(L.optColor0)
      check()
    }
    w.press(L.done).press(L.newGame)
    check()
    w.tapAt(195, 300)
    points(0, 3)
    points(1, 3)
    check()
    w.tick(6000)
    games(0, 12)
    w.tick(6000)
    check()
    w.press(L.end) // won: files it at once
    w.press(L.newGame).tapAt(195, 300)
    games(1, 1)
    w.press(L.end)
    check()
    w.press(L.leave)
    check()
    w.press(L.newGame)
    check()
    w.tick(3100).press(L.history)
    check()
    w.hold(L.winner.replace('{name}', 'WWWWWWWW'))
    check()
    w.tick(3100).press(L.clearLog)
    check()
    assert.deepEqual(tooWide, [])
  })
}
