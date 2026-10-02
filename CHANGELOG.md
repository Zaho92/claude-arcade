# Changelog

## 0.2.0 (unreleased)

- Worm: eat, grow, never bite yourself.
- Merge: slide and merge number tiles, turn-based.
- Mines: open the safe fields, flag the mines.
- Bulls & Cows: crack a four-digit code in ten tries.
- Game menu: pick a game with ↑/↓ and Enter, Q or Backspace leaves a game.
- Ten languages (en, de, fr, es, pt, it, ja, zh, ko, ru), chosen from the
  plugin setting, Claude Code's `language` setting or the system locale.
- ascii glyphs for terminals that draw symbols two cells wide; automatic for
  Chinese, Japanese and Korean.
- Optional chime when Claude needs you (off by default, macOS only).
- Letter keys work on a Russian layout too.
- High scores per game.
- The ball-and-paddle game is now called Bricks.
- CONTRIBUTING.md: how to translate and add games.
- README: about this project, and a legal note with a contact path.
- Fixed: in a docked pane only a click on the rows the game drew gave it the
  keys; a click anywhere in the pane does now.

## 0.1.0

- A ball-and-paddle game in a pane, opened with `/arcade`.
- Runs while Claude works; freezes when Claude is done, asks a question or
  waits for a permission. A subagent finishing does not pause it.
- High score kept across sessions.
