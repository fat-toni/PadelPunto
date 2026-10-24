// The match screen: points, undo, taps, colors, banner, serve side, racket spin, heart rate.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getTextLayout, px } from '../mock/zos.mjs'
import {
  T,
  CARD_Y,
  GREEN_CARD,
  BLUE_CARD,
  w,
  inst,
  team,
  pointText,
  gamesText,
  won,
  saved,
  log,
  tapTeam,
  points,
  games,
  startMatch,
  option,
  openOptions,
  freshWatch,
} from './helpers.mjs'

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
  const card = w.page.widgets.find((x) => x.type === 'FILL_RECT' && x.props.y === px(CARD_Y[0]))
  assert.equal(card.props.color, GREEN_CARD)
})

test('team cards are tinted in the team colors, also on "Wer schlägt auf?"', () => {
  w.launch().press(T.newGame)
  const cardAt = (y) => w.page.widgets.find((x) => x.type === 'FILL_RECT' && x.props.y === px(y)).props.color
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
    freshWatch()
    w.files.set('cfg.json', JSON.stringify({ names: [name, ''] }))
    w.launch()
    startMatch()
    const label = team(0).name.w.props
    assert.equal(label.text, name)
    assert.ok(label.text_size >= px(16) && label.text_size <= px(24))
    assert.ok(getTextLayout(name, { text_size: label.text_size }).width <= label.w)
    if (name === 'WIR') assert.equal(label.text_size, px(24))
  }
})

test('a mistyped winning point can still be undone until "Ende" is tapped', () => {
  w.launch()
  startMatch()
  games(0, 11)
  points(0, 3) // 6:0 5:0 40:0
  points(0, 1)
  assert.ok(won(0))
  assert.equal(log().length, 0, 'not filed before "Ende"')
  w.tapAt(195, 222) // the banner
  w.tick(400)
  w.press(T.undo)
  assert.ok(!won(0))
  assert.equal(inst().state.winner, null)
  assert.equal(pointText(0), '40')
  assert.equal(gamesText(0), '5')
  points(1, 1)
  assert.equal(pointText(1), '15')
})
