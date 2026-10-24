// Training: "Bis Ziel" and Americano.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { px } from '../mock/zos.mjs'
import {
  T,
  w,
  inst,
  team,
  gamesText,
  hint,
  won,
  saved,
  log,
  points,
  games,
  startMatch,
  openTraining,
} from './helpers.mjs'

// ---- training ----

const BALL = 0xd4f53c
const ball = () => inst().ball && inst().ball.w.props
// The training's tile: the number and the caption below it.
const tile = (t) => [gamesText(t), team(t).caption.w.props.text]

test('training: cone → "Bis Ziel" 21 → serve → points only; NOCH tile, ball, bar, colors as names', () => {
  w.launch()
  openTraining()
  for (const t of [T.trainKind, T.race, T.trainPoints, '21', T.trainRule]) assert.ok(w.has(t), t)
  assert.ok(w.has(T.trainCap.replace('{n}', '25')))
  assert.ok(!w.has(T.trainServe), 'no serve card for "Bis Ziel"')
  w.press(T.go)
  assert.equal(w.url, 'page/serve')
  assert.ok(w.has('GRÜN') && w.has('BLAU'), 'the teams are called by their colors')
  w.tapAt(195, 300)
  assert.equal(w.url, 'page/match')
  assert.equal(team(0).name.w.props.text, 'GRÜN')
  assert.equal(team(1).name.w.props.text, 'BLAU')
  assert.deepEqual(tile(0), ['21', T.toGo])
  assert.deepEqual(tile(1), ['21', T.toGo])
  assert.equal(hint(), T.trainTo.replace('{n}', '21'))
  // own team serves: the ball on its card, no side bars; it changes after 1, then every 2 points
  assert.equal(ball().visible, true)
  assert.equal(ball().y, team(0).y + px(66))
  assert.ok(team(0).edges.every((e) => !e.w.props.visible))
  points(1, 1)
  assert.equal(ball().y, team(0).y + px(66))
  points(1, 1)
  assert.equal(ball().y, team(1).y + px(66))
  points(1, 13)
  points(0, 20) // 20:15
  assert.deepEqual(tile(0), ['1', T.toGo])
  assert.deepEqual(tile(1), ['7', T.toGo])
  assert.equal(team(0).tile.w.props.color, BALL)
  assert.notEqual(team(1).tile.w.props.color, BALL)
  assert.equal(hint(), T.matchBall.replace('{name}', 'GRÜN'))
  const [track, fill] = team(0).bars
  assert.equal(track.w.props.w, px(232))
  assert.ok(Math.abs(fill.w.props.w - Math.round((px(232) * 20) / 21)) <= 1)
  assert.equal(fill.w.props.color, 0x5ee08a)
  points(0, 1)
  assert.ok(won(0))
  assert.ok(inst().bannerOn)
  assert.equal(ball().visible, false)
  assert.equal(team(0).tile.w.props.visible, false)
  w.press(T.end)
  assert.equal(w.url, 'page/start')
  const [entry] = log()
  assert.equal(entry.target, 21)
  assert.equal(entry.winner, 0)
  w.press(T.history)
  assert.ok(w.has('21:15'))
  assert.ok(w.has(T.winner.replace('{name}', 'Grün')))
  assert.ok(w.texts().some((t) => t.includes(T.trainTo.replace('{n}', '21'))))
})

test('training: no change of ends, no break and no announcement, whatever the options say', () => {
  w.files.set('cfg.json', JSON.stringify({ sides: 'fip', pause: 'on', voice: 'on' }))
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  assert.equal(inst().voice, null)
  for (let i = 0; i < 12; i++) {
    points(i % 2, 1)
    assert.ok(![T.switchSides].includes(hint()) && !hint().startsWith('Pause'), hint())
  }
})

test('training: the settings are remembered; the type changes the cards; cancel, swipe and back key return', () => {
  w.launch()
  openTraining()
  w.press(T.trainPoints) // 21 → 7
  assert.ok(w.has('7'))
  assert.ok(w.has(T.trainCap.replace('{n}', '9')), 'the cap line follows the target')
  w.press(T.cancel)
  assert.equal(w.url, 'page/start')
  assert.equal(saved('cfg').trainTo, 7)
  openTraining()
  assert.ok(w.has('7'))
  w.press(T.trainKind)
  assert.equal(w.url, 'page/training')
  for (const t of [T.americano, T.trainTotal, '24', T.trainServe, T.serveEvery.replace('{n}', '4')])
    assert.ok(w.has(t), t)
  assert.ok(w.has(T.trainAmericanoRule.replace('{n}', '24')))
  w.press(T.trainTotal) // 24 → 32
  assert.ok(w.has(T.trainAmericanoRule.replace('{n}', '32')))
  openTraining.call(null, w.swipe('right'))
  assert.equal(saved('cfg').trainKind, 'americano')
  assert.ok(w.has('32'))
  w.key('back')
  assert.equal(w.url, 'page/start')
})

