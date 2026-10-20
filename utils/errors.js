// Error log: when something in a page throws, a short line (time, place, message) goes to the
// 'errors' file instead of the error vanishing on the watch, and the app keeps running. The
// diagnosis page (5 taps on the logo on Info) shows the log. Only the newest MAX_ERRORS stay.
import { read, write, remove } from './files'
import { tr } from './i18n'
import { toast } from './toast'

const KEY = 'errors'
export const MAX_ERRORS = 10
const MAX_MSG = 120

// One toast per app start is enough to say that something was logged.
let toasted = false

// For the tests: a new app start may toast again.
export function resetErrorToast() {
  toasted = false
}

export function loadErrors() {
  const list = read(KEY, [])
  return Array.isArray(list) ? list.filter((e) => e && typeof e.where === 'string') : []
}

export function clearErrors() {
  remove(KEY)
}

export function logError(where, e) {
  try {
    const msg = String((e && e.message) || e).slice(0, MAX_MSG)
    write(KEY, [{ t: Date.now(), where, msg }, ...loadErrors()].slice(0, MAX_ERRORS))
  } catch (e2) {}
  if (toasted) return
  toasted = true
  toast(tr('errorLogged'))
}

// fn, but an error inside it is logged instead of thrown.
export function safe(where, fn) {
  return function (...args) {
    try {
      return fn.apply(this, args)
    } catch (e) {
      logError(where, e)
    }
  }
}

// A page definition whose lifecycle (onInit, build, onDestroy) logs errors instead of throwing.
// Taps, buttons and the clock are guarded in utils/theme.js, so every way into a page is covered.
export function safePage(name, def) {
  for (const k of ['onInit', 'build', 'onDestroy']) {
    if (typeof def[k] === 'function') def[k] = safe(`${name}.${k}`, def[k])
  }
  return def
}
