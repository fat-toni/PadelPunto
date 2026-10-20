import { WIDTHS } from './font.mjs'

// Stand-in for every @zos module except @zos/fs (see fs.mjs) in Node tests. Widgets, buttons,
// router calls, key and gesture handlers, display settings, sensors and toasts are recorded in
// globalThis.zos, so test/mock/watch.mjs can drive the real pages like a finger on the watch.
const zos = (globalThis.zos = globalThis.zos || {})

export function resetZos() {
  Object.assign(zos, {
    widgets: [], // widgets of the page being built (watch.mjs swaps this list per page)
    router: [], // pending navigation: { kind: 'replace' | 'push' | 'back' | 'exit', url, params }
    toasts: [],
    vibes: [],
    keyboard: null,
    noKeyboard: false,
    key: null,
    gesture: null,
    relaunch: false,
    display: { brightTime: null, dropWristPaused: false, palmPaused: false },
    hr: { bpm: 0, listeners: [], created: 0 },
    language: 7, // Zepp code for German
    hour12: false,
    scrollTop: 0,
    scrolledTo: null,
    statusBar: true,
    packageVersion: { code: 0, name: '0.0.0' },
    device: { width: 390, height: 450, screenShape: 0, deviceName: 'Amazfit Bip 6', deviceSource: 10223873 },
    system: { osVersion: '5.0', firmwareVersion: '5.0.1.2', minAPI: '4.2' },
    disk: { total: 4e9, free: 3e9, app: 9e6, watchface: 2e7, music: 0, system: 9e8 },
    alarms: [], // @zos/alarm: { id, url, time (s), store }
    alarmFails: false,
    // @zos/media player: paths that load, what was played, or no player at all.
    sound: { okPaths: null, played: [], noPlayer: false, volume: 60, created: 0 },
    // What costs battery: widget changes (redraws), timer wake-ups, file writes and their size.
    cost: { draws: 0, wakeups: 0, pending: new Set(), writes: 0, bytes: 0 },
  })
}
resetZos()

// ---- @zos/ui ----
export const event = { CLICK_DOWN: 'down', CLICK_UP: 'up', MOVE: 'move', MOVE_OUT: 'out' }
export const prop = { COLOR: 'color', TEXT: 'text', TEXT_SIZE: 'text_size', VISIBLE: 'visible', MORE: 'more' }
export const align = { LEFT: 0, CENTER_H: 1, RIGHT: 2, CENTER_V: 3 }
export const widget = {
  TEXT: 'TEXT',
  FILL_RECT: 'FILL_RECT',
  STROKE_RECT: 'STROKE_RECT',
  BUTTON: 'BUTTON',
  IMG: 'IMG',
  CIRCLE: 'CIRCLE',
}
export const inputType = { CHAR: 'char' }
export const text_style = { NONE: 0, WRAP: 1, ELLIPSIS: 2 }

// A widget that records its listeners and properties; fire(name, info) plays a touch event.
export function fakeWidget(type = 'TEXT', props = {}) {
  const on = {}
  return {
    type,
    props: { visible: true, ...props },
    on,
    addEventListener(name, fn) {
      ;(on[name] = on[name] || []).push(fn)
    },
    setProperty(p, v) {
      zos.cost.draws++
      if (p === prop.MORE) Object.assign(this.props, v)
      else this.props[p] = v
    },
    getProperty(p) {
      return this.props[p]
    },
    fire(name, info) {
      for (const fn of on[name] || []) fn(info)
    },
  }
}

export function createWidget(type, props) {
  const w = fakeWidget(type, props)
  zos.widgets.push(w)
  return w
}
export const deleteWidget = () => {}
export const setStatusBarVisible = (v) => (zos.statusBar = v)

// Text width: measured on the watch where known (font.mjs, at size 100), otherwise estimated like
// a typical watch font: wide letters (W, M) 0.9 em, all others 0.6 em.
// With wrapped, the height grows by one line per text_width.
export const charWidth = (ch, size) =>
  ((WIDTHS[ch] !== undefined ? WIDTHS[ch] : /[WMwm]/.test(ch) ? 90 : 60) * size) / 100
export const showToast = ({ text }) => zos.toasts.push(text)
export const getTextLayout = (t, { text_size, text_width, wrapped }) => {
  const width = [...t].reduce((sum, ch) => sum + charWidth(ch, text_size), 0)
  const lines = wrapped && text_width ? Math.max(1, Math.ceil(width / text_width)) : 1
  return { width, height: Math.round(lines * text_size * 1.25) }
}

export function createKeyboard(opts) {
  if (zos.noKeyboard) throw new Error('no keyboard')
  zos.keyboard = opts
}
export const deleteKeyboard = () => (zos.keyboard = null)

// ---- @zos/utils ----
export const px = (n) => n

