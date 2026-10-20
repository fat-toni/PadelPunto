// Diagnosis, hidden: 5 quick taps on the logo on Info. Greets with a joke, shows the watch (model, display,
// Zepp OS, API level, build), storage (the app's files, the log, free space), a sound test and
// the error log.
// Opened with push(); the system back gesture returns.
import * as hmUI from '@zos/ui'
import { back, replace } from '@zos/router'
import { px } from '@zos/utils'
import { getDeviceInfo, getDiskInfo, SCREEN_SHAPE_ROUND } from '@zos/device'
import { getSystemInfo } from '@zos/settings'
import { getPackageInfo } from '@zos/app'
import { create, id } from '@zos/media'
import { size } from '../utils/files'
import { loadLog } from '../utils/store'
import { loadErrors, clearErrors, safePage } from '../utils/errors'
import {
  C,
  HEADER_H,
  text,
  fitText,
  button,
  restyle,
  fullScreen,
  header,
  backButton,
  confirmTwice,
} from '../utils/theme'
import { tr, dateText } from '../utils/i18n'

const ROW_H = 30
// Raised by hand with each test build, so a preview on the watch can be told apart from the
// previous one (the version stays the same until a release).
const BUILD = '20.10. 15:12'
const FILES = ['cfg', 'match', 'log', 'errors']
// "¡Pádel Punto!" in Spanish (tools/voice.py). The docs say file paths start in the assets folder
// but show only 'data://' in their example, so the test tries both spellings in turn.
const SOUND_PATHS = ['sound/padel_punto.mp3', 'assets://sound/padel_punto.mp3']
// A small joke as a reward for finding this page, one of joke1 … joke3 at random.
const JOKES = 3
function attempt(fn, fallback) {
  try {
    return fn()
  } catch (e) {
    return fallback
  }
}

