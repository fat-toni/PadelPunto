// The app tests again on an Active 2 (Square): the Bip 6 screen, but its own model name and ID,
// e.g. on the diagnosis page. Run with: npm test
import { readdirSync } from 'node:fs'

globalThis.WATCH = 'active2Square'
for (const f of readdirSync(new URL('./app/', import.meta.url))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()) {
  await import(`./app/${f}`)
}
