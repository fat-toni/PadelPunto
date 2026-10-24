// The options: loaded with defaults for anything missing or invalid, saved on every change.
// Kept apart from store.js, so pages that only need the options (and the texts, via i18n.js)
// don't carry the scoring engine.
import { read, write } from './files'

// The first server is asked for on every new match (page/serve), so it is not part of the config.
// lang 'auto' follows the watch language; hr 'off' leaves the heart rate sensor off during a match;
// sides: when the teams change ends (see utils/score.js);
// voice: score announcement 'off' | 'on', volume: its loudness (utils/voice.js);
// pause 'on': a timed break at a change of ends and after a set (FIP times, see page/match.js);
// trainKind, trainTo, trainTotal, trainServe: the training last set up (page/training): "Bis Ziel"
// ('race') to trainTo points, or Americano with trainTotal points in all and the serve changing
// every trainServe points;
// an empty team name means the translated default (WIR/DIE, US/THEM, ...); colors index into
// TEAM_COLORS in theme.js.
export const DEFAULT_CFG = {
  mode: 'adv',
  bestOf: 3,
  games: 6,
  decider: 'set',
  sides: 'fip',
  screen: 'on',
  lang: 'auto',
  voice: 'off',
  volume: 'high',
  switchBuzz: 'on',
  pause: 'off',
  hr: 'on',
  trainKind: 'race',
  trainTo: 21,
  trainTotal: 24,
  trainServe: 4,
  names: ['', ''],
  colors: [0, 1],
}

// Allowed values per option, in the order the options page cycles through them.
// A saved value not in the list (damaged file) falls back to the default.
export const CHOICES = {
  mode: ['adv', 'golden', 'star'],
  bestOf: [3, 1],
  games: [6, 4],
  decider: ['set', 'noTb', 'mtb7', 'mtb'],
  sides: ['fip', 'set', 'never'],
  switchBuzz: ['on', 'off'],
  pause: ['off', 'on'],
  hr: ['on', 'off'],
  screen: ['on', 'auto'],
  lang: ['auto', 'de', 'en', 'es', 'it', 'fr'],
  voice: ['off', 'on'],
  volume: ['low', 'high'],
  trainKind: ['race', 'americano'],
  trainTo: [7, 11, 15, 21],
  trainTotal: [16, 24, 32],
  trainServe: [2, 4],
}

// The team colors in their order; their values are TEAM_COLORS in theme.js (not imported here to
// keep the UI out of this file), their names in locales/.
export const COLOR_KEYS = ['green', 'blue', 'orange', 'pink', 'purple', 'red', 'cyan', 'white']
export const COLOR_COUNT = COLOR_KEYS.length

const isColor = (c) => Number.isInteger(c) && c >= 0 && c < COLOR_COUNT

export function loadCfg() {
  const saved = read('cfg', {})
  const cfg = { ...DEFAULT_CFG }
  if (!saved || typeof saved !== 'object') return cfg
  for (const key of Object.keys(CHOICES)) {
    if (CHOICES[key].includes(saved[key])) cfg[key] = saved[key]
  }
  const names = saved.names
  if (Array.isArray(names) && names.length === 2 && names.every((n) => typeof n === 'string')) cfg.names = names
  const colors = saved.colors
  if (Array.isArray(colors) && colors.length === 2 && colors.every(isColor)) cfg.colors = colors
  return cfg
}

export function saveCfg(cfg) {
  write('cfg', cfg)
}