const mb = (bytes) => (bytes >= 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${(bytes / 1e6).toFixed(1)} MB`)
const kb = (bytes) => (bytes < 1000 ? `${bytes} B` : `${(bytes / 1000).toFixed(1)} KB`)

Page(
  safePage('diag', {
    build() {
      fullScreen()
      this.stopClock = header(tr('diag'))
      this.y = HEADER_H
      this.line(tr(`joke${1 + Math.floor(Math.random() * JOKES)}`), C.ball)

      const dev = attempt(getDeviceInfo, null) || {}
      const sys = attempt(getSystemInfo, null) || {}
      const disk = attempt(getDiskInfo, null)
      const pkg = attempt(getPackageInfo, null) || {}
      const v = pkg.version && typeof pkg.version === 'object' ? pkg.version : {}

      this.section(tr('diagWatch'))
      this.row(tr('diagModel'), String(dev.deviceName || '?'))
      this.row('ID', String(dev.deviceSource || '?'))
      const shape = dev.screenShape === SCREEN_SHAPE_ROUND ? tr('diagRound') : tr('diagSquare')
      this.row(tr('diagScreen'), `${dev.width || '?'}×${dev.height || '?'} ${shape}`)
      this.row('Zepp OS', `${sys.osVersion || '?'} · API ${sys.minAPI || '?'}`)
      this.row(tr('diagFirmware'), sys.firmwareVersion || '?')
      this.row('App', `${v.name || '?'} (${v.code || '?'})`)
      this.row('Build', BUILD)

      this.section(tr('diagStorage'))
      const sizes = FILES.map((k) => size(k))
      this.row(tr('diagAppData'), kb(sizes.reduce((a, b) => a + b, 0)))
      FILES.forEach((k, i) => sizes[i] && this.row(`  ${k}.json`, kb(sizes[i])))
      this.row(tr('diagMatches'), String(loadLog().length))
      if (disk) {
        this.row(tr('diagFree'), `${mb(disk.free)} / ${mb(disk.total)}`)
        // All mini apps together (the watch has no figure for this app alone).
        this.row(tr('diagApps'), mb(disk.app))
      }

      this.section(tr('diagSound'))
      this.soundW = this.row(tr('diagSoundState'), tr('soundIdle'))
      this.volumeW = this.row(tr('diagVolume'), '?')
      button({
        x: px(12),
        y: px(this.y + 6),
        w: px(366),
        h: px(60),
        radius: px(30),
        text: tr('diagSoundTest'),
        text_size: px(24),
        normal_color: C.pill,
        press_color: C.tile,
        click_func: () => this.playTest(),
      })
      this.y += 72

      this.section(tr('diagErrors'))
      const errors = loadErrors()
      if (!errors.length) this.row(tr('diagNoErrors'), '')
      errors.forEach((e) => this.line(`${dateText(e.t)} ${e.where}: ${e.msg}`))
      if (errors.length) {
        this.clearY = this.y + 6
        this.clearBtn = button(this.clearProps(false))
        this.clearConfirm = confirmTwice(
          (on) => restyle(this.clearBtn, this.clearProps(on)),
          () => {
            clearErrors()
            replace({ url: 'page/diag' })
          },
        )
        this.y += 72
      }

      backButton(this.y + 10, tr('back'), () => back())
    },

    // Plays the test phrase; the status row says how far it got and which path worked.
    playTest() {
      const status = (key, extra = '') => this.soundW.setProperty(hmUI.prop.TEXT, tr(key) + extra)
      if (!this.player) {
        this.player = attempt(() => create(id.PLAYER), null)
        if (!this.player) return status('soundNoPlayer')
        const p = this.player
        p.addEventListener(p.event.PREPARE, (ok) => {
          if (!ok) return this.tryPath(this.pathIdx + 1)
          status('soundPlaying', ` (${this.pathIdx + 1})`)
          this.volumeW.setProperty(hmUI.prop.TEXT, `${attempt(() => p.getVolume(), '?')} %`)
          p.start()
        })
        p.addEventListener(p.event.COMPLETE, () => {
          status('soundDone', ` (${this.pathIdx + 1})`)
          attempt(() => p.stop())
        })
      }
      attempt(() => this.player.stop())
      this.tryPath(0)
    },

    tryPath(i) {
      this.pathIdx = i
      if (i >= SOUND_PATHS.length) return this.soundW.setProperty(hmUI.prop.TEXT, tr('soundFailed'))
      this.soundW.setProperty(hmUI.prop.TEXT, tr('soundLoading'))
      try {
        this.player.setSource(this.player.source.FILE, { file: SOUND_PATHS[i] })
        this.player.prepare()
      } catch (e) {
        this.tryPath(i + 1)
      }
    },

    // Title in ball color; gets smaller if a language makes it too long.
    section(title) {
      const t = fitText(title.toUpperCase(), px(330), [20, 18, 16].map(px))
      text({
        x: px(30),
        y: px(this.y + 8),
        w: px(330),
        h: px(28),
        text: t.text,
        text_size: t.size,
        color: C.ball,
      })
      this.y += 40
    },

    // Label left in grey, value right in white; both get smaller if needed.
    row(label, value) {
      const l = fitText(label, px(170), [18, 16, 14].map(px))
      text({ x: px(30), y: px(this.y), w: px(170), h: px(ROW_H), text: l.text, text_size: l.size, color: C.muted })
      const v = fitText(value, px(160), [20, 18, 16, 14].map(px))
      const w = text({
        x: px(200),
        y: px(this.y),
        w: px(160),
        h: px(ROW_H),
        text: v.text,
        text_size: v.size,
        align_h: hmUI.align.RIGHT,
      })
      this.y += ROW_H
      return w
    },

    // A full-width line that wraps if it is long (error messages).
    line(value, color = C.muted) {
      const h = hmUI.getTextLayout(value, { text_size: px(18), text_width: px(330), wrapped: 1 }).height || 24
      text({
        x: px(30),
        y: px(this.y),
        w: px(330),
        h: px(h + 6),
        text: value,
        text_size: px(18),
        color,
        text_style: hmUI.text_style ? hmUI.text_style.WRAP : 1,
      })
      this.y += h + 6
    },

    clearProps(confirm) {
      return {
        x: px(12),
        y: px(this.clearY),
        w: px(366),
        h: px(60),
        radius: px(30),
        text: confirm ? tr('clearConfirm') : tr('diagClearErrors'),
        text_size: px(24),
        color: confirm ? 0x000000 : C.danger,
        normal_color: confirm ? C.danger : C.pill,
        press_color: confirm ? C.dangerPress : C.tile,
        click_func: () => this.clearConfirm.tap(),
      }
    },

    onDestroy() {
      if (this.player) attempt(() => this.player.stop())
      if (this.clearConfirm) this.clearConfirm.stop()
      if (this.stopClock) this.stopClock()
    },
  }),
)
