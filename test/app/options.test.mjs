// The options page.
// The whole app on a simulated watch (test/mock/watch.mjs), used the way a player would.
// Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STRINGS } from '../../locales/index.js'
import {
  T,
  w,
  inst,
  team,
  gamesText,
  setTexts,
  hint,
  won,
  saved,
  log,
  points,
  games,
  startMatch,
  option,
  openOptions,
  playWonMatch,
  freshWatch,
  openTraining,
} from './helpers.mjs'

// ---- options ----

test('every option is saved and survives an app restart', () => {
  w.launch()
  openOptions()
  option(T.optMode) // golden
  option(T.optSets) // 1 set
  option(T.optDecider) // no tiebreak
  option(T.optColor0, 2) // green → pink (blue is skipped)
  option(T.optColor1, 2) // blue → purple (pink is skipped)
  option(T.optSwitch) // off
  option(T.optHr) // off
  option(T.optScreen) // auto
  w.press(T.done)
  w.key('back')
  assert.equal(w.url, 'watchface')
  w.launch()
  openOptions()
  for (const t of [T.golden, T.oneSet, T.deciderNoTb, T.pink, T.purple, T.switchOff, T.hrOff, T.screenAuto]) {
    assert.ok(w.has(t), t)
  }
})

test('team colors reach the match and the history', () => {
  w.launch()
  openOptions()
  option(T.optColor0) // orange (blue belongs to team 2)
  w.press(T.done)
  startMatch()
  assert.equal(team(0).name.w.props.color, 0xffa24c)
  games(0, 12)
  w.press(T.end).press(T.history)
  assert.equal(w.find('Sieg Wir').props.color, 0xffa24c)
})

test('a tapped option shows at once and is saved a moment later; leaving saves at once', () => {
  w.launch()
  openOptions()
  const writes = () => w.zos.cost.writes
  const before = writes()
  w.press(T.optMode) // a tap takes 330 ms on the simulated watch
  assert.ok(w.has(T.golden))
  w.press(T.optMode)
  assert.ok(w.has(T.star))
  assert.equal(writes(), before, 'not yet written')
  w.tick(600)
  assert.equal(writes(), before + 1, 'one write for both taps')
  assert.equal(saved('cfg').mode, 'star')
  w.press(T.optMode)
  w.press(T.done)
  assert.equal(saved('cfg').mode, 'adv', '"Fertig" saves the last tap at once')
  openOptions()
  w.press(T.optMode)
  w.swipe('right')
  assert.equal(saved('cfg').mode, 'golden', 'so does a swipe')
})

test('a color card skips the color of the other team', () => {
  w.launch()
  openOptions()
  for (let i = 0; i < 20; i++) {
    option(i % 3 ? T.optColor0 : T.optColor1)
    const [a, b] = saved('cfg').colors
    assert.notEqual(a, b)
  }
})

test('after "Verlassen": new names and colors count in the open match, new rules only in the next', () => {
  w.launch()
  openOptions()
  assert.equal(w.has(T.rulesLater), false, 'no hint without an open match')
  w.press(T.done)
  startMatch()
  points(0, 3)
  w.press(T.end).press(T.leave)
  openOptions()
  assert.ok(w.has(T.rulesLater))
  option(T.optMode) // golden point, for the next match
  option(T.optColor0) // orange
  w.press(T.optName0).type('Toni')
  w.press(T.done).press(T.resume)
  assert.equal(team(0).name.w.props.text, 'Toni')
  assert.equal(team(0).name.w.props.color, 0xffa24c)
  points(1, 3)
  assert.equal(hint(), T.deuce, 'still advantage scoring')
  w.press(T.end).press(T.endConfirm)
  assert.deepEqual(
    [log()[0].names, log()[0].colors],
    [
      ['Toni', ''],
      [2, 1],
    ],
  )
  startMatch()
  points(0, 3)
  points(1, 3)
  assert.notEqual(hint(), T.deuce, 'new match uses golden point')
  assert.equal(inst().state.cfg.mode, 'golden')
})

test('short sets: option "Spiele pro Satz" 4, tiebreak at 4:4, the match is won 4:0 5:4', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.games6))
  option(T.optGames)
  assert.ok(w.has(T.games4))
  assert.equal(saved('cfg').games, 4)
  w.press(T.done)
  startMatch()
  games(0, 3)
  assert.equal(gamesText(0), '3')
  games(0, 1) // 4:0 → set
  assert.deepEqual(setTexts(0), ['4'])
  assert.equal(gamesText(0), '0')
  for (let i = 0; i < 4; i++) {
    games(0, 1)
    games(1, 1)
  }
  w.tick(6000)
  assert.equal(hint(), T.tiebreak, '4:4 → tiebreak')
  points(0, 7)
  assert.ok(won(0))
  assert.equal(saved('match').state.cfg.games, 4, 'the match keeps its set length')
  w.press(T.end).press(T.history)
  assert.ok(w.has('4:0  5:4'))
})

