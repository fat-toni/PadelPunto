// Options: one card per rule or setting, grouped under small section headings, saved on every change. Most cards cycle through
// their values on tap; name cards open the watch keyboard, color cards cycle the team colors.
// The page scrolls. It is opened with replace() and left with replace() to the start screen
// (button, swipe right or back key), so the start screen is rebuilt in the chosen language.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { onGesture, offGesture, GESTURE_RIGHT, onKey, offKey, KEY_BACK, KEY_EVENT_CLICK } from '@zos/interaction'
import { loadCfg, saveCfg, CHOICES } from '../utils/config'
import { read } from '../utils/files'
import { C, TEAM_COLORS, HEADER_H, text, fitText, rect, tappable, button, fullScreen, header } from '../utils/theme'
import { tr, langLabel, resetLang, defaultNames, MAX_NAME } from '../utils/i18n'
import { safePage, safe } from '../utils/errors'
import { toast } from '../utils/toast'

const CARD_H = 58
const STEP = 64
const SECTION_H = 40
const HINT_H = 34
const COLOR_IDS = TEAM_COLORS.map((_, i) => i)

// kind 'section': heading above a group; 'hint': small grey line (with `open`: only while a
// match is open); 'cycle': tap shows the next
// value; 'name': keyboard, long press restores the default name; 'color': next team color.
// `when(cfg)`: the card is greyed out and does nothing while it is false.
const OPTIONS = [
  { kind: 'section', title: 'secRules' },
  { kind: 'cycle', key: 'mode', title: 'optMode', values: CHOICES.mode, label: (v) => tr(v) },
  {
    kind: 'cycle',
    key: 'bestOf',
    title: 'optSets',
    values: CHOICES.bestOf,
    label: (v) => (v === 3 ? tr('bestOf3') : tr('oneSet')),
  },
  {
    kind: 'cycle',
    key: 'games',
    title: 'optGames',
    values: CHOICES.games,
    label: (v) => (v === 4 ? tr('games4') : tr('games6')),
  },
  {
    kind: 'cycle',
    key: 'decider',
    title: 'optDecider',
    values: CHOICES.decider,
    label: (v) => tr({ set: 'deciderSet', noTb: 'deciderNoTb', mtb7: 'deciderMtb7', mtb: 'deciderMtb' }[v]),
  },
  {
    kind: 'cycle',
    key: 'sides',
    title: 'optSides',
    values: CHOICES.sides,
    label: (v) => tr({ fip: 'sidesFip', set: 'sidesSet', never: 'sidesNever' }[v]),
  },
  { kind: 'hint', title: 'rulesLater', open: true },
  { kind: 'section', title: 'secTeams' },
  { kind: 'name', team: 0, title: 'optName0' },
  { kind: 'color', team: 0, title: 'optColor0' },
  { kind: 'name', team: 1, title: 'optName1' },
  { kind: 'color', team: 1, title: 'optColor1' },
  { kind: 'hint', title: 'holdName' },
  { kind: 'section', title: 'secMatch' },
  {
    kind: 'cycle',
    key: 'switchBuzz',
    title: 'optSwitch',
    values: CHOICES.switchBuzz,
    label: (v) => (v === 'on' ? tr('switchOn') : tr('switchOff')),
  },
  {
    kind: 'cycle',
    key: 'pause',
    title: 'optPause',
    values: CHOICES.pause,
    label: (v) => (v === 'off' ? tr('pauseOff') : tr('pauseOn')),
  },
  { kind: 'hint', title: 'pauseTimes' },
  {
    kind: 'cycle',
    key: 'screen',
    title: 'optScreen',
    values: CHOICES.screen,
    label: (v) => (v === 'on' ? tr('screenOn') : tr('screenAuto')),
  },
  { kind: 'section', title: 'secGeneral' },
  { kind: 'cycle', key: 'lang', title: 'optLang', values: CHOICES.lang, label: langLabel },
  {
    kind: 'cycle',
    key: 'voice',
    title: 'optVoice',
    values: CHOICES.voice,
    label: (v) => (v === 'on' ? tr('voiceOn') : tr('voiceOff')),
  },
  {
    kind: 'cycle',
    key: 'volume',
    title: 'optVolume',
    values: CHOICES.volume,
    when: (cfg) => cfg.voice === 'on',
    label: (v) => (v === 'low' ? tr('volLow') : tr('volHigh')),
  },
  {
    kind: 'cycle',
    key: 'hr',
    title: 'optHr',
    values: CHOICES.hr,
    label: (v) => (v === 'on' ? tr('hrOn') : tr('hrOff')),
  },
]

function home() {
  replace({ url: 'page/start' })
}

