# claude-arcade

A Claude Code plugin (function hooks, early-access API): retro games in a pane
that run while Claude works and freeze when Claude needs the person.

## Layout

- `hooks/register.tsx`: hooks module. `/arcade`, the pane, and the pause state
  from Claude's turn events (`turn.start`, `turn.complete`, `AskUserQuestion`,
  `classic.PermissionRequest`).
- `hooks/<game>.tsx`: surface module per game. Runs on the drawing thread,
  owns loop, keys and frame. No `$` there; it talks to the hooks module only
  through props and `surface.post`.
- `hooks/<game>-game.ts`: the game as pure logic, no drawing, no clock.
- `types/index.d.ts`: state contract (`PluginState['arcade']`).
- `tests/`: `claude plugin test` suites.

## Rules

- Before every commit: `claude plugin validate .` and `claude plugin test .`
  must pass. CI runs both on a pinned Claude Code version (`ci.yml`).
- Every behaviour change gets a test. Game rules are tested on the pure logic;
  the pause wiring through `$.ui.mount`.
- The plugin is named `arcade`: names starting with `claude-` are reserved.
- Work on a branch, merge to `main` through a pull request with green CI.
- Commits carry the GitHub noreply address, never a private e-mail.
- The API types live in `.claude-plugin/types/` (written by the engine,
  git-ignored). The API moves between releases: when raising
  `CLAUDE_CODE_VERSION` in CI, re-run validate and the tests on that version.
- Code and comments in English; README in English; CHANGELOG per release.
