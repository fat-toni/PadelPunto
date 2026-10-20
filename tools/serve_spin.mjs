// Records the racket spin on page/serve on the simulated watch (test/mock/watch.mjs) for the
// animated picture in the README: the visible widgets of every frame, as JSON on stdout.
// Each frame: { ms: how long it shows, tap: [x, y] tapped right after it (or null), widgets }.
// Usage: node --import ./test/mock/setup.mjs tools/serve_spin.mjs > frames.json
// (tools/readme_art.py runs this itself)
import { Watch } from '../test/mock/watch.mjs'

const FRAME_MS = 40 // page/serve.js FRAME_MS
const w = new Watch()
w.zos.language = 2 // English
Math.random = () => 0.1 // the racket picks the own team ("US")
w.launch()
w.press('New match')

const frames = []
const snap = (ms, tap = null) =>
  frames.push({ ms, tap, widgets: JSON.parse(JSON.stringify(w.visible().map(({ type, props }) => ({ type, props })))) })

const random = w.button('Random')
snap(1200, [random.props.x + random.props.w / 2, random.props.y + random.props.h / 2])
w.press('Random')
const spin = w.button('Spin')
snap(800, [spin.props.x + spin.props.w / 2, spin.props.y + spin.props.h / 2])
w.press('Spin')
while (w.url === 'page/serve' && !w.has('Serve: US')) {
  w.tick(FRAME_MS)
  snap(FRAME_MS)
}
frames[frames.length - 1].ms = 2000 // the result
process.stdout.write(JSON.stringify(frames))
w.done()
