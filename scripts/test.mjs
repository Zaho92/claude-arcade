// Runs the tests. They live beside the plugin, not in it, so that the plugin
// folder holds only what is shipped; `claude plugin test` looks for them in
// the plugin's folder. So they are copied in for the run and taken out again.
//
// usage: node scripts/test.mjs

import { spawnSync } from 'node:child_process'
import { cpSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const plugin = join(root, 'plugin')
// Git-ignored: a run that is killed leaves it behind, the next one replaces it.
const copy = join(plugin, 'tests')

rmSync(copy, { recursive: true, force: true })
cpSync(join(root, 'tests'), copy, { recursive: true })
let status = 1
try {
  // A shell, because on Windows `claude` is a .cmd file.
  const run = spawnSync('claude plugin test .', { cwd: plugin, stdio: 'inherit', shell: true })
  status = run.status ?? 1
} finally {
  rmSync(copy, { recursive: true, force: true })
}
process.exit(status)
