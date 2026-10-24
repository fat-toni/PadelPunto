// Opened by a court time alarm (utils/court.js), also when the app was closed: vibrates and says
// "Noch 5 Minuten" (the reminder) or "Platzzeit vorbei" (the end), which one follows from the
// saved end time. "OK" goes back into an open match, otherwise to the start screen.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { C, text, button, fullScreen, clock, buzzAlarm } from '../utils/theme'
import { tr } from '../utils/i18n'
import { safePage } from '../utils/errors'
import { read } from '../utils/files'
import { matchStatus } from '../utils/store'
import { hourText } from '../utils/time'

// An alarm can be a little late; up to this long before the end it still counts as the reminder.
const END_SLACK_MS = 30000

Page(
  safePage('courtAlert', {
    build() {
      fullScreen()
      const c = read('court', null)
      const end = c && typeof c.end === 'number' ? c.end : null
      const left = end === null ? 0 : end - Date.now()
      const warn = left > END_SLACK_MS
      buzzAlarm()

      this.stopClock = clock({
        x: px(12),
        y: px(6),
        w: px(366),
        h: px(30),
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })
      const center = { x: px(12), w: px(366), align_h: hmUI.align.CENTER_H }
      text({
        ...center,
        y: px(110),
        h: px(130),
        text: warn ? tr('courtLeft', { n: Math.max(1, Math.round(left / 60000)) }) : tr('courtOver'),
        text_size: px(48),
        color: warn ? C.ball : C.danger,
        text_style: hmUI.text_style ? hmUI.text_style.WRAP : 1,
      })
      if (end !== null) {
        const d = new Date(end)
        text({
          ...center,
          y: px(250),
          h: px(36),
          text: tr('courtUntil', { t: hourText(d.getHours(), d.getMinutes()) }),
          text_size: px(26),
          color: C.muted,
        })
      }

      const open = matchStatus() === 'open'
      button({
        x: px(95),
        y: px(344),
        w: px(200),
        h: px(60),
        radius: px(30),
        text: tr('ok'),
        text_size: px(28),
        color: 0x000000,
        normal_color: C.ball,
        press_color: C.ballPress,
        click_func: () => replace({ url: open ? 'page/match' : 'page/start' }),
      })
    },

    onDestroy() {
      if (this.stopClock) this.stopClock()
    },
  }),
)
