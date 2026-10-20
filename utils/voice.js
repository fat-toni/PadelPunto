// The score announcement: one MP3 per word in assets/<target>/voice/<lang>/<word>.mp3
// (made by tools/voice.py), played one after the other. A new announcement cuts off the old one.
// While a voice is on, the watch volume is set to the chosen level and put back by release().
import { create, id } from '@zos/media'

// The team colors (keys of TEAM_COLORS in utils/theme.js) as words, for "Grün – gewonnen".
export const COLOR_WORDS = ['green', 'blue', 'orange', 'pink', 'purple', 'red', 'cyan', 'white']

// Every word the voice knows (see spokenWords() in utils/score.js; n0 … n20 for tiebreaks;
// c_<color> and 'won' when a game is won).
export const WORDS = [
  'p0',
  'p15',
  'p30',
  'p40',
  'all',
  'deuce',
  'advIn',
  'advOut',
  'golden',
  'star',
  ...Array.from({ length: 21 }, (_, i) => `n${i}`),
  'won',
  ...COLOR_WORDS.map((c) => `c_${c}`),
]
// The score call is always in English, whatever the app language (tools/voice.py).
export const VOICE_LANG = 'en'
// Option "Lautstärke" → watch volume (0–100).
export const LEVELS = { low: 15, high: 100 }

export function voicePath(lang, word) {
  return `voice/${lang}/${word}.mp3`
}

// Returns null if the watch has no player. level: a key of LEVELS.
export function createVoice(lang, level) {
  let player
  try {
    player = create(id.PLAYER)
  } catch (e) {
    return null
  }
  let queue = []
  let oldVolume = null
  // Only a PREPARE we are waiting for starts a word; none after release() (page closed).
  let waiting = false
  let closed = false
  const next = () => {
    const word = queue.shift()
    waiting = false
    if (!word || closed) return
    waiting = true
    try {
      player.setSource(player.source.FILE, { file: voicePath(lang, word) })
      player.prepare()
    } catch (e) {
      next()
    }
  }
  player.addEventListener(player.event.PREPARE, (ok) => {
    if (!waiting) return
    waiting = false
    if (!ok) return next()
    try {
      player.start()
    } catch (e) {
      next()
    }
  })
  player.addEventListener(player.event.COMPLETE, () => {
    try {
      player.stop()
    } catch (e) {}
    next()
  })
  try {
    oldVolume = player.getVolume()
    player.setVolume(LEVELS[level] || LEVELS.high)
  } catch (e) {}

  return {
    say(words) {
      try {
        player.stop()
      } catch (e) {}
      queue = words.slice()
      next()
    },
    release() {
      queue = []
      waiting = false
      closed = true
      try {
        player.stop()
        if (typeof oldVolume === 'number') player.setVolume(oldVolume)
      } catch (e) {}
    },
  }
}
