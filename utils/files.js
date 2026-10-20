// Each key is a JSON file in the app's /data folder, written synchronously, so nothing is
// lost when the app closes.
import { readFileSync, writeFileSync, rmSync, statSync } from '@zos/fs'

function file(key) {
  return `${key}.json`
}

export function read(key, fallback) {
  try {
    const raw = readFileSync({ path: file(key), options: { encoding: 'utf8' } })
    if (raw) return JSON.parse(raw)
  } catch (e) {}
  return fallback
}

// Returns false instead of throwing when the file can't be written (e.g. storage full),
// so a point is never lost to a crash; the caller decides whether to tell the user.
export function write(key, value) {
  try {
    writeFileSync({ path: file(key), data: JSON.stringify(value), options: { encoding: 'utf8' } })
    return true
  } catch (e) {
    return false
  }
}

export function remove(key) {
  try {
    rmSync({ path: file(key) })
  } catch (e) {}
}

// Size of a key's file in bytes, 0 if there is none (for the diagnosis page).
export function size(key) {
  try {
    const st = statSync({ path: file(key) })
    return (st && st.size) || 0
  } catch (e) {
    return 0
  }
}
