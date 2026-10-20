# Development

Get the code and the tools first, as in [INSTALL.md](INSTALL.md) steps 1 and 2.

```bash
npm install
npm test          # all tests (see below)
npm run format    # format the code with Prettier
npm run check     # check formatting + run tests
zeus dev          # run in the simulator
zeus build        # build a .zab into dist/
```

The tests run without a watch or simulator:

- **Rules:** 28,800 random matches compared against a separate reference model.
- **Whole app** on a simulated watch (`test/mock/watch.mjs`), plus 18,000 random taps and swipes (`test/monkey.test.mjs`).
- **Performance limits:** wake-ups per minute, redraws and file writes per point, widgets per page and leaks (`test/perf.test.mjs`).
- **Storage** and **texts:** every language has the same keys.

Tools:

```bash
python3 tools/logo.py assets/default.s    # redraw logo, app icon and the spinning racket
~/.cache/padelpunto/tts/bin/python tools/voice.py <voices-dir> assets/default.s   # regenerate the score-call words (setup at the top of the file; licenses in CREDITS.md)
```

`python3 tools/readme_art.py` redraws the banner and the watch pictures for the README from `docs/images/screenshots/` (simulator screenshots, 390×450).
The animated racket spin (`serve-spin.webp`) is recorded on the simulated watch by `tools/serve_spin.mjs` and drawn in Roboto, which the script downloads once into `~/.cache/padelpunto`.

← [Back to the README](../README.md)
