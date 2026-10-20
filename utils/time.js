// The watch time and its hour format. Kept apart from theme.js, so i18n.js (dates in the
// history) can use it without a circular import (theme → errors → i18n → theme).
import { Time, TIME_HOUR_FORMAT_12 } from '@zos/sensor'

export const time = new Time()

// Whether the watch is set to the 12-hour clock.
export function is12h() {
  try {
    return time.getHourFormat() === TIME_HOUR_FORMAT_12
  } catch (e) {
    return false
  }
}

// "22:45", or "10:45" when the watch uses the 12-hour clock (no am/pm, the space is small).
export function hourText(h, m) {
  const hh = is12h() ? h % 12 || 12 : h
  return `${hh}:${String(m).padStart(2, '0')}`
}
