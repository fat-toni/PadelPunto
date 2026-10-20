// Shared colors, widget helpers, tap feedback, two-tap confirmation and the clock for all pages.
import * as hmUI from '@zos/ui'
import { px } from '@zos/utils'
import { getScrollTop } from '@zos/page'
import { Vibrator, VIBRATOR_SCENE_SHORT_LIGHT, VIBRATOR_SCENE_NOTIFICATION } from '@zos/sensor'
import { safe } from './errors'
import { time, hourText } from './time'

export const C = {
  card: 0x15181b,
  tile: 0x23272c,
  pill: 0x1c1f22,
  muted: 0x8b939b,
  off: 0x2c3136,
  dim: 0x4f565d, // text of an option that is switched off by another one
  ball: 0xd4f53c,
  ballPress: 0xa9c42e,
  heart: 0xff5a5f,
  danger: 0xff5a5f,
  dangerPress: 0xc94448,
  dangerDark: 0x3a1718,
}

// How long a first tap on a destructive button waits for the confirming second tap.
export const CONFIRM_MS = 3000

// Selectable team colors (option "Farbe Team 1/2"). Lime is left out, it belongs to the ball.
// Names are in locales/.
export const TEAM_COLORS = [
  { key: 'green', text: 0x5ee08a },
  { key: 'blue', text: 0x6aa8ff },
  { key: 'orange', text: 0xffa24c },
  { key: 'pink', text: 0xff6fae },
  { key: 'purple', text: 0xb48cff },
  { key: 'red', text: 0xff5a5f },
  { key: 'cyan', text: 0x4fd8e0 },
  { key: 'white', text: 0xe8ecef },
]

// Mixes share (0…1) of color a into color b, channel by channel.
export function mix(a, b, share) {
  let out = 0
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 0xff
    const cb = (b >> shift) & 0xff
    out |= Math.round(cb + (ca - cb) * share) << shift
  }
  return out
}

// Colors of team t (0 or 1) for a match config or log entry; older entries have no colors.
// text: name and bars; card: the card, a dark tint of the team color, so the teams can be told
// apart without reading; press: the card while pressed; tile: the games tile on the card.
export function teamColor(cfg, t) {
  const colors = (cfg && cfg.colors) || [0, 1]
  const { key, text } = TEAM_COLORS[colors[t]] || TEAM_COLORS[t]
  return {
    key,
    text,
    card: mix(text, C.card, 0.1),
    press: mix(text, C.card, 0.26),
    tile: mix(text, C.tile, 0.1),
  }
}

// Only the match screen vibrates, so the vibrator is created on its first use there.
let vibrator = null
const vib = () => vibrator || (vibrator = new Vibrator())

const BUZZ_MS = 20
const BUZZ_GAP_MS = 300
let lastBuzz = 0

// A single, very light tick; only the match screen uses it. Calls within BUZZ_GAP_MS are
// dropped, so one tap never ticks twice (a watch clock set back does not mute it). Uses the
// API 3.6 scene list (GENTLE_SHORT with an explicit duration) and falls back to the lightest
// preset on older firmware.
export function buzz() {
  const now = Date.now()
  if (now >= lastBuzz && now - lastBuzz < BUZZ_GAP_MS) return
  lastBuzz = now
  const v = vib()
  try {
    v.stop()
    v.start([{ type: v.getType().GENTLE_SHORT, duration: BUZZ_MS }])
  } catch (e) {
    try {
      v.start({ mode: VIBRATOR_SCENE_SHORT_LIGHT })
    } catch (e2) {}
  }
}

// Plays a vibration pattern (API 3.6 scene list: [type name, ms] pairs, 'PAUSE' between) and
// falls back to a preset scene on older firmware. Counts as a tick for the BUZZ_GAP_MS rule.
function pattern(steps, fallback) {
  lastBuzz = Date.now()
  const v = vib()
  try {
    v.stop()
    const types = v.getType()
    v.start(steps.map(([type, duration]) => ({ type: types[type], duration })))
  } catch (e) {
    try {
      v.start({ mode: fallback })
    } catch (e2) {}
  }
}

// On the Bip 6, STRONG_SHORT is one short knock whatever the duration (measured on the watch),
// so the long buzzes use CONTINUOUS.

// A won set: one long buzz.
export function buzzSet() {
  pattern([['CONTINUOUS', 600]], VIBRATOR_SCENE_NOTIFICATION)
}

// The won match: three long buzzes.
export function buzzMatch() {
  pattern(
    [
      ['CONTINUOUS', 600],
      ['PAUSE', 250],
      ['CONTINUOUS', 600],
      ['PAUSE', 250],
      ['CONTINUOUS', 600],
    ],
    VIBRATOR_SCENE_NOTIFICATION,
  )
}

