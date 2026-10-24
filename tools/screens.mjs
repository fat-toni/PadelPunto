// Records screens of the simulated watch (test/mock/watch.mjs) for the README pictures that
// tools/readme_art.py draws: the start screen and a training at a match point, in English.
// Output: { name: visible widgets } as JSON on stdout.
// Usage: node --import ./test/mock/setup.mjs tools/screens.mjs > screens.json
// (tools/readme_art.py runs this itself)
import { Watch } from '../test/mock/watch.mjs'

const w = new Watch()
w.zos.language = 2 // English
const snap = () => JSON.parse(JSON.stringify(w.visible().map(({ type, props }) => ({ type, props }))))
const tap = (t, n) => {
  for (let i = 0; i < n; i++) w.tapAt(60, [238, 54][t] + 90).tick(200)
}

const screens = {}
w.launch()
screens.start = snap()

// Training to 21, own team (green) serves first: 20:17 is a match point for green.
w.tapAt(328, 123) // the cone
w.press('Start')
w.tapAt(195, 300)
w.heartRate(132)
tap(1, 6)
tap(0, 12)
tap(1, 11)
tap(0, 8)
w.tick(23 * 60000) // a training of about 20 minutes
screens.training = snap()

process.stdout.write(JSON.stringify(screens))
w.done()
