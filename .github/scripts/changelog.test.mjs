// run: node --test ".github/scripts/*.test.mjs"

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { check, nextVersion, parseChangelog, releaseNotes } from './changelog.mjs'

const section = (version, date, body) => `## ${version} - ${date}\n\n${body}\n`
const changelog = (...sections) => `# Changelog\n\nFor the player.\n\n${sections.join('\n')}`

const FIRST = section('0.1.0', '2026-10-01', '### Added\n\n- A game in a pane.')
const SECOND = section('0.2.0', '2026-10-02', '### Added\n\n- Worm.\n\n### Fixed\n\n- A click\n  anywhere works.')
const BASE = changelog(SECOND, FIRST)

const problemsOf = text => parseChangelog(text).problems

// A pull request on top of BASE at 0.2.0.
const pr = (version, top, shipped = ['hooks/host.ts']) =>
  check({
    baseVersion: '0.2.0',
    baseChangelog: BASE,
    version,
    changelog: top ? changelog(top, SECOND, FIRST) : BASE,
    shipped,
  })

test('a changelog in form has no problems', () => {
  const { sections, problems } = parseChangelog(BASE)
  assert.deepEqual(problems, [])
  assert.deepEqual(sections.map(s => s.version), ['0.2.0', '0.1.0'])
  assert.deepEqual(sections[0].groups, { Added: 1, Fixed: 1 })
})

test('windows line endings read the same', () => {
  assert.deepEqual(problemsOf(BASE.replaceAll('\n', '\r\n')), [])
})

test('a heading needs version and date', () => {
  assert.match(problemsOf(changelog('## 0.2.0 (unreleased)\n\n### Added\n\n- Worm.\n'))[0], /must read like/)
  assert.match(problemsOf(changelog(section('0.2.0', '2026-02-30', '### Added\n\n- Worm.')))[0], /not a date/)
})

test('only Added, Changed and Fixed are groups, once each and in that order', () => {
  assert.match(problemsOf(changelog(section('0.2.0', '2026-10-02', '### Removed\n\n- Worm.')))[0], /not a group/)
  assert.match(
    problemsOf(changelog(section('0.2.0', '2026-10-02', '### Fixed\n\n- A.\n\n### Fixed\n\n- B.')))[0],
    /twice/
  )
  assert.match(
    problemsOf(changelog(section('0.2.0', '2026-10-02', '### Fixed\n\n- A.\n\n### Added\n\n- B.')))[0],
    /"Added" comes before "Fixed"/
  )
})

test('a section needs a group, a group an entry, an entry a group', () => {
  assert.match(problemsOf(changelog('## 0.2.0 - 2026-10-02\n'))[0], /has no group/)
  assert.match(problemsOf(changelog(section('0.2.0', '2026-10-02', '### Added')))[0], /"Added" has no entry/)
  assert.match(problemsOf(changelog(section('0.2.0', '2026-10-02', '- Worm.')))[0], /under no group/)
  assert.match(problemsOf(changelog(section('0.2.0', '2026-10-02', '### Added\n\nWorm.')))[0], /neither a group/)
})

test('the newest version comes first, in number and date', () => {
  assert.match(problemsOf(changelog(FIRST, SECOND))[0], /newest version comes first/)
  const early = section('0.3.0', '2026-09-01', '### Added\n\n- Mines.')
  assert.match(problemsOf(changelog(early, SECOND, FIRST))[0], /dated before/)
})

test('the step follows from the section', () => {
  const groups = (...names) => ({ groups: Object.fromEntries(names.map(n => [n, 1])), breaking: false })
  assert.equal(nextVersion('0.2.3', groups('Fixed')), '0.2.4')
  assert.equal(nextVersion('0.2.3', groups('Changed')), '0.3.0')
  assert.equal(nextVersion('0.2.3', groups('Added', 'Fixed')), '0.3.0')
  assert.equal(nextVersion('0.2.3', { ...groups('Changed'), breaking: true }), '0.3.0')
  assert.equal(nextVersion('1.2.3', { ...groups('Changed'), breaking: true }), '2.0.0')
  assert.equal(nextVersion('1.2.3', groups('Added')), '1.3.0')
})

test('a pull request that ships nothing needs no version', () => {
  assert.deepEqual(pr('0.2.0', null, []), [])
})

test('shipped files need a higher version', () => {
  assert.match(pr('0.2.0', null)[0], /Shipped files changed, so raise it/)
})

test('a fix is a patch, anything else a minor', () => {
  const fix = '### Fixed\n\n- The ball no longer leaves the field.'
  const game = '### Added\n\n- Mines.'
  assert.deepEqual(pr('0.2.1', section('0.2.1', '2026-10-05', fix)), [])
  assert.deepEqual(pr('0.3.0', section('0.3.0', '2026-10-05', game)), [])
  assert.match(pr('0.3.0', section('0.3.0', '2026-10-05', fix))[0], /after 0\.2\.0 comes 0\.2\.1.*Fixed only/)
  assert.match(pr('0.2.1', section('0.2.1', '2026-10-05', game))[0], /comes 0\.3\.0.*under Added/)
  assert.match(pr('0.4.0', section('0.4.0', '2026-10-05', game))[0], /comes 0\.3\.0/)
})

