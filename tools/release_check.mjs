// Everything a machine can check before a release, in one run (the first part of the full test
// before every release). Prints one line per check and exits with 1 if any fails.
// Usage: npm run release-check            formatting, tests on every watch, versions, build stamp,
//                                          README pictures, private files, privacy policy, pages
//        npm run release-check -- --zab   the same, then builds the .zab for GitHub and checks it
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync, existsSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const zab = process.argv.includes('--zab')
const failed = []
const notes = []

const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const sh = (cmd, args, opts = {}) => spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts })
const git = (...args) => sh('git', args).stdout.trim()
function check(name, fn) {
  let problems
  try {
    problems = fn() || []
  } catch (e) {
    problems = [String(e.message || e)]
  }
  if (problems.length) failed.push(name)
  console.log(`${problems.length ? '✖' : '✔'} ${name}`)
  for (const p of problems) console.log(`    ${p}`)
}
// All files below dir (relative to ROOT), recursively.
function files(dir) {
  const full = join(ROOT, dir)
  if (!existsSync(full)) return []
  return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)],
  )
}

const app = JSON.parse(read('app.json'))
const version = app.app.version.name
const pages = app.targets.default.module.page.pages
console.log(`Padel Punto ${version} (code ${app.app.version.code})\n`)

// 1. Formatting and all tests: Bip 6, Bip Max and Active 2 (test/app.*.test.mjs). The --zab
// build runs the same check itself first.
if (!zab)
  check('formatting and tests on every watch (npm run check)', () => {
    const r = sh('npm', ['run', 'check'])
    if (r.status === 0) return []
    const out = r.stdout + r.stderr
    const lines = out.split('\n').filter((l) => /^✖|\[warn\]/.test(l.trim()))
    return [...new Set(lines.map((l) => l.trim()))].slice(0, 20).concat(lines.length ? [] : [out.slice(-800)])
  })

