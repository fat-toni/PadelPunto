// The app tests again on a Bip Max (432×514): the 390 px layout scaled up by px(), with more
// room below. Catches a change that only fits the Bip 6 screen. Run with: npm test
globalThis.WATCH = 'bipMax'
await import('./app.test.mjs')
