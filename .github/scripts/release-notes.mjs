// Prints the CHANGELOG.md section of a version, as the text of its release.
//
// usage: node .github/scripts/release-notes.mjs <version>

import { readFileSync } from 'node:fs'
import { releaseNotes } from './changelog.mjs'

const version = process.argv[2]
if (!version) {
  console.error('usage: release-notes.mjs <version>')
  process.exit(2)
}

try {
  console.log(releaseNotes(readFileSync('CHANGELOG.md', 'utf8'), version))
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
