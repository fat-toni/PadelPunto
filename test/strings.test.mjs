// Run with: node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { STRINGS } from '../locales/index.js'

test('every language has the same texts', () => {
  const keys = Object.keys(STRINGS.de).sort()
  for (const [lang, texts] of Object.entries(STRINGS)) {
    assert.deepEqual(Object.keys(texts).sort(), keys, `keys of ${lang}`)
    for (const k of keys) assert.ok(texts[k].trim(), `${lang}.${k} is empty`)
  }
})

test('placeholders match in every language', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort()
  for (const [lang, texts] of Object.entries(STRINGS)) {
    for (const [k, s] of Object.entries(texts)) assert.deepEqual(vars(s), vars(STRINGS.de[k]), `${lang}.${k}`)
  }
})

// The measured font table (test/mock/font.mjs) must cover every character the app shows,
// and the whole sample sentence must match the sum of its letters within 5 %.
test('font table from the watch: complete and consistent (once measured)', async () => {
  const { WIDTHS, SAMPLE } = await import('./mock/font.mjs')
  if (!Object.keys(WIDTHS).length) return // not measured yet: the tests use the estimate
  const { usedChars } = await import('../locales/index.js')
  const missing = usedChars().filter((c) => WIDTHS[c] === undefined)
  assert.deepEqual(missing, [])
  if (SAMPLE) {
    const sum = [...SAMPLE.text].reduce((s, c) => s + WIDTHS[c], 0)
    assert.ok(Math.abs(sum - SAMPLE.width) <= SAMPLE.width * 0.05, `sum ${sum} vs measured ${SAMPLE.width}`)
  }
})

test('the simulated watch measures with the font table where it has a width', async () => {
  const { WIDTHS } = await import('./mock/font.mjs')
  const { getTextLayout } = await import('./mock/zos.mjs')
  const saved = { ...WIDTHS }
  try {
    WIDTHS.a = 50
    WIDTHS.b = 70
    assert.equal(getTextLayout('ab', { text_size: 20 }).width, 24)
    delete WIDTHS.b
    assert.equal(getTextLayout('ab', { text_size: 20 }).width, 10 + 12, 'unknown letters: estimate')
  } finally {
    for (const k of Object.keys(WIDTHS)) delete WIDTHS[k]
    Object.assign(WIDTHS, saved)
  }
})

// A page file must not export anything: the watch then fails to load the page and shows only a
// black screen (happened with page/diag.js in 1.4.0). Shared code belongs in utils/ or locales/.
test('page files export nothing', async () => {
  const { readdirSync, readFileSync } = await import('node:fs')
  const dir = new URL('../page/', import.meta.url)
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8')
    assert.ok(!/^\s*export\b/m.test(src), `page/${f} has an export`)
  }
})

// Images and sounds are named by their path inside assets/<target> (e.g. 'img/logo.png'); a wrong
// path shows nothing on the watch instead of failing, so check every one the pages use.
test('every image and sound the pages use is in assets', async () => {
  const { readdirSync, readFileSync, existsSync } = await import('node:fs')
  const dir = new URL('../page/', import.meta.url)
  const assets = new URL('../assets/default.s/', import.meta.url)
  const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'))
  const used = [app.app.icon]
  for (const f of readdirSync(dir)) {
    const src = readFileSync(new URL(f, dir), 'utf8')
    for (const m of src.matchAll(/'([\w/]+\.(?:png|mp3))'/g)) used.push(m[1])
  }
  assert.ok(used.length >= 4, `found ${used}`)
  for (const path of used) assert.ok(existsSync(new URL(path, assets)), `assets/default.s/${path} is missing`)
})

test('the voice has every word', async () => {
  const { existsSync } = await import('node:fs')
  const { WORDS, VOICE_LANG, voicePath } = await import('../utils/voice.js')
  const assets = new URL('../assets/default.s/', import.meta.url)
  for (const word of WORDS)
    assert.ok(existsSync(new URL(voicePath(VOICE_LANG, word), assets)), voicePath(VOICE_LANG, word))
})
