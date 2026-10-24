// The app tests again on a Bip Max (432×514): the 390 px layout scaled up by px(), with more
// room below. Catches a change that only fits the Bip 6 screen. Run with: npm test
import { readdirSync } from 'node:fs'

globalThis.WATCH = 'bipMax'
for (const f of readdirSync(new URL('./app/', import.meta.url))
  .filter((f) => f.endsWith('.test.mjs'))
  .sort()) {
  await import(`./app/${f}`)
}
