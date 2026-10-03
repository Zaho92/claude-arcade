# Changelog

What changes for the person playing, newest first. Changes to tests, docs and
CI are in the pull requests, not here.

## 1.7.0 - 2026-10-04

### Changed

- When one of your own hooks answers a permission request in your place, the game now freezes all the same, until the tool has run or was refused; before, it ran on. With `sound` on, it chimes then too. The arcade no longer looks at the answer to a permission request at all.

## 1.6.0 - 2026-10-03

### Changed

- The settings `language` and `glyphs` are typed in as text instead of picked from a list. The values are the same (`auto`, `en`, `de`, … and `auto`, `unicode`, `ascii`), and a value the arcade does not know counts as `auto`.
- When Claude runs several commands at once and one of them waits for your permission, the game may stay frozen a moment longer than before, until those commands have ended. It still never runs on under an open permission dialog.
- Installing from a clone now points at the `plugin` folder inside it: `claude --plugin-dir ./claude-arcade/plugin`. Installing and updating through `/plugin` works as before.

## 1.5.0 - 2026-10-03

### Added

- Meteors: single rocks of three sizes fall from the top, each at its own pace and with a glowing trail, and you slide your ship along the bottom row with ← and →. The sky starts almost empty; every rock that gets past you scores a point, and the more you score, the faster they fall and the more of them come. Now and then a bonus falls among the rocks; catch it for extra points. You have three lives: a hit costs one, clears the field, and Space sends the next ship. Like Bricks and Worm, it waits for P when Claude has interrupted it.

## 1.4.0 - 2026-10-03

### Added

- Pairs: find the matching cards. Move the cursor, turn two cards per try;
  a match stays open, a miss stays shown until your next key, which then
  does what it says. Fewer tries give more points. Each cleared board leads
  to one with more cards, as far as the pane has room. Nothing runs on a
  clock, so a pause never hides or reveals anything.

## 1.3.0 - 2026-10-03

### Added

- Lamps: a new game. A board of 5 x 5 lamps, some of them lit. Press a lamp
  and it switches, and so do the four next to it. Get every lamp dark to
  reach the next level, which starts with more lamps to undo. The fewer
  presses a board takes, the more points it scores.

## 1.2.0 - 2026-10-03

### Added

- Fifteen: the old sliding puzzle. Slide the numbered tiles into order, 1 to
  15, with the gap in the last corner. An arrow slides the tile next to the
  gap in that direction. Tiles already in their place turn green, the score
  line counts your moves, and the fewer moves you need, the higher the
  score. Space starts a new shuffle. Turn-based, so a pause never costs
  anything.

## 1.1.0 - 2026-10-03

### Added

- Bricks: now and then a broken brick drops a bonus. It falls straight down;
  catch it with the paddle to switch it on, miss it and it just falls out.
  There are four, each with its own sign: an extra ball (a life is only lost
  when the last ball is gone), a wide paddle for a while, a slow ball for a
  while (back to the first wall's speed) and an extra life (only while you
  have fewer than three).
- Bricks: a running wide paddle or slow ball shows in the bottom corner of
  the field, with a bar that runs down as the time runs out. Pausing stops
  the bonuses and the bars together with the ball.
- Bricks: a lost life or a cleared wall ends the running bonuses and drops
  the ones still falling.

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