// 2. One version everywhere, raised since the last release, with a dated changelog entry.
check(`version ${version} in package.json, both changelogs and above the last release`, () => {
  const problems = []
  const pkg = JSON.parse(read('package.json'))
  if (pkg.version !== version) problems.push(`package.json says ${pkg.version}`)
  const head = read('CHANGELOG.md').match(/^## (\S+) · (.+)$/m)
  if (!head || head[1] !== version) problems.push(`CHANGELOG.md: newest entry is ${head && head[1]}`)
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(head[2])) problems.push(`CHANGELOG.md: "${head[2]}" instead of a date`)
  if (
    !read('CHANGELOG.md')
      .match(/^\*\*Versions:\*\*.*$/m)?.[0]
      .includes(`[${version}](#`)
  )
    problems.push('CHANGELOG.md: not in the version index at the top')
  if (existsSync(join(ROOT, 'CHANGELOG.de.md'))) {
    const de = read('CHANGELOG.de.md')
    const h = de.match(/^## (\S+) · (.+)$/m)
    if (!h || h[1] !== version) problems.push(`CHANGELOG.de.md: newest entry is ${h && h[1]}`)
    else if (!/^\d{2}\.\d{2}\.\d{4}$/.test(h[2])) problems.push(`CHANGELOG.de.md: "${h[2]}" instead of a date`)
    if (!de.match(/^\*\*Versionen:\*\*.*$/m)?.[0].includes(`[${version}](#`))
      problems.push('CHANGELOG.de.md: not in the version index at the top')
  }
  const tags = git('tag', '--sort=-v:refname').split('\n').filter(Boolean)
  if (tags.includes(`v${version}`)) notes.push(`v${version} is already released; raise the version for a new one`)
  const last = tags.find((t) => t !== `v${version}`)
  if (last) {
    const code = JSON.parse(git('show', `${last}:app.json`)).app.version.code
    if (app.app.version.code <= code)
      problems.push(`version code ${app.app.version.code} is not above ${last}'s ${code}`)
  }
  return problems
})

// 3. The build stamp on the diagnosis page ("24.10. 22:35") is newer than the last change to the
// app (page/diag.js itself aside, as it holds the stamp).
check('build stamp in page/diag.js newer than the last app change', () => {
  const m = read('page/diag.js').match(/const BUILD = '(\d\d)\.(\d\d)\. (\d\d):(\d\d)'/)
  if (!m) return ['BUILD not found in page/diag.js']
  const now = new Date()
  let stamp = new Date(now.getFullYear(), m[2] - 1, +m[1], +m[3], +m[4])
  if (stamp > now) stamp = new Date(now.getFullYear() - 1, m[2] - 1, +m[1], +m[3], +m[4])
  const appFiles = ['app.js', 'app.json', ...['page', 'utils', 'locales', 'assets'].flatMap(files)].filter(
    (f) => f !== join('page', 'diag.js'),
  )
  const newest = appFiles.map((f) => ({ f, t: statSync(join(ROOT, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0]
  if (Math.floor(newest.t / 60000) * 60000 <= stamp.getTime()) return []
  const when = new Date(newest.t).toLocaleString('de-DE')
  return [`BUILD is ${m[1]}.${m[2]}. ${m[3]}:${m[4]}, but ${newest.f} changed on ${when}`]
})

// 4. The README pictures show the current app: drawn again, nothing may change.
check('README pictures up to date (tools/readme_art.py)', () => {
  const dirty = () => git('status', '--porcelain', '--', 'docs/images')
  const before = dirty()
  if (before) return ['uncommitted changes in docs/images already:', ...before.split('\n')]
  const r = sh('python3', ['tools/readme_art.py'])
  if (r.status !== 0) return [`tools/readme_art.py failed: ${(r.stderr || '').trim().split('\n').pop()}`]
  const after = dirty()
  return after ? ['were outdated and are redrawn now; look at them and commit:', ...after.split('\n')] : []
})

// 5. The local-only files stay off GitHub.
check('private files stay local (.gitignore)', () => {
  const local = ['TODO.md', 'CHANGELOG.de.md', 'BESCHREIBUNG.md', 'store/LISTING.md', 'tools/store_art.py', '.claude/x']
  const problems = []
  for (const f of local) {
    if (sh('git', ['check-ignore', '-q', '--no-index', f]).status !== 0) problems.push(`${f} is not in .gitignore`)
    if (git('ls-files', '--', f)) problems.push(`${f} is in git`)
  }
  for (const d of ['store', '.claude']) if (git('ls-files', '--', d)) problems.push(`${d}/ is in git`)
  return problems
})

// 6. What the app saves and may use is in the privacy policy, and every saved file shows on the
// diagnosis page. A new file needs its words below.
const SAVED = { cfg: 'options', match: 'running match', log: 'history', court: 'court time', errors: 'error log' }
check('PRIVACY.md and the diagnosis page know every saved file and permission', () => {
  const privacy = read('PRIVACY.md')
  // The saved files are named in their own section, so "court timer" elsewhere does not count.
  const saved = privacy.match(/## What the app saves[\s\S]*?(?=\n## )/)?.[0] || ''
  const diag = read('page/diag.js').match(/const FILES = \[(.*)\]/)[1]
  const src = ['utils', 'page'].flatMap(files).map(read).join('\n')
  const keys = new Set([...src.matchAll(/\bwrite\('(\w+)'|\bKEY = '(\w+)'/g)].map((m) => m[1] || m[2]))
  const problems = []
  for (const k of keys) {
    if (!SAVED[k]) problems.push(`new file ${k}.json: describe it in PRIVACY.md, then add it to SAVED here`)
    else if (!saved.includes(SAVED[k])) problems.push(`PRIVACY.md does not mention the ${SAVED[k]} (${k}.json)`)
    if (!diag.includes(`'${k}'`)) problems.push(`${k}.json is missing from FILES in page/diag.js`)
  }
  for (const p of app.permissions) if (!privacy.includes(`\`${p}\``)) problems.push(`PRIVACY.md: permission ${p}`)
  return problems
})

// 7. Every page in app.json exists and is opened by a test.
check('every page exists and is tested', () => {
  const tests = ['test', 'test/app']
    .flatMap((d) => files(d).filter((f) => f.endsWith('.mjs')))
    .map(read)
    .join('\n')
  return pages.flatMap((p) => [
    ...(existsSync(join(ROOT, `${p}.js`)) ? [] : [`${p}.js is missing`]),
    ...(tests.includes(`'${p}'`) ? [] : [`no test opens ${p}`]),
  ])
})

// 8. --zab: the package for the GitHub release, without intermediate products, with this version
// for every screen size, copied to dist/PadelPunto-<version>.zab.
if (zab)
  check(`dist/PadelPunto-${version}.zab (npm run build -- --github)`, () => {
    const r = sh('bash', ['tools/build.sh', '--github'])
    if (r.status !== 0) return ['the build failed:', ...(r.stdout + r.stderr).trim().split('\n').slice(-12)]
    const built = files('dist')
      .filter((f) => f.includes(`-${version}-`) && f.endsWith('.zab'))
      .sort()
      .pop()
    if (!built) return [`no ${version} .zab in dist/`]
    const list = sh('unzip', ['-Z1', join(ROOT, built)])
      .stdout.split('\n')
      .filter(Boolean)
    const manifest = JSON.parse(sh('unzip', ['-p', join(ROOT, built), 'manifest.json']).stdout)
    const problems = []
    if (list.includes('.ip-package')) problems.push('still holds the intermediate products (.ip-package)')
    for (const z of manifest.zpks) {
      if (z.version.name !== version) problems.push(`${z.name} is version ${z.version.name}`)
    }
    const screens = manifest.zpks.map((z) => z.platforms.map((p) => p.screenResolution).join()).sort()
    if (screens.join() !== '390x450,432x514') problems.push(`screen sizes: ${screens.join(', ')}`)
    if (!problems.length) copyFileSync(join(ROOT, built), join(ROOT, 'dist', `PadelPunto-${version}.zab`))
    return problems
  })

for (const n of notes) console.log(`ℹ ${n}`)
console.log(failed.length ? `\n✖ ${failed.length} check(s) failed` : '\n✔ all checks passed')
process.exit(failed.length ? 1 : 0)
