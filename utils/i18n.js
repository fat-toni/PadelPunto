// Language choice and text lookup for German, English and Spanish (texts in locales/).
// cfg.lang 'auto' follows the watch language (German, English and Spanish watches get their
// language, every other language English, like defaultLanguage in app.json).
import { getLanguage } from '@zos/settings'
import { loadCfg } from './config'
import { hourText, is12h } from './time'
import { STRINGS } from '../locales'

export const APP_NAME = 'Padel Punto'

// Zepp OS language codes, see "Multilingual Mapping" in the Zepp OS docs.
const SYSTEM = { 2: 'en', 3: 'es', 7: 'de' }

// Each language's own name, the same in every language.
const LANG_NAMES = { de: 'Deutsch', en: 'English', es: 'Español' }

let lang = null

// The language in use; read from the config the first time a page asks.
export function currentLang() {
  if (lang) return lang
  const pick = loadCfg().lang
  if (pick && pick !== 'auto') lang = pick
  else {
    try {
      lang = SYSTEM[getLanguage()] || 'en'
    } catch (e) {
      lang = 'en'
    }
  }
  return lang
}

// Called after the language option changes, so the next tr() reads the config again.
export function resetLang() {
  lang = null
}

export function tr(key, vars) {
  const s = STRINGS[currentLang()][key] || STRINGS.de[key] || key
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k])) : s
}

export function langLabel(v) {
  return v === 'auto' ? tr('langAuto') : LANG_NAMES[v]
}

export const MAX_NAME = 8

// The translated default names (WIR/DIE, US/THEM, NOS/ELLOS).
export function defaultNames() {
  return [tr('us'), tr('them')]
}

// Team names for a match config or log entry: the custom name, or the default.
export function teamNames(cfg) {
  const custom = (cfg && cfg.names) || ['', '']
  return defaultNames().map((d, t) => custom[t] || d)
}

// Text shown at 40:40 or in a tiebreak, from deuceInfo() in score.js.
export function hintText(info) {
  if (!info) return ''
  if (info.key === 'deuceN') return tr('deuceN', { n: info.n })
  return tr(info.key)
}

// "14.10. 18:30" (de), "10/14 18:30" (en), "14/10 18:30" (es) in the watch's local time,
// with "pm"/"am" added when the watch uses the 12-hour clock.
export function dateText(ts) {
  const d = new Date(ts)
  const two = (n) => String(n).padStart(2, '0')
  const day = two(d.getDate())
  const month = two(d.getMonth() + 1)
  const date = { de: `${day}.${month}.`, en: `${month}/${day}`, es: `${day}/${month}` }[currentLang()]
  const ampm = is12h() ? (d.getHours() < 12 ? ' am' : ' pm') : ''
  return `${date} ${hourText(d.getHours(), d.getMinutes())}${ampm}`
}
