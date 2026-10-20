// Court time: the time the court is booked until, and a reminder some minutes before. Both are
// watch alarms (@zos/alarm), so they go off even when the app is closed; they open
// page/courtAlert, which vibrates and says which one it is. Saved in court.json as
// { end: ms | null, warn: minutes, ids: [alarm ids] }.
import { set, cancel } from '@zos/alarm'
import { read, write } from './files'

export const WARN_CHOICES = [5, 10, 15]
export const ALERT_URL = 'page/courtAlert'
const MIN = 60000

// The saved court time; end is null when none is set or it is over.
export function loadCourt(now = Date.now()) {
  const c = read('court', null)
  const warn = c && WARN_CHOICES.includes(c.warn) ? c.warn : WARN_CHOICES[0]
  const ids = c && Array.isArray(c.ids) ? c.ids.filter((id) => typeof id === 'number') : []
  const end = c && typeof c.end === 'number' && c.end > now ? c.end : null
  return { end, warn, ids }
}

// A first suggestion: the next full or half hour plus one hour (a usual booking).
export function defaultEnd(now = Date.now()) {
  const d = new Date(now)
  d.setSeconds(0, 0)
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60)
  return d.getTime() + 60 * MIN
}

// The next time the clock shows h:m (today, or tomorrow if that has passed).
export function nextAt(h, m, now = Date.now()) {
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  if (d.getTime() <= now) d.setDate(d.getDate() + 1)
  return d.getTime()
}

function alarm(ms) {
  try {
    return set({ url: ALERT_URL, time: Math.floor(ms / 1000), store: true }) || 0
  } catch (e) {
    return 0
  }
}

function cancelAll(ids) {
  for (const id of ids) {
    try {
      cancel(id)
    } catch (e) {}
  }
}

// Sets the court time (replacing an older one). The reminder is left out if its time has already
// passed. Returns false if the watch did not take the alarm for the end.
export function saveCourt(end, warn, now = Date.now()) {
  cancelAll(loadCourt(now).ids)
  const ids = []
  const warnAt = end - warn * MIN
  if (warnAt > now) ids.push(alarm(warnAt))
  const endId = alarm(end)
  ids.push(endId)
  write('court', { end, warn, ids: ids.filter(Boolean) })
  return endId !== 0
}

// Removes the court time and its alarms; the chosen reminder stays for next time.
export function clearCourt() {
  const c = loadCourt()
  cancelAll(c.ids)
  write('court', { end: null, warn: c.warn, ids: [] })
}
