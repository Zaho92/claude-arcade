# claude-arcade

A Claude Code plugin (function hooks, early-access API): retro games in a pane
that run while Claude works and freeze when Claude needs the person.

## Layout

The plugin is the folder `plugin/`: what is in it is what an installation
gets, and what the plugin directory's validator reads. Tests, CI and docs
stay outside it.

- `plugin/hooks/register.tsx`: hooks module. `/arcade`, the pane, the language, and
  what the games wait for, kept per cause (`Waiting`): the main turn
  (`turn.start`, `turn.complete`), each open question (`AskUserQuestion`)
  and each permission dialog (`tool.check`, `classic.PermissionRequest`,
  ended by its `tool.call`). The pause state is derived from it.
- `plugin/hooks/arcade.tsx`: the one surface module. Runs on the drawing thread and
  draws menu and game. No `$` there; it talks to the hooks module only
  through props and `surface.post`.
- `plugin/hooks/host.ts`: keys, menu, pause and frame clock as pure logic.
- `plugin/hooks/games/<game>.ts`: each game as pure logic behind `GameDef`, no
  drawing, no clock; listed in `plugin/hooks/games/index.ts`.
- `plugin/hooks/i18n.ts`: every text, ten languages. `plugin/hooks/glyphs.ts`: characters
  (unicode and ascii) and on-screen text width.
- `plugin/types/index.d.ts`: state contract (`PluginState['arcade']`).
- `.claude-plugin/marketplace.json`: the marketplace of this repo; its one
  plugin is `./plugin`.
- `tests/`: `claude plugin test` suites, run by `node scripts/test.mjs`. They
  import the plugin as `../hooks/...`: the script copies them into `plugin/`
  for the run. `tests/frames.ts` checks a game's frame in both glyph sets.
- `.github/scripts/`: the release rules CI checks, with their own tests
  (`node --test ".github/scripts/*.test.mjs"`).

## Rules

- Before every commit: `claude plugin validate .`, `claude plugin validate
  plugin` and `node scripts/test.mjs` must pass. CI runs them on a pinned Claude Code version (`ci.yml`).
- Every behaviour change gets a test. Game rules are tested on the pure logic;
  the pause wiring through `$.ui.mount`.
- No text in code: every string the person sees is a key in `plugin/hooks/i18n.ts`,
  in English and in every other language. Width on screen is `textWidth`,
  never `.length` (CJK takes two cells).
- Every glyph a game draws comes from `Glyphs`, with an ascii fallback.
- No hook answers or changes a permission: `tool.check` is not hooked, and the
  `classic.PermissionRequest` hook ends in `return next(e)`: the answer is
  neither bound nor read. The plugin directory refuses anything else.
- `userConfig` fields list no `options` (the directory refuses them): the
  allowed values stand in the description, and the code takes any other value
  as `auto`.
- The `Client` element in `register.tsx` keeps its shape: tag and
  `module="./arcade.tsx"` on one line, and no `const { Client } = ...` line.
  The plugin directory's check flagged the `const { Client }` line
  (`MOD_IMPORT_DYNAMIC_COMPUTED`); the element's name stands nowhere else in
  that file, comments included.
- A function that takes `$` is declared at the top level of its file; the
  validator refuses `$` handed to a closure.
- The state contract (`plugin/types/index.d.ts`) is self-contained: no imports.
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
- Every merge that changes `plugin/` or `.claude-plugin/` is a release: add a `## <version> - <date>` section on top of CHANGELOG.md
  and raise `version` in `plugin/.claude-plugin/plugin.json` by the step it calls
  for. Only Fixed is a patch; Added or Changed a minor; a `**Breaking:**`
  entry a major. CI checks it (`.github/scripts/check-version.mjs`);
  CONTRIBUTING.md, "Versions and releases", has the full rules.
- The changelog is for the person playing: what they notice, nothing about
  tests, docs or CI. Released sections are never edited.
- Commits carry the GitHub noreply address, never a private e-mail.
- The API types live in `plugin/.claude-plugin/types/` (written by the engine,
  git-ignored). The API moves between releases: when raising
  `CLAUDE_CODE_VERSION` in CI, re-run validate and the tests on that version.
- Code and comments in English; README in English; CHANGELOG per release.
