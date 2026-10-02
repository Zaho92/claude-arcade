# claude-arcade

A Claude Code plugin (function hooks, early-access API): retro games in a pane
that run while Claude works and freeze when Claude needs the person.

## Layout

- `hooks/register.tsx`: hooks module. `/arcade`, the pane, the language, and
  the pause state from Claude's turn events (`turn.start`, `turn.complete`,
  `AskUserQuestion`, `classic.PermissionRequest`).
- `hooks/arcade.tsx`: the one surface module. Runs on the drawing thread and
  draws menu and game. No `$` there; it talks to the hooks module only
  through props and `surface.post`.
- `hooks/host.ts`: keys, menu, pause and frame clock as pure logic.
- `hooks/games/<game>.ts`: each game as pure logic behind `GameDef`, no
  drawing, no clock; listed in `hooks/games/index.ts`.
- `hooks/i18n.ts`: every text, ten languages. `hooks/glyphs.ts`: characters
  (unicode and ascii) and on-screen text width.
- `types/index.d.ts`: state contract (`PluginState['arcade']`).
- `tests/`: `claude plugin test` suites.
- `.github/scripts/`: the release rules CI checks, with their own tests
  (`node --test ".github/scripts/*.test.mjs"`).

## Rules

- Before every commit: `claude plugin validate .` and `claude plugin test .`
  must pass. CI runs both on a pinned Claude Code version (`ci.yml`).
- Every behaviour change gets a test. Game rules are tested on the pure logic;
  the pause wiring through `$.ui.mount`.
- No text in code: every string the person sees is a key in `hooks/i18n.ts`,
  in English and in every other language. Width on screen is `textWidth`,
  never `.length` (CJK takes two cells).
- Every glyph a game draws comes from `Glyphs`, with an ascii fallback.
- A function that takes `$` is declared at the top level of its file; the
  validator refuses `$` handed to a closure.
- The state contract (`types/index.d.ts`) is self-contained: no imports.
- No trademarks and no look-alikes of protected games, not even in code
  identifiers: own names, own looks, own colors (CONTRIBUTING.md, "Original
  games only"). Falling-block puzzles are out entirely.
- The plugin is named `arcade`: names starting with `claude-` are reserved.
- Work on a branch, one topic per pull request. Open the pull request and
  stop: only the maintainer merges, because a merge ships to every
  installation. Never merge, never push to `main`, never create or move a tag.
- Before opening a pull request that changes code, run `/code-review` and put
  its findings, and what became of them, into the description.
- The maintainer reads but does not write TypeScript. Fill in the pull request
  template for that reader: what changes for the player, what was tested, how
  to try it by hand. The title is one plain English sentence; it becomes the
  squashed commit on `main`.
- Every merge that changes `hooks/`, `sounds/`, `types/` or `.claude-plugin/`
  is a release: add a `## <version> - <date>` section on top of CHANGELOG.md
  and raise `version` in `.claude-plugin/plugin.json` by the step it calls
  for. Only Fixed is a patch; Added or Changed a minor; a `**Breaking:**`
  entry a major (a minor before 1.0). CI checks it
  (`.github/scripts/check-version.mjs`); CONTRIBUTING.md, "Versions and
  releases", has the full rules.
- The changelog is for the person playing: what they notice, nothing about
  tests, docs or CI. Released sections are never edited.
- 1.0.0 is the maintainer's call. Do not propose or make that step unasked.
- Commits carry the GitHub noreply address, never a private e-mail.
- The API types live in `.claude-plugin/types/` (written by the engine,
  git-ignored). The API moves between releases: when raising
  `CLAUDE_CODE_VERSION` in CI, re-run validate and the tests on that version.
- Code and comments in English; README in English; CHANGELOG per release.
