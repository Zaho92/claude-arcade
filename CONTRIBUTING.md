# Contributing

Thanks for wanting to help! Translations and new games are the most welcome
contributions, but bug reports, ideas and fixes of any size are too.

## Translations

All texts live in `hooks/i18n.ts`: about forty short lines per language.

- **Fix a translation:** edit the line and open a pull request. Say which
  language you speak natively; that is all the review needs.
- **Add a language:** copy the `en` block, translate it, and follow the steps
  in the comment at the top of the file (the language code goes into
  `LOCALES`, `types/index.d.ts` and the `language` options in
  `.claude-plugin/plugin.json`). Keep placeholders like `{n}` as they are; a
  test checks them.
- Keep the tone short and friendly, the way a game talks to its player.

## New games

A game is one file of pure logic in `hooks/games/`, implementing `GameDef`
from `hooks/games/types.ts`. The arcade does the rest: keys, menu, pause,
drawing, high scores.

1. Write `hooks/games/<game>.ts`: create, key, tick, status, hud, frame.
2. Add its texts (name, one-line description, help line) to `hooks/i18n.ts`,
   in English at least. Other languages fall back to English until someone
   translates them.
3. Add it to `GAMES` in `hooks/games/index.ts`.
4. Add `tests/<game>.test.ts` covering its rules and that every row of its
   frame is exactly as wide as the field in both glyph sets.

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
claude plugin test .
```

Both must pass; CI runs them on every pull request. Work on a branch, keep a
pull request to one topic, and describe what you tested by hand.

## Reporting bugs

Open an issue with your Claude Code version (`claude --version`), your
terminal, the language you use, and what happened. A copy of the screen helps.
