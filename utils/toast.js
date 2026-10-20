// A short notice at the bottom of the screen (showToast from @zos/ui, API 2.0). One place for it,
// kept apart from theme.js so errors.js can use it without a circular import.
import { showToast } from '@zos/ui'

export function toast(text) {
  try {
    showToast({ text })
  } catch (e) {}
}
