// Training (cone button on the start screen): only points are counted (utils/training.js). Cards as
// in the options (tap = next value, dots on the right, saved at once): the type, "Bis Ziel" up to
// 7, 11, 15 or 21 points with a lead of two and a cap, or Americano with 16, 24 or 32 points in
// all and the serve changing every 2 or 4 points. "Los" goes on to "Wer schlägt auf?" like
// "Neues Spiel"; an open match goes to the log first (the hint says so). Opened and left with
// replace() like the options ("Abbrechen", swipe right or back key).
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { hasStarted } from '../utils/score'
import { TRAIN_CAP } from '../utils/training'
import { loadCfg, saveCfg, CHOICES } from '../utils/config'
import { loadMatch, archiveMatch, matchStatus } from '../utils/store'
import { C, text, fitText, rect, tappable, button, fullScreen, header, onLeave, HEADER_H } from '../utils/theme'
import { tr } from '../utils/i18n'
import { safePage } from '../utils/errors'
import { toast } from '../utils/toast'

const CARD_H = 58
const STEP = 64

function home() {
  replace({ url: 'page/start' })
}

// The cards per type: config key, title and how a value reads.
const CARDS = {
  race: [{ key: 'trainTo', title: 'trainPoints', label: (v) => String(v) }],
  americano: [
    { key: 'trainTotal', title: 'trainTotal', label: (v) => String(v) },
    { key: 'trainServe', title: 'trainServe', label: (v) => tr('serveEvery', { n: v }) },
  ],
}
const KIND = { key: 'trainKind', title: 'trainKind', label: (v) => tr(v) }

// The rule in one or two lines below the cards.
function rules(cfg) {
  if (cfg.trainKind === 'americano') return [tr('trainAmericanoRule', { n: cfg.trainTotal })]
  return [tr('trainRule'), tr('trainCap', { n: TRAIN_CAP[cfg.trainTo] })]
}

Page(
  safePage('training', {
    build() {
      fullScreen()
      this.stopClock = header(tr('training'))
      this.cfg = loadCfg()
      const open = matchStatus() === 'open'

      const cards = [KIND, ...CARDS[this.cfg.trainKind]]
      cards.forEach((opt, i) => this.buildCard(opt, px(HEADER_H + 4 + i * STEP)))

      // Small lines below the cards: the rule (redrawn with the cards), then the hint about an
      // open match in ball color.
      const line = (y, color) =>
        text({ x: px(12), y: px(y), w: px(366), h: px(26), text: '', color, align_h: hmUI.align.CENTER_H })
      const top = HEADER_H + 8 + cards.length * STEP
      this.ruleLines = rules(this.cfg).map((_, i) => line(top + i * 28, C.muted))
      this.paintRules()
      if (open) {
        const fit = fitText(tr('trainEndsOld'), px(366), [18, 16, 14].map(px))
        line(top + this.ruleLines.length * 28, C.ball).setProperty(hmUI.prop.MORE, {
          text: fit.text,
          text_size: fit.size,
        })
      }

      // Two pills side by side like on "Wer schlägt auf?", "Los" in ball color.
      const pill = (x, label, color, bg, press, onClick) =>
        button({
          x: px(x),
          y: px(386),
          w: px(150),
          h: px(52),
          radius: px(26),
          text: label,
          text_size: px(24),
          color,
          normal_color: bg,
          press_color: press,
          click_func: onClick,
        })
      pill(40, tr('cancel'), 0xffffff, C.pill, C.tile, home)
      pill(200, tr('go'), 0x000000, C.ball, C.ballPress, () => this.start())
      this.offLeave = onLeave(home)
    },

    paintRules() {
      rules(this.cfg).forEach((s, i) => {
        const fit = fitText(s, px(366), [18, 16, 14].map(px))
        this.ruleLines[i].setProperty(hmUI.prop.MORE, { text: fit.text, text_size: fit.size })
      })
    },

    // A card with a small title, the current value and one dot per value, as in the options.
    // The type card redraws the page, as the cards below it change with it.
    buildCard(opt, y) {
      const values = CHOICES[opt.key]
      const card = rect({ x: px(12), y, w: px(366), h: px(CARD_H), radius: px(18), color: C.card })
      const title = text({
        x: px(30),
        y: y + px(5),
        w: px(260),
        h: px(20),
        text: tr(opt.title),
        text_size: px(17),
        color: C.muted,
      })
      const value = text({ x: px(30), y: y + px(25), w: px(260), h: px(30), text: '', text_size: px(25) })
      const dots = values.map((_, j) =>
        hmUI.createWidget(hmUI.widget.CIRCLE, {
          center_x: px(352 - (values.length - 1 - j) * 16),
          center_y: y + px(29),
          radius: px(4),
          color: C.off,
        }),
      )
      const paint = () => {
        const v = this.cfg[opt.key]
        const fit = fitText(opt.label(v), px(260), [25, 22, 20].map(px))
        value.setProperty(hmUI.prop.MORE, { text: fit.text, text_size: fit.size })
        dots.forEach((d, j) => d.setProperty(hmUI.prop.COLOR, values[j] === v ? C.ball : C.off))
      }
      tappable(card, [title, value], C.card, C.tile, () => {
        this.cfg[opt.key] = values[(values.indexOf(this.cfg[opt.key]) + 1) % values.length]
        saveCfg(this.cfg)
        if (opt.key === 'trainKind') return replace({ url: 'page/training' })
        paint()
        this.paintRules()
      })
      paint()
    },

    // As "Neues Spiel": an old match that can't be moved to the log (storage full) is kept.
    start() {
      const saved = loadMatch()
      if (saved && hasStarted(saved) && !archiveMatch(saved)) {
        toast(tr('saveFailed'))
        return
      }
      replace({ url: 'page/serve', params: { training: true } })
    },

    onDestroy() {
      if (this.offLeave) this.offLeave()
      if (this.stopClock) this.stopClock()
    },
  }),
)