test('short sets: changing "Spiele pro Satz" after "Verlassen" counts only from the next match', () => {
  w.launch()
  startMatch()
  games(0, 2)
  w.press(T.end).press(T.leave)
  openOptions()
  option(T.optGames)
  w.press(T.done).press(T.resume)
  games(0, 2) // 4:0 is no set in a normal match
  assert.deepEqual(setTexts(0), [])
  assert.equal(gamesText(0), '4')
})

test('a match saved before "Spiele pro Satz" existed still plays 6-game sets', () => {
  w.files.set(
    'match.json',
    JSON.stringify({
      state: {
        cfg: { mode: 'adv', bestOf: 3, decider: 'set', firstServer: 0, names: ['', ''], colors: [0, 1] },
        startedAt: 1,
        endedAt: null,
      },
      moves: Array(16).fill(0),
    }),
  )
  w.launch()
  w.press(T.resume)
  assert.equal(gamesText(0), '4')
  assert.deepEqual(setTexts(0), [])
})

test('team names via the keyboard: trimmed, at most 8 characters, empty = default', () => {
  w.launch()
  openOptions()
  assert.ok(w.has('WIR (Standard)'))
  w.press(T.optName0).type('  Maria  ')
  assert.ok(w.has('Maria'))
  w.press(T.optName1).type('Superlangername')
  assert.ok(w.has('Superlan'))
  w.press(T.optName1).type(null) // cancel keeps the name
  assert.ok(w.has('Superlan'))
  w.press(T.optName0).type('')
  assert.ok(w.has('WIR (Standard)'))
  assert.deepEqual(saved('cfg').names, ['', 'Superlan'])
  w.press(T.done)
  w.press(T.newGame)
  assert.ok(w.has('Superlan'))
})

test('team names: a long press restores the default, a short tap still opens the keyboard', () => {
  w.launch()
  openOptions()
  assert.ok(w.has(T.holdName))
  w.press(T.optName0).type('Maria')
  w.press(T.optName1).type('Pepe')
  w.hold('Maria')
  assert.ok(w.has('WIR (Standard)'))
  assert.equal(w.zos.keyboard, null)
  assert.deepEqual(w.zos.toasts, [T.nameReset])
  assert.deepEqual(saved('cfg').names, ['', 'Pepe'])
  w.hold('WIR (Standard)') // already the default: nothing happens
  assert.deepEqual(w.zos.toasts, [T.nameReset])
  w.scrollOn('Pepe') // scrolling the page over the card keeps the name
  w.slide('Pepe')
  assert.ok(w.has('Pepe'))
  w.press('Pepe').type('Pepa')
  assert.deepEqual(saved('cfg').names, ['', 'Pepa'])
})

test('a watch without keyboard shows a hint instead', () => {
  w.zos.noKeyboard = true
  w.launch()
  openOptions()
  w.press(T.optName0)
  assert.deepEqual(w.zos.toasts, [T.noKeyboard])
})

test('language: the page redraws at once, start follows, and the choice stays', () => {
  w.launch()
  openOptions()
  option(T.optLang) // auto → Deutsch
  assert.ok(w.has('Deutsch'))
  option(T.optLang) // → English
  assert.equal(w.url, 'page/options')
  assert.ok(w.has(STRINGS.en.options))
  w.press(STRINGS.en.done)
  assert.ok(w.has(STRINGS.en.newGame))
  w.key('back').launch()
  assert.ok(w.has(STRINGS.en.newGame))
})

test('"Wie die Uhr": German, English, Spanish, Italian and French watches get theirs, other languages English', () => {
  for (const [code, lang] of [
    [7, 'de'],
    [2, 'en'],
    [3, 'es'],
    [10, 'it'],
    [6, 'fr'],
    [4, 'en'],
    [99, 'en'],
  ]) {
    freshWatch()
    w.zos.language = code
    w.launch()
    assert.ok(w.has(STRINGS[lang].newGame), `language code ${code}`)
  }
})

test('options are left with "Fertig", a swipe right or the back key, always to a fresh start', () => {
  w.launch()
  for (const leave of [() => w.press(T.done), () => w.swipe('right'), () => w.key('back')]) {
    openOptions()
    leave()
    assert.equal(w.url, 'page/start')
  }
  assert.equal(w.log.filter((u) => u === 'page/start').length, 4)
})

test('renaming a team later does not change matches in the history', () => {
  w.files.set('cfg.json', JSON.stringify({ names: ['ANNA', ''] }))
  w.launch()
  playWonMatch(0)
  openOptions()
  w.press(T.optName0).type('BEA')
  w.press(T.done).press(T.history)
  assert.ok(w.has('Sieg ANNA'))
})

test('an open training gets no "rules count from the next match" hint, it has no such rules', () => {
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  points(0, 3)
  w.press(T.end).press(T.leave)
  openOptions()
  assert.equal(w.has(T.rulesLater), false)
})