// ---- @zos/router ----
export const replace = (opts) => zos.router.push({ kind: 'replace', ...opts })
export const push = (opts) => zos.router.push({ kind: 'push', ...opts })
export const back = () => zos.router.push({ kind: 'back' })
export const exit = () => zos.router.push({ kind: 'exit' })

// ---- @zos/display ----
export const setWakeUpRelaunch = ({ relaunch }) => (zos.relaunch = relaunch)
export const setPageBrightTime = ({ brightTime }) => (zos.display.brightTime = brightTime)
export const pauseDropWristScreenOff = () => (zos.display.dropWristPaused = true)
export const resetDropWristScreenOff = () => (zos.display.dropWristPaused = false)
export const pausePalmScreenOff = () => (zos.display.palmPaused = true)
export const resetPalmScreenOff = () => (zos.display.palmPaused = false)

// ---- @zos/interaction ----
export const GESTURE_RIGHT = 'right'
export const GESTURE_LEFT = 'left'
export const KEY_BACK = 'back'
export const KEY_HOME = 'home'
export const KEY_EVENT_CLICK = 'click'
export const onKey = ({ callback }) => (zos.key = callback)
export const offKey = () => (zos.key = null)
export const onGesture = ({ callback }) => (zos.gesture = callback)
export const offGesture = () => (zos.gesture = null)

// ---- @zos/page ----
export const scrollTo = ({ y }) => (zos.scrolledTo = y)
export const getScrollTop = () => zos.scrollTop

// ---- @zos/settings ----
export const getLanguage = () => zos.language
export const getSystemInfo = () => zos.system

// ---- @zos/device ----
export const SCREEN_SHAPE_SQUARE = 0
export const SCREEN_SHAPE_ROUND = 1
export const getDeviceInfo = () => zos.device
export const getDiskInfo = () => zos.disk

// ---- @zos/app ----
export const getPackageInfo = () => ({ version: zos.packageVersion })

// ---- @zos/sensor ----
export const VIBRATOR_SCENE_SHORT_LIGHT = 0
export const VIBRATOR_SCENE_NOTIFICATION = 1
export const TIME_HOUR_FORMAT_12 = 12

export class Vibrator {
  getType() {
    return {
      GENTLE_SHORT: 'gentle',
      STRONG_SHORT: 'strong',
      CONTINUOUS: 'continuous',
      URGENT: 'urgent',
      PAUSE: 'pause',
    }
  }
  stop() {}
  start(pattern) {
    zos.vibes.push(pattern)
  }
}

export class Time {
  getHours() {
    return new Date(Date.now()).getHours()
  }
  getMinutes() {
    return new Date(Date.now()).getMinutes()
  }
  getHourFormat() {
    return zos.hour12 ? 12 : 24
  }
}

export class HeartRate {
  constructor() {
    zos.hr.created++
  }
  getCurrent() {
    return zos.hr.bpm
  }
  onCurrentChange(fn) {
    zos.hr.listeners.push(fn)
  }
  offCurrentChange(fn) {
    zos.hr.listeners = zos.hr.listeners.filter((f) => f !== fn)
  }
}

// @zos/media: a player that loads the paths in zos.sound.okPaths, or by default any file without
// a scheme (PREPARE after 50 ms), and finishes 1 s after start.
export const id = { PLAYER: 'player', RECORDER: 'recorder' }
export function create() {
  if (zos.sound.noPlayer) throw new Error('no player')
  zos.sound.created++
  const listeners = {}
  const emit = (ev, arg) => (listeners[ev] || []).forEach((cb) => cb(arg))
  let file = null
  let timer = null
  return {
    source: { FILE: 'file' },
    event: { PREPARE: 'prepare', COMPLETE: 'complete', PLAY: 'play', STOP: 'stop' },
    addEventListener: (ev, cb) => (listeners[ev] = [...(listeners[ev] || []), cb]),
    setSource: (_, opts) => (file = opts.file),
    prepare: () => {
      const ok = zos.sound.okPaths ? zos.sound.okPaths.includes(file) : !file.includes(':')
      setTimeout(() => emit('prepare', ok), 50)
    },
    start: () => {
      zos.sound.played.push(file)
      timer = setTimeout(() => emit('complete'), 1000)
    },
    stop: () => clearTimeout(timer),
    getVolume: () => zos.sound.volume,
    setVolume: (v) => ((zos.sound.volume = v), true),
  }
}

// @zos/alarm: alarms are kept in zos.alarms; Watch.alarmsDue() opens their page when due.
let alarmIds = 0
export function set(opts) {
  if (zos.alarmFails) return 0
  const id = ++alarmIds
  zos.alarms.push({ id, url: opts.url, time: opts.time, store: !!opts.store })
  return id
}
export function cancel(id) {
  zos.alarms = zos.alarms.filter((a) => a.id !== id)
  return 0
}
