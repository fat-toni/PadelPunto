// Match log: one card per finished or abandoned match, newest first, and a button to clear it.
// Only the newest PAGE_SIZE matches are built at first (fewer widgets, faster to open);
// "Ältere anzeigen" rebuilds the page with all of them.
// A long press on a card arms it for deletion; a tap within CONFIRM_MS then deletes that match
// and the page is rebuilt at the same scroll position.
// Opened with push() from the start screen, so the system back gesture returns there.
import * as hmUI from '@zos/ui'
import { back, replace } from '@zos/router'
import { px } from '@zos/utils'
import { scrollTo, getScrollTop } from '@zos/page'
import { setsText, durationText } from '../utils/score'
import { loadLog, clearLog, deleteLogEntry } from '../utils/store'
import {
  C,
  CONFIRM_MS,
  HOLD_MS,
  HEADER_H,
  text,
  fitText,
  rect,
  button,
  restyle,
  fullScreen,
  teamColor,
  header,
  wideButton,
  backButton,
  confirmTwice,
  onTouch,
} from '../utils/theme'
import { tr, dateText } from '../utils/i18n'
import { safePage, safe } from '../utils/errors'

const CARD_H = 104
const GAP = 8
const PAGE_SIZE = 10

Page(
  safePage('history', {
    // params (JSON, from this page's own replace()): { all, top } = show every match, scroll position.
    onInit(params) {
      let p = {}
      try {
        p = JSON.parse(params || '{}') || {}
      } catch (e) {}
      this.showAll = !!p.all
      this.top = p.top || 0
    },

    build() {
      fullScreen()
      const log = loadLog()
      const shown = this.showAll ? log : log.slice(0, PAGE_SIZE)
      this.armed = null
      this.stopClock = header(tr('history'))

      let y = HEADER_H
      if (!log.length) {
        text({
          x: px(12),
          y: px(160),
          w: px(366),
          h: px(80),
          text: tr('noMatches'),
          text_size: px(26),
          color: C.muted,
          align_h: hmUI.align.CENTER_H,
        })
        y = 358
      }
      shown.forEach((entry) => {
        this.buildEntry(entry, px(y))
        y += CARD_H + GAP
      })

      if (log.length > shown.length) {
        wideButton(y, tr('olderMatches', { n: log.length - shown.length }), () => this.reload(true))
        y += 68
      }

      if (log.length) {
        text({
          x: px(12),
          y: px(y),
          w: px(366),
          h: px(28),
          text: tr('holdToDelete'),
          text_size: px(18),
          color: C.muted,
          align_h: hmUI.align.CENTER_H,
        })
        this.clearY = y + 34
        this.clearBtn = button(this.clearProps(false))
        this.clearConfirm = confirmTwice(
          (on) => restyle(this.clearBtn, this.clearProps(on)),
          () => {
            clearLog()
            replace({ url: 'page/history' })
          },
        )
        y += 98
      }

      backButton(y + 4, tr('back'), () => back())
      if (this.top) scrollTo({ y: -Math.abs(this.top) })
    },

    // Rebuilds the page at the current scroll position.
    reload(all) {
      replace({ url: 'page/history', params: { all, top: getScrollTop() } })
    },

    clearProps(confirm) {
      return {
        x: px(12),
        y: px(this.clearY),
        w: px(366),
        h: px(60),
        radius: px(30),
        text: confirm ? tr('clearConfirm') : tr('clearLog'),
        text_size: px(24),
        color: confirm ? 0x000000 : C.danger,
        normal_color: confirm ? C.danger : C.pill,
        press_color: confirm ? C.dangerPress : C.tile,
        click_func: () => this.clearConfirm.tap(),
      }
    },

    onDestroy() {
      if (this.clearConfirm) this.clearConfirm.stop()
      clearTimeout(this.holdTimer)
      clearTimeout(this.armTimer)
      if (this.stopClock) this.stopClock()
    },

    // A custom team name as typed, otherwise the default in sentence case ("Wir", "Us", "Nosotros").
    winnerName(entry) {
      const custom = entry.names && entry.names[entry.winner]
      return custom || tr(entry.winner === 0 ? 'usName' : 'themName')
    },

    // Four widgets per match: card, one line with date, mode and duration, the set scores, the result.
    buildEntry(entry, y) {
      const card = rect({ x: px(12), y, w: px(366), h: px(CARD_H), radius: px(24), color: C.card })
      // Gets smaller if needed, e.g. "10/31 12:45 pm · Star Point · 1:30".
      const line = fitText(
        `${dateText(entry.startedAt)} · ${tr(entry.mode)} · ${durationText(entry, entry.endedAt)}`,
        px(330),
        [18, 16, 14].map(px),
      )
      const info = text({
        x: px(30),
        y: y + px(10),
        w: px(330),
        h: px(24),
        text_size: line.size,
        color: C.muted,
        text: line.text,
      })
      const sets = setsText(entry) || '–'
      const score = text({
        x: px(30),
        y: y + px(36),
        w: px(330),
        h: px(38),
        text: sets,
        text_size: px(sets.length > 18 ? 24 : 30),
      })
      // A damaged entry without a winner shows as abandoned.
      const won = !entry.abandoned && (entry.winner === 0 || entry.winner === 1)
      const resultText = won ? tr('winner', { name: this.winnerName(entry) }) : tr('abandoned')
      const resultColor = won ? teamColor(entry, entry.winner).text : C.muted
      const result = text({
        x: px(30),
        y: y + px(74),
        w: px(330),
        h: px(24),
        text_size: px(18),
        text: resultText,
        color: resultColor,
      })

      // Armed: dark red card, the last line asks for the confirming tap.
      const paint = (armed) => {
        card.setProperty(hmUI.prop.COLOR, armed ? C.dangerDark : C.card)
        result.setProperty(hmUI.prop.TEXT, armed ? tr('deleteEntry') : resultText)
        result.setProperty(hmUI.prop.COLOR, armed ? C.danger : resultColor)
      }
      this.holdable([card, info, score, result], {
        hold: () => this.arm(entry.startedAt, paint),
        tap: () => {
          if (!this.armed || this.armed.id !== entry.startedAt) return
          deleteLogEntry(entry.startedAt)
          this.reload(this.showAll)
        },
      })
    },

    // Only one card is armed at a time; it falls back after CONFIRM_MS.
    arm(id, paint) {
      if (this.armed) this.armed.paint(false)
      this.armed = { id, paint }
      paint(true)
      clearTimeout(this.armTimer)
      this.armTimer = setTimeout(
        safe('arm', () => {
          paint(false)
          this.armed = null
        }),
        CONFIRM_MS,
      )
    },

    // Long press and tap on a card and the widgets drawn on top of it. Holding HOLD_MS calls
    // hold(); lifting the finger before that calls tap(). Sliding (scrolling) cancels both, so
    // scrolling never arms or deletes a card; small jitter does not. Once the page scrolls, the
    // watch may stop reporting moves to the card, so the scroll position is checked as well.
    // Stacked widgets may all report the same lift, so a tap only counts once.
    holdable(widgets, { hold, tap }) {
      let held = false
      let lastUp = 0
      let top = 0
      const scrolled = () => Math.abs(getScrollTop() - top) > 2
      onTouch(widgets, {
        down: () => {
          held = false
          top = getScrollTop()
          clearTimeout(this.holdTimer)
          this.holdTimer = setTimeout(
            safe('hold', () => {
              if (scrolled()) return
              held = true
              hold()
            }),
            HOLD_MS,
          )
        },
        slide: () => clearTimeout(this.holdTimer),
        up: (slid) => {
          clearTimeout(this.holdTimer)
          const now = Date.now()
          if (now - lastUp < 150) return
          lastUp = now
          if (!held && !slid && !scrolled()) tap()
        },
      })
    },
  }),
)
