// The rules for CHANGELOG.md and for the version in .claude-plugin/plugin.json,
// as pure logic: text in, problems out. check-version.mjs feeds it from git.

const GROUPS = ['Added', 'Changed', 'Fixed']
const HEADING = /^## (\d+\.\d+\.\d+) - (\d{4}-\d{2}-\d{2})$/
const BREAKING = '**Breaking:**'
// An entry that opens with the word as a label, however it is dressed
// ("Breaking:", "*BREAKING CHANGES:*", "[breaking]"), or has it in bold.
const BREAKING_LIKE = /^- [^A-Za-z0-9]*breaking([ -]changes?)?[^A-Za-z0-9]*:|^- \[breaking\]|\*\*\s*breaking/i

export function parseVersion(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!m) throw new Error(`"${version}" is not a version like 1.2.3`)
  return m.slice(1).map(Number)
}

function compare(a, b) {
  const x = parseVersion(a)
  const y = parseVersion(b)
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

function isDate(text) {
  const date = new Date(`${text}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

// Reads the changelog into its sections, newest first, and names everything
// that breaks the form:
//
//   ## 1.2.3 - 2026-10-05
//
//   ### Added
//
//   - One entry, which may run on
//     over indented lines.
export function parseChangelog(text) {
  const lines = text.replaceAll('\r\n', '\n').split('\n')
  const problems = []
  const sections = []
  let section = null
  let group = null

  if (lines[0] !== '# Changelog') problems.push('The first line must be "# Changelog".')

  lines.forEach((line, index) => {
    const at = `line ${index + 1}`
    if (line.startsWith('## ')) {
      const m = HEADING.exec(line)
      section = { version: m?.[1] ?? null, date: m?.[2] ?? null, lines: [line], groups: {}, breaking: false }
      group = null
      sections.push(section)
      if (!m) problems.push(`${at}: "${line}" must read like "## 1.2.3 - 2026-10-05".`)
      else if (!isDate(m[2])) problems.push(`${at}: ${m[2]} is not a date.`)
      return
    }
    if (!section) return
    section.lines.push(line)
    const name = section.version ?? 'this section'
    if (line.startsWith('### ')) {
      group = line.slice(4)
      if (!GROUPS.includes(group)) {
        problems.push(`${at}: "${line}" is not a group. Use ${GROUPS.join(', ')}.`)
        group = null
      } else if (group in section.groups) {
        problems.push(`${at}: ${name} has "${group}" twice.`)
      } else {
        const later = GROUPS.slice(GROUPS.indexOf(group) + 1).find(g => g in section.groups)
        if (later) problems.push(`${at}: in ${name}, "${group}" comes before "${later}".`)
        section.groups[group] = 0
      }
      return
    }
    if (line.trim() === '') return
    // A mistyped marker would pass as an ordinary entry and a smaller step.
    if (BREAKING_LIKE.test(line) && !line.startsWith(`- ${BREAKING} `)) {
      problems.push(`${at}: a breaking change is an entry that starts with "- ${BREAKING} ".`)
    }
    if (line.startsWith('- ')) {
      if (!group) return problems.push(`${at}: the entry is under no group (${GROUPS.join(', ')}).`)
      section.groups[group]++
      if (line.startsWith(`- ${BREAKING}`)) section.breaking = true
      return
    }
    const continues = line.startsWith('  ') && group && section.groups[group] > 0
    if (!continues) problems.push(`${at}: "${line.trim()}" is neither a group, an entry nor the rest of one.`)
  })

  for (const s of sections) {
    const name = s.version ?? 'A section'
    if (Object.keys(s.groups).length === 0) problems.push(`${name} has no group (${GROUPS.join(', ')}).`)
    for (const [g, entries] of Object.entries(s.groups)) {
      if (entries === 0) problems.push(`${name}: "${g}" has no entry.`)
    }
    s.text = s.lines.join('\n').trimEnd()
  }

  if (sections.length === 0) problems.push('The changelog has no version.')
  for (let i = 1; i < sections.length; i++) {
    const [newer, older] = [sections[i - 1], sections[i]]
    if (!newer.version || !older.version) continue
    if (compare(newer.version, older.version) <= 0) {
      problems.push(`${newer.version} stands above ${older.version}: the newest version comes first.`)
    }
    if (newer.date < older.date) {
      problems.push(`${newer.version} (${newer.date}) is dated before ${older.version} (${older.date}).`)
    }
  }

  return { sections, problems }
}

// The one version that may follow `before` for what the section says:
// only Fixed is a patch, Added or Changed a minor, Breaking a major. Before
// 1.0 a breaking change is a minor too.
export function nextVersion(before, section) {
  const [major, minor, patch] = parseVersion(before)
  if (section.breaking && major > 0) return `${major + 1}.0.0`
  if (section.breaking || 'Added' in section.groups || 'Changed' in section.groups) {
    return `${major}.${minor + 1}.0`
  }
  return `${major}.${minor}.${patch + 1}`
}

function reason(section) {
  if (section.breaking) return 'it has a Breaking entry'
  if ('Added' in section.groups) return 'it has entries under Added'
  if ('Changed' in section.groups) return 'it has entries under Changed'
  return 'it has entries under Fixed only'
}

// Everything a pull request must get right about version and changelog.
//
//   baseVersion, baseChangelog: as on the branch the pull request merges into
//   version, changelog: as in the pull request
//   shipped: the changed files that an installation runs
export function check({ baseVersion, baseChangelog, version, changelog, shipped }) {
  const { sections, problems } = parseChangelog(changelog)
  if (problems.length > 0) return problems.map(p => `CHANGELOG.md: ${p}`)

  const found = []
  const raised = compare(version, baseVersion) > 0
  if (compare(version, baseVersion) < 0) {
    found.push(`plugin.json: the version went down from ${baseVersion} to ${version}.`)
  }
  if (shipped.length > 0 && !raised) {
    found.push(`plugin.json: the version is ${version}, as before. Shipped files changed, so raise it.`)
  }
  if (sections[0].version !== version) {
    found.push(`CHANGELOG.md: the top section is ${sections[0].version}, plugin.json says ${version}.`)
  }

  // Released sections are history: new ones go on top, the rest stays as it
  // was. A base that is not in this form yet has nothing to hold fixed.
  const base = parseChangelog(baseChangelog)
  const added = raised ? 1 : 0
  if (base.problems.length > 0) {
    console.log('The base changelog is not in this form yet: its sections are not compared.')
  } else if (sections.length !== base.sections.length + added) {
    found.push(
      raised
        ? `CHANGELOG.md: a new version adds exactly one section on top; there are ${sections.length} now and were ${base.sections.length}.`
        : `CHANGELOG.md: the version stays ${version}, so no section is added or removed.`
    )
  } else {
    base.sections.forEach((old, i) => {
      if (sections[i + added].text !== old.text) {
        found.push(`CHANGELOG.md: the section of ${old.version} is released and must stay as it is.`)
      }
    })
  }

  if (raised && sections[0].version === version) {
    // The step to 1.0.0 is declared by hand, whatever the section holds.
    const stable = version === '1.0.0' && parseVersion(baseVersion)[0] === 0
    const expected = nextVersion(baseVersion, sections[0])
    if (!stable && version !== expected) {
      found.push(
        `plugin.json: after ${baseVersion} comes ${expected}, not ${version}: ${reason(sections[0])}.`
      )
    }
  }
  return found
}

// What a release says about itself: the section of its version, without the
// heading. The release carries version and date already.
export function releaseNotes(changelog, version) {
  const section = parseChangelog(changelog).sections.find(s => s.version === version)
  if (!section) throw new Error(`CHANGELOG.md has no section for ${version}.`)
  return section.lines.slice(1).join('\n').trim()
}