test("Americano: the server's serves left and the other team's next turn; it can end level", () => {
  w.files.set('cfg.json', JSON.stringify({ trainKind: 'americano', trainTotal: 16, trainServe: 4 }))
  w.launch()
  openTraining().press(T.go)
  w.tapAt(195, 160) // the opponents serve first
  assert.equal(w.url, 'page/match')
  assert.deepEqual(tile(1), ['4', T.serves])
  assert.deepEqual(tile(0), ['4', T.servesNext])
  assert.equal(team(0).games.w.props.color, 0x4f565d, 'the next turn is dimmed')
  assert.equal(hint(), T.pointsLeft.replace('{n}', '16'))
  assert.equal(ball().y, team(1).y + px(66))
  points(0, 3)
  assert.deepEqual(tile(1), ['1', T.serves])
  points(1, 1) // 3:1, own team's turn now
  assert.deepEqual(tile(0), ['4', T.serves])
  assert.deepEqual(tile(1), ['4', T.servesNext])
  assert.equal(ball().y, team(0).y + px(66))
  points(0, 5)
  points(1, 6) // 8:7
  assert.equal(hint(), T.lastPoint)
  // points 13–16 are the own team's turn; nobody serves after it
  assert.deepEqual(tile(0), ['1', T.serves])
  assert.deepEqual(tile(1), ['–', T.servesNext])
  points(1, 1) // 8:8
  assert.equal(inst().state.winner, -1)
  assert.ok(inst().bannerOn)
  assert.ok(w.has(T.draw.toUpperCase()) && w.has('8:8'))
  assert.ok(!won(0) && !won(1))
  w.press(T.end)
  const [entry] = log()
  assert.equal(entry.total, 16)
  assert.equal(entry.winner, -1)
  assert.equal(entry.abandoned, false)
  w.press(T.history)
  assert.ok(w.has(T.draw))
  assert.ok(w.texts().some((t) => t.includes(T.americanoN.replace('{n}', '16'))))
  assert.ok(w.has('8:8'))
})

test('Americano: undo after the end brings the score back', () => {
  w.files.set('cfg.json', JSON.stringify({ trainKind: 'americano', trainTotal: 16 }))
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  points(0, 9)
  points(1, 7)
  assert.equal(inst().state.winner, 0)
  w.tapAt(195, 222) // the banner
  w.tick(400)
  w.press(T.undo)
  assert.equal(inst().state.winner, null)
  assert.deepEqual(inst().state.points, [9, 6])
  assert.equal(ball().visible, true)
  assert.equal(hint(), T.lastPoint)
})

test('training with an open match: the hint says so, "Los" files the match as abandoned', () => {
  w.launch()
  startMatch()
  points(0, 2)
  w.press(T.end).press(T.leave)
  openTraining()
  assert.ok(w.has(T.trainEndsOld))
  w.press(T.go)
  assert.equal(log().length, 1)
  assert.equal(log()[0].abandoned, true)
  w.tapAt(195, 160)
  assert.equal(w.url, 'page/match')
  assert.equal(inst().state.cfg.target, 21)
  assert.equal(inst().state.server, 1)
})

test('a normal match after a training counts games and sets again, with the team names', () => {
  w.files.set('cfg.json', JSON.stringify({ names: ['Toni', ''], trainTo: 7 }))
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  assert.equal(team(0).name.w.props.text, 'GRÜN')
  points(0, 7)
  w.press(T.end)
  startMatch()
  assert.equal(inst().state.cfg.target, undefined)
  assert.equal(team(0).name.w.props.text, 'Toni')
  assert.equal(team(0).tile.w.props.visible, true)
  assert.equal(inst().ball, undefined)
  games(0, 1)
  assert.equal(gamesText(0), '1')
})

test('a training survives closing the app: "Weiter" brings it back, "Ende" files it as abandoned', () => {
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  points(0, 5)
  points(1, 3)
  w.closeApp()
  w.launch()
  assert.ok(w.has(T.resume))
  w.press(T.resume)
  assert.equal(w.url, 'page/match')
  assert.equal(team(0).name.w.props.text, 'GRÜN')
  assert.deepEqual(inst().state.points, [5, 3])
  assert.deepEqual(tile(0), ['16', T.toGo])
  assert.equal(ball().visible, true)
  assert.equal(hint(), T.trainTo.replace('{n}', '21'))
  w.press(T.end).press(T.endConfirm)
  assert.equal(w.url, 'page/start')
  const [entry] = log()
  assert.equal(entry.target, 21)
  assert.equal(entry.abandoned, true)
  w.press(T.history)
  assert.ok(w.has('5:3'))
  assert.ok(w.has(T.abandoned))
})
