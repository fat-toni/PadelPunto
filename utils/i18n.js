// Language choice and text lookup for German, English, Spanish, Italian and French (texts in locales/).
// cfg.lang 'auto' follows the watch language (watches in one of these languages get it, every
// other language English, like defaultLanguage in app.json).
import { getLanguage } from '@zos/settings'
import { loadCfg, COLOR_KEYS } from './config'
import { isTraining } from './training'
import { hourText, is12h } from './time'
import { STRINGS } from '../locales'

export const APP_NAME = 'Padel Punto'

// Zepp OS language codes, see "Multilingual Mapping" in the Zepp OS docs.
const SYSTEM = { 2: 'en', 3: 'es', 6: 'fr', 7: 'de', 10: 'it' }

// Each language's own name, the same in every language.
const LANG_NAMES = { de: 'Deutsch', en: 'English', es: 'Español', it: 'Italiano', fr: 'Français' }

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

// The translated default names (WIR/DIE, US/THEM, NOS/ELLOS, NOI/LORO, NOUS/EUX).
export function defaultNames() {
  return [tr('us'), tr('them')]
}

// The name of team t's color ("Grün"); older log entries have no colors.
export function colorName(cfg, t) {
  const colors = (cfg && cfg.colors) || [0, 1]
  return tr(COLOR_KEYS[colors[t]] || COLOR_KEYS[t])
}

// Team names for a match config or log entry: the custom name, or the default. In a training
// the teams are called by their color (GRÜN, BLAU), whatever names are set.
export function teamNames(cfg) {
  if (isTraining(cfg)) return [0, 1].map((t) => colorName(cfg, t).toUpperCase())
  const custom = (cfg && cfg.names) || ['', '']
  return defaultNames().map((d, t) => custom[t] || d)
}

// Text shown at 40:40 or in a tiebreak, from deuceInfo() in score.js.
export function hintText(info) {
  if (!info) return ''
  if (info.key === 'deuceN') return tr('deuceN', { n: info.n })
  return tr(info.key)
}

// "14.10. 18:30" (de), "10/14 18:30" (en), "14/10 18:30" (es, it, fr) in the watch's local time,
// with "pm"/"am" added when the watch uses the 12-hour clock.
export function dateText(ts) {
  const d = new Date(ts)
  const two = (n) => String(n).padStart(2, '0')
  const day = two(d.getDate())
  const month = two(d.getMonth() + 1)
  const date = {
    de: `${day}.${month}.`,
    en: `${month}/${day}`,
    es: `${day}/${month}`,
    it: `${day}/${month}`,
    fr: `${day}/${month}`,
  }[currentLang()]
  const ampm = is12h() ? (d.getHours() < 12 ? ' am' : ' pm') : ''
  return `${date} ${hourText(d.getHours(), d.getMinutes())}${ampm}`
}
