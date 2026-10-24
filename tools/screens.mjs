// Records screens of the simulated watch (test/mock/watch.mjs) for the README pictures that
// tools/readme_art.py draws, in English: the start screen, the options, the racket's pick on "Who serves
// first?", a match at a change of ends and a training at a match point.
// Output: { name: visible widgets } as JSON on stdout.
// Usage: node --import ./test/mock/setup.mjs tools/screens.mjs > screens.json
// (tools/readme_art.py runs this itself)
import { Watch } from '../test/mock/watch.mjs'

const FRAME_MS = 40 // page/serve.js FRAME_MS
const w = new Watch()
w.zos.language = 2 // English
Math.random = () => 0.1 // the racket picks the own team ("US")
const snap = () => JSON.parse(JSON.stringify(w.visible().map(({ type, props }) => ({ type, props }))))
// n points for team t; the banner after a won set is tapped away first, between the cards.
const tap = (t, n) => {
  for (let i = 0; i < n; i++) {
    if (w.page.inst.bannerOn) w.tapAt(195, 222).tick(400)
    w.tapAt(60, [238, 54][t] + 90).tick(200)
  }
}
const games = (t, n) => tap(t, 4 * n)

const screens = {}
w.launch()
screens.start = snap()

// The options, as they open (the top of the page).
w.press('Options')
screens.options = snap()
w.press('Done')

// The racket has stopped and points at the own team.
w.press('New match').press('Random').press('Spin')
while (!w.has('Serve: US')) w.tick(FRAME_MS)
screens.serve = snap()

// Second set: the own team won the first 6:4 and leads 2:1, change of ends, 30:15.
w.tick(1500)
w.heartRate(142)
games(0, 3)
games(1, 4)
games(0, 3)
games(0, 1)
games(1, 1)
w.tick(48 * 60000) // a match of about 50 minutes
games(0, 1)
tap(0, 2)
tap(1, 1)
screens.match = snap()

// Training to 21, own team (green) serves first: 20:17 is a match point for green.
w.press('End').press('Leave')
w.tapAt(328, 97) // the cone (with "Continue" on the start screen)
w.press('Start')
w.tapAt(195, 300)
tap(1, 6)
tap(0, 12)
tap(1, 11)
tap(0, 8)
w.tick(23 * 60000) // a training of about 20 minutes
screens.training = snap()

process.stdout.write(JSON.stringify(screens))
w.done()
