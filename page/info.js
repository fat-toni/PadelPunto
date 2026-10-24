// Info: logo, app name, version and developer. Opened and left with replace() from the options
// (button, swipe right or back key), as the options' own swipe would otherwise go to the start. DIAG_TAPS quick taps on the logo (a big target, unlike the
// version line) open the hidden diagnosis page.
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { getPackageInfo } from '@zos/app'
import { C, text, fullScreen, header, backButton, onTouch, onLeave } from '../utils/theme'
import { tr, APP_NAME } from '../utils/i18n'
import { safePage } from '../utils/errors'

const DEVELOPER = 'Toni & Claude AI'
const DIAG_TAPS = 5
const DIAG_WINDOW_MS = 3000

function options() {
  replace({ url: 'page/options' })
}

function version() {
  try {
    const v = getPackageInfo().version
    return typeof v === 'string' ? v : v.name
  } catch (e) {
    return ''
  }
}

Page(
  safePage('info', {
    build() {
      fullScreen()
      this.stopClock = header(tr('info'))

      const logo = hmUI.createWidget(hmUI.widget.IMG, {
        x: px(120),
        y: px(78),
        w: px(150),
        h: px(150),
        src: 'img/logo.png',
      })
      const center = { x: px(12), w: px(366), align_h: hmUI.align.CENTER_H }
      text({ ...center, y: px(230), h: px(40), text: APP_NAME, text_size: px(34), color: C.ball })
      const v = version()
      text({ ...center, y: px(270), h: px(28), text: v ? tr('version', { v }) : '', text_size: px(22), color: C.muted })
      text({ ...center, y: px(310), h: px(24), text: tr('developer'), text_size: px(18), color: C.muted })
      text({ ...center, y: px(334), h: px(34), text: DEVELOPER, text_size: px(26) })

      let taps = []
      onTouch([logo], {
        down: () => {},
        slide: () => {},
        up: (slid) => {
          if (slid) return
          const now = Date.now()
          taps = [...taps.filter((t) => now - t < DIAG_WINDOW_MS), now]
          if (taps.length < DIAG_TAPS) return
          taps = []
          replace({ url: 'page/diag' })
        },
      })

      backButton(384, tr('back'), options)
      this.offLeave = onLeave(options)
    },

    onDestroy() {
      if (this.offLeave) this.offLeave()
      if (this.stopClock) this.stopClock()
    },
  }),
)
