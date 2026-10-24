// Asked on every new match and training: which team serves first. Tapping a team starts the match.
// "Zufall" brings up a racket between the cards and turns into "Drehen"; that spins the racket:
// it slows down and stops with its head pointing at the team that serves, that card lights up,
// and the match starts.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { newMatch } from '../utils/score'
import { loadCfg } from '../utils/config'
import { saveMatch } from '../utils/store'
import { C, text, fitText, rect, tappable, button, restyle, clock, fullScreen, teamColor } from '../utils/theme'
import { tr, teamNames } from '../utils/i18n'
import { safePage, safe } from '../utils/errors'
import { toast } from '../utils/toast'

// Racket spin: full turns before it stops, its length, the time per frame, and how long the
// result shows before the match starts.
const SPIN_TURNS = 3
const SPIN_MS = 2400
const FRAME_MS = 40
const RESULT_MS = 1500
// img/racket.png (tools/logo.py) and the square it turns in, centered in the gap between the cards.
const RACKET_W = 105
const RACKET_H = 200
const SPIN_BOX = 210
const SPIN_CY = 230

Page(
  safePage('serve', {
    // params (JSON, from page/training): { training: true } = a training as set up there.
    onInit(params) {
      let p = {}
      try {
        p = JSON.parse(params || '{}') || {}
      } catch (e) {}
      this.training = p.training === true
    },

    // The options, for a training with its target, or its total and serve turn.
    matchCfg() {
      const cfg = loadCfg()
      if (!this.training) return cfg
      if (cfg.trainKind === 'americano') return { ...cfg, total: cfg.trainTotal, serveEvery: cfg.trainServe }
      return { ...cfg, target: cfg.trainTo }
    },

    build() {
      fullScreen()
      this.stopClock = clock({
        x: px(12),
        y: px(6),
        w: px(366),
        h: px(30),
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })
      // Smaller if needed: "¿Quién saca primero?" is long.
      const title = fitText(tr('whoServes'), px(350), [32, 28, 24].map(px))
      this.title = text({
        x: px(12),
        y: px(40),
        w: px(366),
        h: px(44),
        text: title.text,
        text_size: title.size,
        align_h: hmUI.align.CENTER_H,
      })

      const cfg = this.matchCfg()
      this.names = teamNames(cfg)
      this.cards = [0, 1].map((t) => {
        // Same order as the match screen: opponents on top, own team below.
        const y = px(96 + (1 - t) * 140)
        const team = teamColor(cfg, t)
        const card = rect({ x: px(12), y, w: px(366), h: px(128), radius: px(28), color: team.card })
        const name = text({
          x: px(12),
          y,
          w: px(366),
          h: px(128),
          text: this.names[t],
          text_size: px(this.names[t].length > 5 ? 48 : 72),
          color: team.text,
          align_h: hmUI.align.CENTER_H,
        })
        tappable(card, [name], team.card, team.press, () => {
          if (this.spinning) return
          this.start(t)
        })
        return { card, press: team.press }
      })

      // Two pills side by side, kept away from the rounded screen corners.
      const pill = (x, label, color, onClick) => ({
        x: px(x),
        y: px(386),
        w: px(150),
        h: px(52),
        radius: px(26),
        text: label,
        text_size: px(24),
        color,
        normal_color: C.pill,
        press_color: C.tile,
        click_func: onClick,
      })
      button(pill(40, tr('cancel'), 0xffffff, () => replace({ url: 'page/start' })))
      const random = button(
        pill(200, tr('random'), C.ball, () => {
          if (this.racket) return this.spin()
          // Created only now: the watch ignores visible: false on a new image and would show it at once.
          this.racket = hmUI.createWidget(hmUI.widget.IMG, this.racketProps(0))
          restyle(
            random,
            pill(200, tr('spin'), C.ball, () => this.spin()),
          )
        }),
      )
    },

    // The racket turned by angle degrees around its middle; 0 = head up.
    racketProps(angle) {
      return {
        x: px(195 - SPIN_BOX / 2),
        y: px(SPIN_CY - SPIN_BOX / 2),
        w: px(SPIN_BOX),
        h: px(SPIN_BOX),
        pos_x: px((SPIN_BOX - RACKET_W) / 2),
        pos_y: px((SPIN_BOX - RACKET_H) / 2),
        center_x: px(SPIN_BOX / 2),
        center_y: px(SPIN_BOX / 2),
        angle,
        src: 'img/racket.png',
      }
    },

    // Picks the first server at random: head up = the opponents (top card), head down = own team.
    spin() {
      if (this.spinning) return
      this.spinning = true
      const t = Math.random() < 0.5 ? 0 : 1
      const total = SPIN_TURNS * 360 + (t === 0 ? 180 : 0)
      const frames = Math.round(SPIN_MS / FRAME_MS)
      let frame = 0
      const step = safe('spin', () => {
        frame++
        // Ease out: fast at first, slowing down to a stop.
        const k = 1 - Math.pow(1 - frame / frames, 3)
        this.racket.setProperty(hmUI.prop.MORE, this.racketProps(Math.round(total * k) % 360))
        if (frame < frames) this.timer = setTimeout(step, FRAME_MS)
        else this.showResult(t)
      })
      this.timer = setTimeout(step, FRAME_MS)
    },

    showResult(t) {
      this.cards[t].card.setProperty(hmUI.prop.COLOR, this.cards[t].press)
      const title = fitText(tr('serveFor', { name: this.names[t] }), px(350), [32, 28, 24].map(px))
      this.title.setProperty(hmUI.prop.TEXT_SIZE, title.size)
      this.title.setProperty(hmUI.prop.TEXT, title.text)
      this.title.setProperty(hmUI.prop.COLOR, C.ball)
      this.timer = setTimeout(
        safe('spin', () => this.start(t)),
        RESULT_MS,
      )
    },

    // If the new match can't be saved (storage full), the page stays and says so; the cards and
    // "Drehen" can be tried again.
    start(t) {
      const cfg = { ...this.matchCfg(), firstServer: t }
      if (!saveMatch(newMatch(cfg, Date.now()), [])) {
        this.spinning = false
        toast(tr('saveFailed'))
        return
      }
      replace({ url: 'page/match' })
    },

    onDestroy() {
      clearTimeout(this.timer)
      if (this.stopClock) this.stopClock()
    },
  }),
)