Page(
  safePage('options', {
    build() {
      fullScreen()
      this.cfg = loadCfg()
      // paint() of the cards with `when`, redrawn after every change
      this.conditional = []
      // An open match keeps its rules; changes to them count from the next match.
      const matchOpen = !!read('match', null)

      this.stopClock = header(tr('options'))
      let y = HEADER_H
      for (const opt of OPTIONS) {
        if (opt.open && !matchOpen) continue
        if (opt.kind === 'section') {
          this.buildSection(opt, px(y))
          y += SECTION_H
        } else if (opt.kind === 'hint') {
          this.buildHint(opt, px(y))
          y += HINT_H
        } else {
          this.buildOption(opt, px(y))
          y += STEP
        }
      }

      // Same size and place as the "Zurück" button on Info and History, but in ball color.
      button({
        x: px(95),
        y: px(y + 6),
        w: px(200),
        h: px(52),
        radius: px(26),
        text: tr('done'),
        text_size: px(24),
        color: 0x000000,
        normal_color: C.ball,
        press_color: C.ballPress,
        click_func: home,
      })

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

    // A section heading in ball color, aligned with the card titles below it.
    buildSection(opt, y) {
      text({
        x: px(30),
        y: y + px(8),
        w: px(330),
        h: px(28),
        text: tr(opt.title).toUpperCase(),
        text_size: px(20),
        color: C.ball,
      })
    },

    // A small grey line below a group, centered like the hint in the history.
    buildHint(opt, y) {
      const fit = fitText(tr(opt.title), px(366), [18, 16].map(px))
      text({
        x: px(12),
        y: y - px(2),
        w: px(366),
        h: px(28),
        text: fit.text,
        text_size: fit.size,
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })
    },

    // A card with a small title and the current value; cycle and color cards also show
    // one dot per value on the right (color dots in their color, the chosen one ringed).
    buildOption(opt, y) {
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
      const value = text({
        x: px(30),
        y: y + px(25),
        w: px(opt.kind === 'color' ? 200 : 260),
        h: px(30),
        text: '',
        text_size: px(25),
      })
      const values = opt.kind === 'cycle' ? opt.values : opt.kind === 'color' ? COLOR_IDS : []
      const dotX = (j) => px(352 - (values.length - 1 - j) * 16)
      const rings =
        opt.kind === 'color'
          ? values.map((_, j) =>
              hmUI.createWidget(hmUI.widget.CIRCLE, {
                center_x: dotX(j),
                center_y: y + px(29),
                radius: px(7),
                color: 0xffffff,
              }),
            )
          : []
      const dots = values.map((_, j) =>
        hmUI.createWidget(hmUI.widget.CIRCLE, {
          center_x: dotX(j),
          center_y: y + px(29),
          radius: px(opt.kind === 'color' ? 5 : 4),
          color: opt.kind === 'color' ? TEAM_COLORS[j].text : C.off,
        }),
      )

      const active = () => !opt.when || opt.when(this.cfg)
      const paint = () => {
        if (opt.kind === 'cycle') {
          const idx = opt.values.indexOf(this.cfg[opt.key])
          const on = active()
          // Long values (e.g. "Siempre encendida") get a little smaller.
          const fit = fitText(opt.label(this.cfg[opt.key]), px(260), [25, 22, 20].map(px))
          value.setProperty(hmUI.prop.MORE, { text: fit.text, text_size: fit.size })
          value.setProperty(hmUI.prop.COLOR, on ? 0xffffff : C.dim)
          title.setProperty(hmUI.prop.COLOR, on ? C.muted : C.dim)
          dots.forEach((d, j) => d.setProperty(hmUI.prop.COLOR, on && j === idx ? C.ball : C.off))
        } else if (opt.kind === 'color') {
          const idx = this.cfg.colors[opt.team]
          value.setProperty(hmUI.prop.TEXT, tr(TEAM_COLORS[idx].key))
          value.setProperty(hmUI.prop.COLOR, TEAM_COLORS[idx].text)
          rings.forEach((r, j) => r.setProperty(hmUI.prop.VISIBLE, j === idx))
        } else {
          const custom = this.cfg.names[opt.team]
          value.setProperty(hmUI.prop.TEXT, custom || tr('nameDefault', { name: defaultNames()[opt.team] }))
          value.setProperty(hmUI.prop.COLOR, custom ? 0xffffff : C.muted)
        }
      }

      if (opt.when) this.conditional.push(paint)
      const onHold = opt.kind === 'name' ? () => this.resetName(opt.team, paint) : undefined
      tappable(
        card,
        [title, value],
        C.card,
        () => (active() ? C.tile : C.card),
        () => {
          if (!active()) return
          if (opt.kind === 'name') return this.editName(opt.team, paint)
          if (opt.kind === 'color') {
            // The other team's color is skipped, so the two cards never look alike.
            const colors = [...this.cfg.colors]
            do colors[opt.team] = (colors[opt.team] + 1) % TEAM_COLORS.length
            while (colors[opt.team] === colors[1 - opt.team])
            this.cfg.colors = colors
          } else {
            this.cfg[opt.key] = opt.values[(opt.values.indexOf(this.cfg[opt.key]) + 1) % opt.values.length]
          }
          saveCfg(this.cfg)
          // A new language redraws the whole page in it.
          if (opt.key === 'lang') {
            resetLang()
            replace({ url: 'page/options' })
            return
          }
          paint()
          for (const other of this.conditional) if (other !== paint) other()
        },
        onHold,
      )
      paint()
    },

    // Long press on a name card: back to the default name ("Wir", "Die" …); nothing if it is one.
    resetName(team, paint) {
      if (!this.cfg.names[team]) return
      const names = [...this.cfg.names]
      names[team] = ''
      this.cfg.names = names
      saveCfg(this.cfg)
      paint()
      toast(tr('nameReset'))
    },

    // Opens the watch keyboard with the current name; an empty name restores the default.
    editName(team, paint) {
      const close = () => {
        try {
          hmUI.deleteKeyboard()
        } catch (e) {}
      }
      try {
        hmUI.createKeyboard({
          inputType: hmUI.inputType.CHAR,
          text: this.cfg.names[team],
          onComplete: safe('keyboard', (_, result) => {
            const names = [...this.cfg.names]
            names[team] = String(result.data || '')
              .trim()
              .slice(0, MAX_NAME)
            this.cfg.names = names
            saveCfg(this.cfg)
            close()
            paint()
          }),
          onCancel: safe('keyboard', close),
        })
      } catch (e) {
        toast(tr('noKeyboard'))
      }
    },

    onDestroy() {
      offGesture()
      offKey()
      if (this.stopClock) this.stopClock()
    },
  }),
)
