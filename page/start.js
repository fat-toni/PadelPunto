// Start screen: time, logo, then "Weiter" for an open match, "Neues Spiel", "Optionen", "Verlauf" and "i".
import * as hmUI from '@zos/ui'
import { replace, push } from '@zos/router'
import { px } from '@zos/utils'
import { hasStarted } from '../utils/score'
import { loadMatch, archiveMatch } from '../utils/store'
import { C, text, button, restyle, clock, fullScreen, confirmTwice } from '../utils/theme'
import { tr, APP_NAME } from '../utils/i18n'
import { safePage } from '../utils/errors'
import { toast } from '../utils/toast'
import { loadCourt } from '../utils/court'
import { hourText } from '../utils/time'

function bigProps(y, w, x, label, primary, onClick) {
  return {
    x: px(x),
    y: px(y),
    w: px(w),
    h: px(60),
    radius: px(30),
    text: label,
    text_size: px(28),
    color: primary ? 0x000000 : 0xffffff,
    normal_color: primary ? C.ball : C.pill,
    press_color: primary ? C.ballPress : C.tile,
    click_func: onClick,
  }
}

Page(
  safePage('start', {
    // The match page returns here via replace(), so build() always sees the current saved match.
    build() {
      fullScreen()

      // A finished match that was left without pressing "Ende" goes to the log now. If the log
      // can't be written, it stays saved and the next start or "Neues Spiel" tries again.
      const saved = loadMatch()
      if (saved && saved.winner !== null) archiveMatch(saved)
      this.open = !!saved && saved.winner === null && hasStarted(saved)
      // Replacing an open match needs a second tap; the old one goes to the log as abandoned.
      this.newConfirm = confirmTwice(
        (on) => this.paintNew(on ? tr('endOld') : tr('newGame')),
        () => this.newGame(),
        () => this.open,
      )

      this.stopClock = clock({
        x: px(12),
        y: px(6),
        w: px(366),
        h: px(30),
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })

      // Logo, name and buttons spread over the screen. With an open match a smaller logo
      // (tools/logo.py) makes room for "Weiter" and the buttons move a little closer.
      const L = this.open
        ? { top: 42, size: 110, src: 'img/logo_small.png', gap: 12, step: 70 }
        : { top: 48, size: 150, src: 'img/logo.png', gap: 20, step: 72 }
      hmUI.createWidget(hmUI.widget.IMG, {
        x: px((390 - L.size) / 2),
        y: px(L.top),
        w: px(L.size),
        h: px(L.size),
        src: L.src,
      })
      // Court time on the left of the logo (mirroring "i"); a set end time shows below it.
      const btnY = L.top + (L.size - 56) / 2
      button({
        x: px(34),
        y: px(btnY),
        w: px(56),
        h: px(56),
        normal_src: 'img/clock.png',
        press_src: 'img/clock_press.png',
        click_func: () => replace({ url: 'page/court' }),
      })
      const court = loadCourt()
      if (court.end !== null) {
        const d = new Date(court.end)
        text({
          x: px(14),
          y: px(btnY + 58),
          w: px(96),
          h: px(26),
          text: hourText(d.getHours(), d.getMinutes()),
          text_size: px(20),
          color: C.ball,
          align_h: hmUI.align.CENTER_H,
        })
      }
      // Info sits beside the logo, clear of the rounded screen corners.
      button({
        x: px(300),
        y: px(L.top + (L.size - 56) / 2),
        w: px(56),
        h: px(56),
        radius: px(28),
        text: 'i',
        text_size: px(30),
        color: C.muted,
        normal_color: C.pill,
        press_color: C.tile,
        click_func: () => push({ url: 'page/info' }),
      })
      const nameY = L.top + L.size + 8
      text({
        x: px(12),
        y: px(nameY),
        w: px(366),
        h: px(44),
        text: APP_NAME,
        text_size: px(40),
        color: C.ball,
        align_h: hmUI.align.CENTER_H,
      })

      let y = nameY + 44 + L.gap
      if (this.open) {
        button(bigProps(y, 366, 12, tr('resume'), true, () => replace({ url: 'page/match' })))
        y += L.step
      }
      this.newY = y
      this.newBtn = button(bigProps(y, 366, 12, tr('newGame'), !this.open, () => this.newConfirm.tap()))
      y += L.step
      button(bigProps(y, 179, 12, tr('options'), false, () => replace({ url: 'page/options' })))
      button(bigProps(y, 179, 199, tr('history'), false, () => push({ url: 'page/history' })))
    },

    // The new match is created on the serve page once the first server is chosen. An old match
    // that can't be moved to the log (storage full) is kept instead of being overwritten.
    newGame() {
      const saved = loadMatch()
      if (saved && hasStarted(saved) && !archiveMatch(saved)) {
        toast(tr('saveFailed'))
        return
      }
      replace({ url: 'page/serve' })
    },

    // MORE replaces the button's props, so it gets all of them.
    paintNew(label) {
      restyle(
        this.newBtn,
        bigProps(this.newY, 366, 12, label, false, () => this.newConfirm.tap()),
      )
    },

    onDestroy() {
      if (this.newConfirm) this.newConfirm.stop()
      if (this.stopClock) this.stopClock()
    },
  }),
)