// Court time reminder or end: three long buzzes with longer gaps, to be felt during a rally.
export function buzzAlarm() {
  pattern(
    [
      ['CONTINUOUS', 800],
      ['PAUSE', 400],
      ['CONTINUOUS', 800],
      ['PAUSE', 400],
      ['CONTINUOUS', 800],
    ],
    VIBRATOR_SCENE_NOTIFICATION,
  )
}

// The break at a change of ends is over: two strong buzzes.
export function buzzPauseEnd() {
  pattern(
    [
      ['STRONG_SHORT', 300],
      ['PAUSE', 150],
      ['STRONG_SHORT', 300],
    ],
    VIBRATOR_SCENE_NOTIFICATION,
  )
}

// Two light ticks for a side change, so it can be felt without looking.
export function buzzSwitch() {
  lastBuzz = Date.now()
  const v = vib()
  try {
    v.stop()
    const gentle = v.getType().GENTLE_SHORT
    v.start([
      { type: gentle, duration: BUZZ_MS },
      { type: v.getType().PAUSE, duration: 150 },
      { type: gentle, duration: BUZZ_MS },
    ])
  } catch (e) {
    try {
      v.start({ mode: VIBRATOR_SCENE_NOTIFICATION })
    } catch (e2) {}
  }
}

// Full screen: hides the system bar with the app name and time (square screens only).
// Pages that call this show the time themselves via clock().
export function fullScreen() {
  try {
    hmUI.setStatusBarVisible(false)
  } catch (e) {}
}

export function text(props) {
  return hmUI.createWidget(hmUI.widget.TEXT, {
    align_h: hmUI.align.LEFT,
    align_v: hmUI.align.CENTER_V,
    color: 0xffffff,
    ...props,
  })
}

// Largest of the given text sizes (big to small) at which the label fits into width w on one line.
// If it does not fit even at the smallest size, the label is shortened and ends in "…".
export function fitText(label, w, sizes) {
  const width = (t, size) => hmUI.getTextLayout(t, { text_size: size, text_width: 1000, wrapped: 0 }).width
  for (const size of sizes) {
    if (width(label, size) <= w) return { text: label, size }
  }
  const size = sizes[sizes.length - 1]
  let cut = label
  while (cut.length > 1 && width(cut + '…', size) > w) cut = cut.slice(0, -1)
  return { text: cut + '…', size }
}

export function rect(props) {
  return hmUI.createWidget(hmUI.widget.FILL_RECT, props)
}

// A button whose click_func logs errors instead of throwing (see utils/errors.js).
export function button(props) {
  return hmUI.createWidget(hmUI.widget.BUTTON, guardClick(props))
}

function guardClick(props) {
  return props.click_func ? { ...props, click_func: safe('button', props.click_func) } : props
}

// Gives a button new props (MORE replaces all of them, so pass the full set), click guarded too.
export function restyle(btn, props) {
  btn.setProperty(hmUI.prop.MORE, guardClick(props))
}

// Calls fn once a minute, right when (Date.now() - offset) crosses a full minute, so the
// watch wakes up 1× instead of 6× per minute. Returns a function that stops it.
export function everyMinute(fn, offset = 0) {
  fn = safe('minute', fn)
  let timer = null
  const next = () => {
    timer = setTimeout(
      () => {
        fn()
        next()
      },
      60000 - ((((Date.now() - offset) % 60000) + 60000) % 60000) + 50,
    )
  }
  next()
  return () => clearTimeout(timer)
}

// Wraps a widget so setProperty only runs (and redraws) when the value really changes.
export function lazy(w) {
  const last = {}
  return {
    w,
    set(p, v) {
      if (last[p] === v) return
      last[p] = v
      w.setProperty(p, v)
    },
  }
}

// A text widget showing the watch time in the watch's hour format, refreshed on each new minute;
// onMinute (optional) runs on the same wake-up. Returns a function that stops the refresh; call
// it in onDestroy.
export function clock(props, onMinute) {
  const w = text({ text_size: px(24), ...props })
  const paint = () => w.setProperty(hmUI.prop.TEXT, hourText(time.getHours(), time.getMinutes()))
  paint()
  return everyMinute(() => {
    paint()
    if (onMinute) onMinute()
  })
}

// A finger that moves further than this between down and up is sliding or scrolling, not tapping.
export const MOVE_PX = 15

// The longest a card stays lit without a CLICK_UP; the system swallows it when a slide
// turns into a swipe or a scroll.
const PRESS_MAX_MS = 800

// A long press (history: arm a card for deletion; options: default team name).
export const HOLD_MS = 600

