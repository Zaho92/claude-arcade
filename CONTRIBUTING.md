# Contributing

Thanks for wanting to help! Translations and new games are the most welcome
contributions, but bug reports, ideas and fixes of any size are too.

## Translations

All texts live in `plugin/hooks/i18n.ts`: about fifty short lines per language.

- **Fix a translation:** edit the line and open a pull request. Say which
  language you speak natively; that is all the review needs.
- **Add a language:** copy the `en` block, translate it, and follow the steps
  in the comment at the top of the file (the language code goes into
  `LOCALES`, `plugin/types/index.d.ts` and the `language` description in
  `plugin/.claude-plugin/plugin.json`). Keep placeholders like `{n}` as they are; a
  test checks them.
- Keep the tone short and friendly, the way a game talks to its player.

## New games

A game is one file of pure logic in `plugin/hooks/games/`, implementing `GameDef`
from `plugin/hooks/games/types.ts`. The arcade does the rest: keys, menu, pause,
drawing, high scores.

1. Write `plugin/hooks/games/<game>.ts`: create, key, tick, status, hud, frame,
   and its sign for the menu (two cells, in its own colors).
2. Add its texts (name, one-line description, help line) to `plugin/hooks/i18n.ts`,
   in every language; a test checks that none is missing. For a language you
   do not speak, a careful machine translation is fine: say so in the pull
   request, and a native speaker can correct it later.
3. Add it to `GAMES` in `plugin/hooks/games/index.ts`.
4. Add `tests/<game>.test.ts` covering its rules and that every row of its
   frame is exactly as wide as the field in both glyph sets (`expectFrames`
   in `tests/frames.ts` does the measuring).

The line that says "Space: start" or how a game ended is drawn under the
field by the arcade: a game's frame is the field alone, and every character
in it comes from `Glyphs`.

Games that move on keys alone (turn-based) suit the arcade especially well:
pausing never costs the player anything.

### Original games only

This is a public project, so it stays clear of other people's rights:

- **No trademarks.** No game, character or company names that someone owns,
  not even in code identifiers. Describe instead: "Bricks", not the name of
  the arcade original.
- **No look-alikes of protected games.** Game rules are generally free to
  use; a game's specific look is not. Do not copy a known game's distinctive
  visuals, pieces or layout. Some games, falling-block puzzles above all,
  are off limits entirely because their look and rules are inseparable.
- **No copied assets.** Colors, sounds and artwork are our own.
- Public-domain classics (board games, pencil-and-paper games, puzzles from
  the 19th century) are always a safe start.

When in doubt, open an issue and ask before building.

## Before you open a pull request

```
claude plugin validate .
claude plugin validate plugin
node scripts/test.mjs
```

The first checks the marketplace, the second the plugin, the third runs the
tests (it copies `tests/` into the plugin folder for the run, because
`claude plugin test` looks for them there). All three must pass; CI runs them on every pull request. Work on a branch and keep
a pull request to one topic.

- **Title:** one plain English sentence that says what happens, with the area
  in front where it helps: "Mines: flags survive a pause". Pull requests are
  squashed, so the title becomes the one commit on `main`.
- **Description:** follow the template. Write it for someone who does not read
  TypeScript: what changes for the player, what you tested, how to try it.
- **Review:** the maintainer reads every pull request and is the only one who
  merges. Code written with Claude Code gets a `/code-review` run before the
  pull request is opened, with its findings in the description.

## Versions and releases

Installations follow `main`, and `claude plugin update` only picks up a
higher version. So there is no "unreleased": **every merge that changes what
the plugin ships is a release.** Shipped is everything under `plugin/`,
and the marketplace in `.claude-plugin/`. Tests, docs and CI are not, and
need neither a version nor a changelog entry.

A pull request that ships something does two things:

1. It adds a section on top of `CHANGELOG.md`.
2. It raises `version` in `plugin/.claude-plugin/plugin.json` by the step that
   section calls for.

### The changelog

The changelog is for the person playing. Say what they will notice, not what
the code does.

```
## 1.3.0 - 2026-10-05

### Added

- Mines: open the safe fields, flag the mines.

### Fixed

- Worm no longer turns back into itself on a fast double key.
```

- The heading is the version and the day the pull request was written.
- Entries go under **Added**, **Changed** or **Fixed**, in that order; leave
  out the groups you do not need.
- A change that takes something away from the player starts with
  `**Breaking:**`. That is: high scores are lost (the state contract in
  `plugin/types/index.d.ts` changed), a game or a setting is gone, or a newer Claude
  Code is required.
- Released sections stay as they are. A mistake in one is corrected by an
  entry in the next version.

### The version

The step follows from the section, and CI checks it:

| The section has | Step | Example |
|---|---|---|
| only Fixed | patch | 1.2.0 → 1.2.1 |
| Added or Changed | minor | 1.2.1 → 1.3.0 |
| a `**Breaking:**` entry | major | 1.3.0 → 2.0.0 |

Two open pull requests cannot both take the same version. The second one to
merge is updated from `main` and takes the next.

### After the merge

Nothing is done by hand. A workflow tags the merged commit `v<version>` and
publishes a GitHub release: the changelog section, then the list of pull
requests since the last tag. Tags are never moved or deleted. A release that
turns out broken is not withdrawn; the fix is the next patch version.

### The Claude Code version

CI runs on one pinned Claude Code version (`CLAUDE_CODE_VERSION` in
`.github/workflows/ci.yml`), because the plugin API is early access. A weekly
run tries the newest version and opens an issue when the checks fail there.
Raising the pin is a pull request of its own. It is a release only if
`plugin/hooks/` had to change for it, and a breaking one if older Claude Code
versions stop working.

## Reporting bugs

Open an issue with the bug form: it asks for your Claude Code version
(`claude --version`), your terminal, the language you use, and what happened.
A copy of the screen helps. Security problems go through
[SECURITY.md](SECURITY.md), not a public issue.
