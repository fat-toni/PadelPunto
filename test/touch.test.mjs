// Run with: npm test (needs the @zos/ui stand-in from test/mock)
import { test, mock } from 'node:test'
import assert from 'node:assert/strict'
import { fakeWidget } from './mock/ui.mjs'
import { tappable, onTouch, MOVE_PX, TEAM_COLORS, fitText } from '../utils/theme.js'
import { COLOR_COUNT } from '../utils/config.js'

const DARK = 1
const LIT = 2

// A card with one text widget on top; returns the widgets and the number of counted taps.
function card() {
  const c = fakeWidget()
  const label = fakeWidget()
  const taps = { n: 0 }
  tappable(c, [label], DARK, LIT, () => taps.n++)
  return { c, label, taps }
}

test('a tap lights the card, counts once and darkens it again', () => {
  const { c, label, taps } = card()
  c.fire('down', { x: 100, y: 100 })
  assert.equal(c.props.color, LIT)
  c.fire('up')
  label.fire('up') // the text on top reports the same lift
  assert.equal(taps.n, 1)
  assert.equal(c.props.color, DARK)
})

test('small jitter still counts as a tap', () => {
  const { c, taps } = card()
  c.fire('down', { x: 100, y: 100 })
  c.fire('move', { x: 100 + MOVE_PX, y: 100 - MOVE_PX })
  c.fire('up')
  assert.equal(taps.n, 1)
})

test('sliding over the card darkens it and gives no point', () => {
  const { c, taps } = card()
  c.fire('down', { x: 100, y: 100 })
  c.fire('move', { x: 100, y: 100 + MOVE_PX + 1 })
  assert.equal(c.props.color, DARK)
  c.fire('up')
  assert.equal(taps.n, 0)
})

test('leaving the card darkens it and gives no point', () => {
  const { c, label, taps } = card()
  label.fire('down', { x: 100, y: 100 })
  label.fire('out')
  assert.equal(c.props.color, DARK)
  label.fire('up')
  assert.equal(taps.n, 0)
})

test('a lift the watch never reports does not leave the card lit', () => {
  mock.timers.enable({ apis: ['setTimeout'] })
  try {
    const { c } = card()
    c.fire('down', { x: 100, y: 100 })
    mock.timers.tick(799)
    assert.equal(c.props.color, LIT)
    mock.timers.tick(1)
    assert.equal(c.props.color, DARK)
  } finally {
    mock.timers.reset()
  }
})

test('two separate taps count twice', () => {
  const { c, taps } = card()
  const now = mock.method(Date, 'now', () => 1000)
  try {
    c.fire('down', { x: 1, y: 1 })
    c.fire('up')
    now.mock.mockImplementation(() => 1400)
    c.fire('down', { x: 1, y: 1 })
    c.fire('up')
  } finally {
    now.mock.restore()
  }
  assert.equal(taps.n, 2)
})

test('onTouch reports a slide once per touch and resets on the next touch', () => {
  const w = fakeWidget()
  const log = []
  onTouch([w], { down: () => log.push('down'), slide: () => log.push('slide'), up: (slid) => log.push(`up ${slid}`) })
  w.fire('down', { x: 0, y: 0 })
  w.fire('move', { x: 0, y: 50 })
  w.fire('move', { x: 0, y: 90 })
  w.fire('out')
  w.fire('up')
  w.fire('down', { x: 0, y: 0 })
  w.fire('up')
  assert.deepEqual(log, ['down', 'slide', 'up true', 'down', 'up false'])
})

test('the saved color range matches the team colors', () => {
  assert.equal(COLOR_COUNT, TEAM_COLORS.length)
})

test('fitText picks the largest size that fits, then shortens with …', () => {
  // Stand-in widths: W and M 0.9 of the text size, every other character 0.6.
  assert.deepEqual(fitText('WIR', 60, [24, 16]), { text: 'WIR', size: 24 })
  assert.deepEqual(fitText('MARIA', 60, [24, 18, 16]), { text: 'MARIA', size: 18 })
  assert.deepEqual(fitText('WWWWWWWW', 60, [24, 16]), { text: 'WWW…', size: 16 })
})
