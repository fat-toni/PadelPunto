// A simulated Bip 6 for the app tests: loads the real pages, runs their lifecycle (onInit, build,
// onDestroy) and the router like Zepp OS does, and lets a test tap, hold, slide, press keys,
// swipe, type on the keyboard and turn the screen off. Time runs only via tick() (mock timers).
import { readFileSync } from 'node:fs'
import { mock } from 'node:test'
import { resetZos } from './zos.mjs'
import { resetLang } from '../../utils/i18n.js'
import { resetErrorToast } from '../../utils/errors.js'

const zos = globalThis.zos
export const SCREEN = { w: 390, h: 450 }
// Zepp OS closes a Mini Program this long after the screen went off (unless relaunch is set).
export const EXIT_AFTER_OFF_MS = 10000

// Every page module calls Page() once when it is first imported; keep the definitions by url.
const PAGES = ['start', 'serve', 'match', 'options', 'history', 'info', 'diag', 'court', 'courtAlert']
const defs = {}
let loading = null
globalThis.Page = (def) => (defs[loading] = def)
for (const name of PAGES) {
  loading = `page/${name}`
  await import(`../../page/${name}.js`)
}

const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'))
// Each new watch starts one day later at 18:00, so nothing kept in a module between two tests
// (like the time of the last vibration) looks recent.
// Local calendar days, so a daylight saving change (25.10.) does not move the 18:00.
const startOf = (n) => new Date(2026, 9, 16 + n, 18, 0, 0).getTime()
let watches = 0

const textOf = (w) => (typeof w.props.text === 'string' ? w.props.text : '')

function box(w) {
  const p = w.props
  if (w.type === 'CIRCLE')
    return { x: p.center_x - p.radius, y: p.center_y - p.radius, w: 2 * p.radius, h: 2 * p.radius }
  return { x: p.x, y: p.y, w: p.w, h: p.h }
}

const inside = (b, x, y) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h