// Touch tracking for a card and the widgets drawn on top of it (they all report the touch).
// down() runs when the finger touches; slide() once per touch when it moves more than MOVE_PX
// or leaves a widget (scrolling, swiping); up(slid) on every lift. Used by tappable() and by
// the long press in the history.
export function onTouch(widgets, { down, slide, up }) {
  down = safe('touch', down)
  slide = safe('touch', slide)
  up = safe('touch', up)
  let start = null
  let slid = false
  const slideOff = () => {
    if (slid) return
    slid = true
    slide()
  }
  const moved = (info) => {
    if (!start || !info || typeof info.y !== 'number') return
    if (Math.abs(info.x - start.x) > MOVE_PX || Math.abs(info.y - start.y) > MOVE_PX) slideOff()
  }
  for (const w of widgets) {
    w.addEventListener(hmUI.event.CLICK_DOWN, (info) => {
      start = info && typeof info.y === 'number' ? { x: info.x, y: info.y } : null
      slid = false
      down()
    })
    w.addEventListener(hmUI.event.CLICK_UP, () => up(slid))
    try {
      w.addEventListener(hmUI.event.MOVE, moved)
      w.addEventListener(hmUI.event.MOVE_OUT, slideOff)
    } catch (e) {}
  }
}

// Makes a rounded card tappable, including the widgets drawn on top of it.
// The card lights up in pressColor while the finger is down. Sliding the finger more than
// MOVE_PX darkens it again and the touch no longer counts; so does sliding off the card or
// holding longer than PRESS_MAX_MS without a lift. A tap that reaches several of the stacked
// widgets only counts once. With onHold, holding still for HOLD_MS calls it instead of onTap;
// not if the page scrolled meanwhile (the watch may stop reporting moves while it scrolls).
// pressColor may be a function, asked on every touch.
export function tappable(card, widgets, color, pressColor, onTap, onHold) {
  let lastTap = 0
  let pressed = false
  let timer = null
  let holdTimer = null
  const release = () => {
    clearTimeout(timer)
    clearTimeout(holdTimer)
    if (!pressed) return
    pressed = false
    card.setProperty(hmUI.prop.COLOR, color)
  }
  onTouch([card, ...widgets], {
    down: () => {
      pressed = true
      card.setProperty(hmUI.prop.COLOR, typeof pressColor === 'function' ? pressColor() : pressColor)
      clearTimeout(timer)
      timer = setTimeout(safe('touch', release), PRESS_MAX_MS)
      if (!onHold) return
      const top = getScrollTop()
      clearTimeout(holdTimer)
      holdTimer = setTimeout(
        safe('hold', () => {
          const scrolled = Math.abs(getScrollTop() - top) > 2
          release()
          if (!scrolled) onHold()
        }),
        HOLD_MS,
      )
    },
    slide: release,
    up: () => {
      const wasPressed = pressed
      release()
      const now = Date.now()
      if (!wasPressed || now - lastTap < 150) return
      lastTap = now
      onTap()
    },
  })
}

// Two-tap confirmation for destructive buttons. The first tap() calls paint(true) and waits
// CONFIRM_MS for a second tap, which runs action(); otherwise paint(false) restores the button.
// While needed() is false, a single tap runs action() right away. Call stop() in onDestroy.
export function confirmTwice(paint, action, needed = () => true) {
  let until = 0
  let timer = null
  return {
    tap() {
      if (needed() && Date.now() >= until) {
        until = Date.now() + CONFIRM_MS
        paint(true)
        clearTimeout(timer)
        timer = setTimeout(
          safe('confirm', () => {
            until = 0
            paint(false)
          }),
          CONFIRM_MS,
        )
        return
      }
      clearTimeout(timer)
      until = 0
      action()
    },
    stop() {
      clearTimeout(timer)
    },
  }
}

// Where the content starts below header().
export const HEADER_H = 80

// Clock and page title, both centered so nothing sits in the rounded screen corners
// (options, history, info). Returns the clock's stop function.
export function header(title) {
  text({
    x: px(12),
    y: px(34),
    w: px(366),
    h: px(40),
    text: title,
    text_size: px(32),
    color: C.ball,
    align_h: hmUI.align.CENTER_H,
  })
  return clock({ x: px(12), y: px(6), w: px(366), h: px(30), color: C.muted, align_h: hmUI.align.CENTER_H })
}

// A small centered button at the bottom of a page that leaves it ("Zurück", "Abbrechen").
export function backButton(y, label, onClick) {
  return button({
    x: px(95),
    y: px(y),
    w: px(200),
    h: px(52),
    radius: px(26),
    text: label,
    text_size: px(24),
    color: 0xffffff,
    normal_color: C.pill,
    press_color: C.tile,
    click_func: onClick,
  })
}

// A full-width secondary button, e.g. "Ältere anzeigen" in the history.
export function wideButton(y, label, onClick) {
  return button({
    x: px(12),
    y: px(y),
    w: px(366),
    h: px(60),
    radius: px(30),
    text: label,
    text_size: px(24),
    color: 0xffffff,
    normal_color: C.pill,
    press_color: C.tile,
    click_func: onClick,
  })
}
