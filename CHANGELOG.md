# Changelog

What changes for the person playing, newest first. Changes to tests, docs and
CI are in the pull requests, not here.

## 1.1.0 - 2026-10-03

### Added

- Lamps: a new game. A board of 5 x 5 lamps, some of them lit. Press a lamp
  and it switches, and so do the four next to it. Get every lamp dark to
  reach the next level, which starts with more lamps to undo. The fewer
  presses a board takes, the more points it scores.

## 1.0.1 - 2026-10-03

### Fixed

- Where the arcade cannot be shown, such as VS Code or mobile, its note now
  says it needs the terminal, and no longer names the desktop app, where
  Arcade has not been tried.

## 1.0.0 - 2026-10-02

### Changed

- The main menu has a new look: the title in large colored letters, the
  games in a frame like the one around a game's field, with air between
  them, each with a sign in its own colors, and the chosen game on a bar.
  Records stand at the right edge. The line that says what a game is about is shown for the chosen game
  only, under the list, so it is no longer cut off in a narrow pane.

## 0.4.0 - 2026-10-02

### Changed

- Bricks and Worm: a game Claude interrupted in mid-play no longer runs on by
  itself when Claude is back at work. It stays paused until you press P, so
  the ball does not fly while the keyboard is still at the prompt. A freeze
  shorter than a second, a game that waits for its start anyway, and the
  turn-based games go on as before.

## 0.3.0 - 2026-10-02

### Added

- A pane too narrow for a game says so, instead of drawing a field cut off on
  the right. The game waits and comes back when the pane is wide again.
- Worm: filling the whole board is a win, with a line of its own.

### Changed

- The line that says why a game stands still (Claude is done, has a question,
  waits for your approval; "Space: start"; game over) is now under the field
  and shown in full. It used to cover the field's middle row and was cut off
  in the narrow games.
- A finished game takes two keys only: Space starts the next one, Q goes back
  to the menu.
- Bricks: the ball stops getting faster after a few levels, at a pace the
  paddle can still meet.
- Merge: the texts speak of the gold tile instead of naming its number.
- `/arcade` says why the pane cannot be shown, instead of always blaming the
  width of the terminal.

### Fixed

- High scores: leaving a game with Q no longer loses what was scored, and a
  new record is stored while the game still runs, so closing the pane in the
  middle of a game keeps it.
- High scores: in Bricks, starting again with ↑ after a game over left the
  next game's score unrecorded.
- High scores: two Claude Code sessions open at once no longer overwrite
  each other's records.
- A permission dialog kept the game frozen only until any tool finished, a
  subagent's for example. Now it is the tool the dialog was for.
- A question or a permission dialog answered while Claude is idle no longer
  sets the game running.
- A permission that a settings hook answers by itself, so that no dialog
  opens, no longer freezes the game until the tool has run.
- With the ascii glyphs, the mark between the parts of a line ("P pause |
  Q menu") is a plain character too.
- Worm: the worm is visible before the game starts.
- Bulls & Cows and Mines: the end of a game no longer hides a row of the
  board.
- Merge: reaching the goal with the last possible move shows the game-over
  line, not "Keep going".
- With the chime switched on, a dialog no longer waits for the sound to
  finish.

## 0.2.0 - 2026-10-02

### Added

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
- High scores per game.

### Changed

- The ball-and-paddle game is now called Bricks.

### Fixed

- Letter keys work on a Russian layout too.
- In a docked pane only a click on the rows the game drew gave it the keys; a
  click anywhere in the pane does now.

## 0.1.0 - 2026-10-02

### Added

- A ball-and-paddle game in a pane, opened with `/arcade`.
- Runs while Claude works; freezes when Claude is done, asks a question or
  waits for a permission. A subagent finishing does not pause it.
- High score kept across sessions.
