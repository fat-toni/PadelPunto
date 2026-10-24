// All UI texts, one file per language. To add a language: copy de.js, translate it, import
// it here and add its code to CHOICES.lang (utils/config.js) and SYSTEM (utils/i18n.js).
// No watch APIs here, so Node tests can import it.
import de from './de'
import en from './en'
import es from './es'
import fr from './fr'
import it from './it'

export const STRINGS = { de, en, es, fr, it }

// Every character in the app's texts (also in capitals, as headings use them), plus digits
// and the signs the app adds itself; not the braces of placeholders like {name}.
export function usedChars() {
  const all = Object.values(STRINGS)
    .flatMap((lang) => Object.values(lang))
    .join('')
  const chars = new Set([...(all + all.toUpperCase() + '0123456789:·–…')])
  for (const c of ' {}') chars.delete(c)
  return [' ', ...[...chars].sort()]
}
