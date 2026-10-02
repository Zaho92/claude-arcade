# Changelog

## 0.2.0 (unreleased)

- Snake.
- Game menu: pick a game with ↑/↓ and Enter, Q or Backspace leaves a game.
- Ten languages (en, de, fr, es, pt, it, ja, zh, ko, ru), chosen from the
  plugin setting, Claude Code's `language` setting or the system locale.
- ascii glyphs for terminals that draw symbols two cells wide; automatic for
  Chinese, Japanese and Korean.
- Optional chime when Claude needs you (off by default, macOS only).
- Letter keys work on a Russian layout too.
- High scores per game; 0.1.0's Breakout record carries over.

## 0.1.0

- Breakout in a pane, opened with `/arcade`.
- Runs while Claude works; freezes when Claude is done, asks a question or
  waits for a permission. A subagent finishing does not pause it.
- High score kept across sessions.
