// Holds a pull request to the release rules. Installations follow main and
// `claude plugin update` compares versions, so every merge that changes what
// the plugin ships is a release: it raises the version in
// plugin/.claude-plugin/plugin.json by the step its CHANGELOG.md section calls for.
// The rules themselves are in changelog.mjs.
//
// usage: node .github/scripts/check-version.mjs <base ref>

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { check } from './changelog.mjs'

const MANIFEST = 'plugin/.claude-plugin/plugin.json'
// Where the manifest was before the plugin moved into its own folder.
const OLD_MANIFEST = '.claude-plugin/plugin.json'
const CHANGELOG = 'CHANGELOG.md'
// What a person's installation runs, and the marketplace that leads to it;
// tests, docs and CI are not shipped code.
const SHIPPED = ['plugin/', '.claude-plugin/']

const base = process.argv[2]
if (!base) {
  console.error('usage: check-version.mjs <base ref>')
  process.exit(2)
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

// Three dots: what this branch changed since it left the base. Without rename
// detection a moved file counts where it was and where it is now.
const changed = git('diff', '--name-only', '--no-renames', `${base}...HEAD`).split('\n').filter(Boolean)
const shipped = changed.filter(file => SHIPPED.some(prefix => file.startsWith(prefix)))
const mergeBase = git('merge-base', base, 'HEAD').trim()

// A branch that left the base before the move finds the manifest in its old place.
const hasMoved = git('ls-tree', '--name-only', mergeBase, MANIFEST).trim() !== ''
const baseVersion = JSON.parse(git('show', `${mergeBase}:${hasMoved ? MANIFEST : OLD_MANIFEST}`)).version
const version = JSON.parse(readFileSync(MANIFEST, 'utf8')).version
const problems = check({
  baseVersion,
  baseChangelog: git('show', `${mergeBase}:${CHANGELOG}`),
  version,
  changelog: readFileSync(CHANGELOG, 'utf8'),
  shipped,
})

if (problems.length > 0) {
  if (shipped.length > 0) {
    console.error(`This pull request changes shipped files:\n${shipped.map(f => `  ${f}`).join('\n')}\n`)
  }
  for (const p of problems) console.error(p)
  process.exit(1)
}
console.log(
  version === baseVersion
    ? `No shipped file changed: the version stays ${version}.`
    : `Version ${baseVersion} -> ${version}, as its CHANGELOG.md section calls for.`
)
