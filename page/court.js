// Court time: the time the court is booked until (hours and minutes with - / +, minutes in steps
// of 5) and how long before it the watch reminds. "Speichern" sets two watch alarms (utils/court.js),
// "Löschen" removes them. Opened and left with replace() like the options (button, swipe right or
// back key, the last two without saving), so the start screen shows the new end time.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { onGesture, offGesture, GESTURE_RIGHT, onKey, offKey, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { C, text, button, restyle, fullScreen, header } from '../utils/theme'
import { tr } from '../utils/i18n'
import { safePage, safe } from '../utils/errors'
import { toast } from '../utils/toast'
import { loadCourt, saveCourt, clearCourt, defaultEnd, nextAt, WARN_CHOICES } from '../utils/court'

const STEP_MIN = 5
const two = (n) => String(n).padStart(2, '0')

function home() {
  replace({ url: 'page/start' })
}

function smallButton(x, y, label, onClick) {
  return button({
    x: px(x),
    y: px(y),
    w: px(76),
    h: px(56),
    radius: px(28),
    text: label,
    text_size: px(34),
    normal_color: C.pill,
    press_color: C.tile,
    click_func: onClick,
  })
}

Page(
  safePage('court', {
    build() {
      fullScreen()
      this.stopClock = header(tr('court'))
      const court = loadCourt()
      this.active = court.end !== null
      const end = new Date(court.end || defaultEnd())
      this.h = end.getHours()
      this.m = Math.round(end.getMinutes() / STEP_MIN) * STEP_MIN
      if (this.m === 60) {
        this.m = 0
        this.h = (this.h + 1) % 24
      }
      this.warn = court.warn

      const center = { x: px(12), w: px(366), align_h: hmUI.align.CENTER_H }
      text({ ...center, y: px(84), h: px(28), text: tr('courtUntilLabel'), text_size: px(22), color: C.muted })
      // Hours and minutes in two halves around the colon, each with its own - / + below.
      const big = { y: px(112), h: px(84), text_size: px(76) }
      this.hourW = text({ ...big, x: px(30), w: px(150), align_h: hmUI.align.RIGHT, text: '' })
      text({ ...big, x: px(180), w: px(30), align_h: hmUI.align.CENTER_H, text: ':' })
      this.minW = text({ ...big, x: px(210), w: px(150), text: '' })
      smallButton(28, 204, '-', () => this.addHours(-1))
      smallButton(108, 204, '+', () => this.addHours(1))
      smallButton(206, 204, '-', () => this.addMinutes(-STEP_MIN))
      smallButton(286, 204, '+', () => this.addMinutes(STEP_MIN))

      // Tap cycles the reminder: 5, 10, 15 minutes before.
      this.warnBtn = button(this.warnProps())

      const save = {
        y: px(344),
        h: px(60),
        radius: px(30),
        text_size: px(26),
        text: tr('courtSave'),
        color: 0x000000,
        normal_color: C.ball,
        press_color: C.ballPress,
        click_func: () => this.save(),
      }
      if (this.active) {
        button({
          x: px(12),
          y: px(344),
          w: px(179),
          h: px(60),
          radius: px(30),
          text: tr('courtClear'),
          text_size: px(26),
          color: C.danger,
          normal_color: C.pill,
          press_color: C.tile,
          click_func: () => this.clear(),
        })
        button({ ...save, x: px(199), w: px(179) })
      } else button({ ...save, x: px(12), w: px(366) })
      this.paint()

      onGesture({
        callback: safe('gesture', (event) => {
          if (event !== GESTURE_RIGHT) return false
          home()
          return true
        }),
      })
      onKey({
        callback: safe('key', (key, event) => {
          if (key !== KEY_BACK || event !== KEY_EVENT_CLICK) return false
          home()
          return true
        }),
      })
    },

    warnProps() {
      return {
        x: px(12),
        y: px(274),
        w: px(366),
        h: px(58),
        radius: px(29),
        text: tr('courtWarn', { n: this.warn }),
        text_size: px(24),
        normal_color: C.pill,
        press_color: C.tile,
        click_func: () => {
          this.warn = WARN_CHOICES[(WARN_CHOICES.indexOf(this.warn) + 1) % WARN_CHOICES.length]
          restyle(this.warnBtn, this.warnProps())
        },
      }
    },

    paint() {
      this.hourW.setProperty(hmUI.prop.TEXT, two(this.h))
      this.minW.setProperty(hmUI.prop.TEXT, two(this.m))
    },

    addHours(d) {
      this.h = (this.h + d + 24) % 24
      this.paint()
    },

    addMinutes(d) {
      this.m = (this.m + d + 60) % 60
      this.paint()
    },

    save() {
      const end = nextAt(this.h, this.m)
      toast(saveCourt(end, this.warn) ? tr('courtSaved') : tr('courtFailed'))
      home()
    },

    clear() {
      clearCourt()
      toast(tr('courtCleared'))
      home()
    },

    onDestroy() {
      offGesture()
      offKey()
      if (this.stopClock) this.stopClock()
    },
  }),
)
