// A pull request that changes what the plugin ships must raise the version in
// .claude-plugin/plugin.json and name it in CHANGELOG.md: `claude plugin
// update` compares versions, so a merge without a new one reaches nobody.
//
// usage: node .github/scripts/check-version.mjs <base ref>

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const MANIFEST = '.claude-plugin/plugin.json'
// What a person's installation runs; tests, docs and CI are not shipped code.
const SHIPPED = ['hooks/', 'sounds/', 'types/', '.claude-plugin/']

const base = process.argv[2]
if (!base) {
  console.error('usage: check-version.mjs <base ref>')
  process.exit(2)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

function parse(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!m) throw new Error(`"${version}" is not a version like 1.2.3`)
  return m.slice(1).map(Number)
}

function isHigher(next, prev) {
  const a = parse(next)
  const b = parse(prev)
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

// Three dots: what this branch changed since it left the base.
const changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean)
const shipped = changed.filter(file => SHIPPED.some(prefix => file.startsWith(prefix)))
if (shipped.length === 0) {
  console.log('No shipped file changed: no new version needed.')
  process.exit(0)
}

const mergeBase = git('merge-base', base, 'HEAD').trim()
const before = JSON.parse(git('show', `${mergeBase}:${MANIFEST}`)).version
const after = JSON.parse(readFileSync(MANIFEST, 'utf8')).version

const problems = []
if (!isHigher(after, before)) {
  problems.push(`${MANIFEST}: the version is ${after}, on ${base} it is ${before}. Raise it.`)
} else {
  const heading = new RegExp(`^## ${after.replaceAll('.', '\\.')}(\\s|$)`, 'm')
  if (!heading.test(readFileSync('CHANGELOG.md', 'utf8'))) {
    problems.push(`CHANGELOG.md: no "## ${after}" section for the new version.`)
  }
}

if (problems.length > 0) {
  console.error(`This pull request changes shipped files:\n${shipped.map(f => `  ${f}`).join('\n')}\n`)
  for (const p of problems) console.error(p)
  process.exit(1)
}
console.log(`Version ${before} -> ${after}, named in CHANGELOG.md.`)