export class Watch {
  // Fresh watch: empty storage, German, 24 h clock, time stopped at 18:00 (16.10.2026 or later).
  constructor() {
    resetZos()
    zos.packageVersion = app.app.version
    globalThis.zosFiles.clear()
    globalThis.zosFull = false
    mock.timers.reset()
    mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: startOf(watches++) })
    // Count timer wake-ups and the timers still waiting (a page that forgets one leaks it).
    const { setTimeout: set, clearTimeout: clear } = globalThis
    const cost = zos.cost
    globalThis.setTimeout = (fn, ms, ...args) => {
      const id = set(() => {
        cost.pending.delete(id)
        cost.wakeups++
        fn(...args)
      }, ms)
      cost.pending.add(id)
      return id
    }
    globalThis.clearTimeout = (id) => {
      cost.pending.delete(id)
      clear(id)
    }
    this.stack = []
    this.running = false
    this.screenOn = true
    this.log = [] // every page opened, for checks like "start was rebuilt"
  }

  // Ends the test: closes the app and gives the real timers back. An error the app caught and
  // logged (utils/errors.js) still fails the test, unless the test expects it (allowErrors).
  done() {
    if (this.running) this.closeApp()
    mock.timers.reset()
    const logged = globalThis.zosFiles.get('errors.json')
    if (logged && !this.allowErrors) throw new Error(`the app logged errors: ${logged}`)
  }

  get files() {
    return globalThis.zosFiles
  }

  set full(v) {
    globalThis.zosFull = v
  }

  // ---- app and pages ----

  launch() {
    if (this.running) throw new Error('app already running')
    resetLang() // a real start loads every module fresh
    resetErrorToast()
    this.running = true
    this.stack = []
    this.open('page/start', undefined)
    this.flush()
    return this
  }

  get page() {
    return this.stack[this.stack.length - 1]
  }

  get url() {
    return this.running ? this.page.url : 'watchface'
  }

  open(url, params) {
    const def = defs[url]
    if (!def) throw new Error(`unknown page ${url}`)
    const inst = Object.create(def)
    const entry = { url, inst, widgets: [] }
    this.stack.push(entry)
    this.log.push(url)
    zos.widgets = entry.widgets
    zos.scrollTop = 0
    zos.scrolledTo = null
    const p = params === undefined ? undefined : typeof params === 'string' ? params : JSON.stringify(params)
    if (inst.onInit) inst.onInit(p)
    if (inst.build) inst.build()
  }

  destroyTop() {
    const entry = this.stack.pop()
    zos.keyboard = null
    if (entry.inst.onDestroy) entry.inst.onDestroy()
    if (this.page) zos.widgets = this.page.widgets
  }

  // Fires the watch alarms that are due: the app starts (or restarts) on the alarm's page.
  alarmsDue() {
    const due = zos.alarms.filter((a) => a.time * 1000 <= Date.now())
    zos.alarms = zos.alarms.filter((a) => !due.includes(a))
    for (const a of due) {
      if (this.running) this.closeApp()
      resetLang()
      this.running = true
      this.stack = []
      this.open(a.url, undefined)
      this.flush()
    }
    return due.length
  }

  closeApp() {
    while (this.stack.length) this.destroyTop()
    this.running = false
    zos.router = []
  }

  // Runs the navigation the pages asked for, in order, like the system does after a callback.
  flush() {
    let guard = 0
    while (zos.router.length) {
      if (++guard > 50) throw new Error('navigation loop')
      const nav = zos.router.shift()
      if (!this.running) continue
      if (nav.kind === 'exit') this.closeApp()
      else if (nav.kind === 'back') {
        if (this.stack.length > 1) this.destroyTop()
        else this.closeApp()
      } else if (nav.kind === 'replace') {
        this.destroyTop()
        this.open(nav.url, nav.params)
      } else this.open(nav.url, nav.params)
    }
  }

  // ---- looking at the screen ----

  get widgets() {
    return this.running ? this.page.widgets : []
  }

  visible() {
    return this.widgets.filter((w) => w.props.visible !== false)
  }

  // Texts on screen (text widgets and buttons), top to bottom.
  texts() {
    return this.visible()
      .filter((w) => (w.type === 'TEXT' || w.type === 'BUTTON') && textOf(w))
      .sort((a, b) => a.props.y - b.props.y || a.props.x - b.props.x)
      .map(textOf)
  }

  has(t) {
    return this.texts().includes(t)
  }

  find(t, nth = 0) {
    const all = this.visible().filter((w) => textOf(w) === t)
    if (!all[nth]) throw new Error(`"${t}" not on ${this.url}; on screen: ${JSON.stringify(this.texts())}`)
    return all[nth]
  }

  button(t) {
    const b = this.visible().find((w) => w.type === 'BUTTON' && textOf(w) === t)
    if (!b) throw new Error(`no button "${t}" on ${this.url}; on screen: ${JSON.stringify(this.texts())}`)
    return b
  }

  // The widget at a point that answers touches, topmost (last created) first.
  touchTargets(x, y) {
    return this.visible().filter((w) => w.type !== 'BUTTON' && Object.keys(w.on).length && inside(box(w), x, y))
  }

  // ---- touching ----

  // Taps a button or the text with this label (and so the card under it).
  press(t, nth = 0) {
    const w = this.find(t, nth)
    if (w.type === 'BUTTON') {
      w.props.click_func(w)
      this.flush()
      return this
    }
    const b = box(w)
    return this.tapAt(b.x + b.w / 2, b.y + b.h / 2)
  }

  // Finger down at (x, y), optional moves, held for ms, then lifted. Every stacked widget
  // under the finger reports the touch, as on the watch. A finger needs a quarter second
  // between two touches.
  // scroll: the page scrolls by this much right after the finger lands, without any moves
  // reaching the widgets (the system takes the finger over).
  tapAt(x, y, { ms = 80, moves = [], leave = false, scroll = 0 } = {}) {
    this.tick(250)
    const buttonHit = this.visible().find((w) => w.type === 'BUTTON' && inside(box(w), x, y))
    if (buttonHit) {
      this.tick(ms)
      buttonHit.props.click_func(buttonHit)
      this.flush()
      return this
    }
    const targets = this.touchTargets(x, y)
    for (const w of targets) w.fire('down', { x, y })
    zos.scrollTop += scroll
    const step = moves.length ? ms / (moves.length + 1) : ms
    for (const [dx, dy] of moves) {
      this.tick(step)
      for (const w of targets) w.fire('move', { x: x + dx, y: y + dy })
    }
    if (leave) for (const w of targets) w.fire('out', {})
    this.tick(step)
    for (const w of targets) w.fire('up', { x, y })
    this.flush()
    return this
  }

  // Long press on a text (and its card).
  hold(t, ms = 700) {
    const b = box(this.find(t))
    return this.tapAt(b.x + b.w / 2, b.y + b.h / 2, { ms })
  }

  // Finger lands on a text, the page scrolls by dy while the card hears nothing, then lift.
  scrollOn(t, dy = 120, ms = 900) {
    const b = box(this.find(t))
    return this.tapAt(b.x + b.w / 2, b.y + b.h / 2, { ms, scroll: dy })
  }

  // Finger lands on a text and slides (scrolling or a swipe across the card).
  slide(t, dy = 60) {
    const b = box(this.find(t))
    return this.tapAt(b.x + b.w / 2, b.y + b.h / 2, {
      ms: 200,
      moves: [
        [0, dy / 3],
        [0, (2 * dy) / 3],
        [0, dy],
      ],
    })
  }

  // A watch key or a swipe. Unhandled, the system goes back (closing the app on its first page).
  key(name = 'back') {
    const handled = zos.key && zos.key(name, 'click')
    if (!handled) zos.router.push({ kind: 'back' })
    this.flush()
    return this
  }

  swipe(dir = 'right') {
    const handled = zos.gesture && zos.gesture(dir)
    if (!handled && dir === 'right') zos.router.push({ kind: 'back' })
    this.flush()
    return this
  }

  // Finishes the open keyboard with this text (or cancels it with null).
  type(value) {
    const kb = zos.keyboard
    if (!kb) throw new Error('no keyboard open')
    if (value === null) kb.onCancel && kb.onCancel(null, { data: '' })
    else kb.onComplete(null, { data: value })
    this.flush()
    return this
  }

  // ---- time, screen, sensors ----

  tick(ms) {
    mock.timers.tick(ms)
    this.flush()
    return this
  }

  // Screen off for ms, then the wrist is raised. Without relaunch the system closes the app
  // EXIT_AFTER_OFF_MS after the screen went off and the watch face comes back.
  screenOff(ms) {
    this.screenOn = false
    const exits = this.running && !zos.relaunch && ms >= EXIT_AFTER_OFF_MS
    if (exits) {
      this.tick(EXIT_AFTER_OFF_MS)
      this.closeApp()
      this.tick(ms - EXIT_AFTER_OFF_MS)
    } else this.tick(ms)
    this.screenOn = true
    return this
  }

  heartRate(bpm) {
    zos.hr.bpm = bpm
    for (const fn of zos.hr.listeners) fn()
    return this
  }

  get zos() {
    return zos
  }
}