test('a breaking change is marked, and a major from 1.0 on', () => {
  const breaking = '### Changed\n\n- **Breaking:** high scores start over.'
  assert.deepEqual(pr('0.3.0', section('0.3.0', '2026-10-05', breaking)), [])
  const stable = changelog(section('1.0.0', '2026-10-03', '### Changed\n\n- First stable release.'))
  const after = (version, body) =>
    check({
      baseVersion: '1.0.0',
      baseChangelog: stable,
      version,
      changelog: stable.replace('## 1.0.0', `${section(version, '2026-10-05', body)}\n## 1.0.0`),
      shipped: ['types/index.d.ts'],
    })
  assert.deepEqual(after('2.0.0', breaking), [])
  assert.match(after('1.1.0', breaking)[0], /comes 2\.0\.0.*Breaking/)
})

test('a mistyped breaking marker is a problem, not an ordinary entry', () => {
  const problems = entry => problemsOf(changelog(section('0.3.0', '2026-10-05', `### Changed\n\n${entry}`)))
  for (const entry of [
    '- **Breaking**: scores start over.',
    '- **BREAKING:** scores start over.',
    '- Scores: **Breaking:** start over.',
    '- Breaking: scores start over.',
    '- BREAKING CHANGE: scores start over.',
    '- *Breaking:* scores start over.',
    '- __Breaking:__ scores start over.',
  ]) {
    assert.match(problems(entry)[0], /starts with "- \*\*Breaking:\*\* "/)
  }
  // The word alone, in a sentence, marks nothing.
  assert.deepEqual(problems('- Bricks: breaking the last brick starts the next level.'), [])
  assert.deepEqual(problems('- Breaking a brick scores more on higher levels.'), [])
})

test('1.0.0 is declared, whatever the section holds', () => {
  const stable = section('1.0.0', '2026-10-05', '### Changed\n\n- First stable release.')
  assert.deepEqual(pr('1.0.0', stable, ['.claude-plugin/plugin.json']), [])
  assert.match(pr('2.0.0', section('2.0.0', '2026-10-05', '### Added\n\n- Mines.'))[0], /comes 0\.3\.0/)
})

test('the top section is the version in plugin.json', () => {
  assert.match(pr('0.2.1', null)[0], /top section is 0\.2\.0, plugin\.json says 0\.2\.1/)
})

test('the version never goes down', () => {
  assert.match(pr('0.1.9', null, [])[0], /went down/)
})

test('released sections stay as they are', () => {
  const reworded = BASE.replace('- Worm.', '- Worm, the long one.')
  const fix = section('0.2.1', '2026-10-05', '### Fixed\n\n- A fix.')
  const found = check({
    baseVersion: '0.2.0',
    baseChangelog: BASE,
    version: '0.2.1',
    changelog: reworded.replace('## 0.2.0', `${fix}\n## 0.2.0`),
    shipped: ['hooks/host.ts'],
  })
  assert.deepEqual(found, ['CHANGELOG.md: the section of 0.2.0 is released and must stay as it is.'])

  const docs = check({ baseVersion: '0.2.0', baseChangelog: BASE, version: '0.2.0', changelog: reworded, shipped: [] })
  assert.equal(docs.length, 1)
  assert.match(docs[0], /0\.2\.0 is released/)
})

test('no section comes or goes without a version', () => {
  const dropped = check({
    baseVersion: '0.2.0',
    baseChangelog: BASE,
    version: '0.2.0',
    changelog: changelog(SECOND),
    shipped: [],
  })
  assert.match(dropped[0], /no section is added or removed/)
})

test('the text above the first version may change', () => {
  const found = check({
    baseVersion: '0.2.0',
    baseChangelog: BASE,
    version: '0.2.0',
    changelog: BASE.replace('For the player.', 'What changes for the person playing.'),
    shipped: [],
  })
  assert.deepEqual(found, [])
})

test('a base that is not in form yet holds nothing fixed', () => {
  const found = check({
    baseVersion: '0.2.0',
    baseChangelog: '# Changelog\n\n## 0.2.0 (unreleased)\n\n- Worm.\n',
    version: '0.2.0',
    changelog: BASE,
    shipped: [],
  })
  assert.deepEqual(found, [])
})

test('a release says what its section says, without the heading', () => {
  assert.equal(releaseNotes(BASE, '0.2.0'), '### Added\n\n- Worm.\n\n### Fixed\n\n- A click\n  anywhere works.')
  assert.equal(releaseNotes(BASE.replaceAll('\n', '\r\n'), '0.1.0'), '### Added\n\n- A game in a pane.')
  assert.throws(() => releaseNotes(BASE, '0.3.0'), /no section for 0\.3\.0/)
})
