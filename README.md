# claude-arcade

Play Breakout in a Claude Code pane while Claude works. The game freezes the
moment Claude needs you and picks up again when Claude gets back to work.

```
 Punkte 120                 ♥♥·                 Level 1  Rekord 870
╭────────────────────────────────────────────────────────────────╮
│  ████ ████ ████ ████ ████ ████ ████ ████ ████ ████ ████ ████   │
│  ████ ████ ████ ████ ████      ████ ████ ████ ████ ████ ████   │
│  ████ ████ ████           ████ ████ ████      ████ ████ ████   │
│                                                                │
│                         ●                                      │
│                                                                │
│                      ▀▀▀▀▀▀▀▀▀▀                                │
╰────────────────────────────────────────────────────────────────╯
 ←/→ bewegen · Leertaste starten · P Pause · Esc zur Eingabe
```

## What it does

| Claude… | The game… |
|---|---|
| starts working on your prompt | runs |
| finishes its turn | freezes: *"Claude ist fertig, du bist dran"* |
| asks you a question (AskUserQuestion) | freezes until you have answered |
| waits for a permission | freezes until the tool has run |
| runs a subagent that finishes | keeps running (only the main turn counts) |

Your high score is kept across sessions.

## Install

Requires Claude Code **2.1.287 or newer**. The plugin uses the function-hooks
plugin API, which is early access and may change between releases.

From the marketplace in this repo:

```
/plugin marketplace add zaho92/claude-arcade
/plugin install arcade@zaho92-arcade
```

Or from a clone, for one session:

```
git clone https://github.com/zaho92/claude-arcade
claude --plugin-dir ./claude-arcade
```

## Play

1. Type `/arcade`. A pane opens with the game (inline above the prompt, or
   docked beside the transcript in fullscreen mode).
2. Click into the field so it gets the keyboard.
3. Give Claude something to do. The game runs as soon as Claude starts.

| Key | |
|---|---|
| `←` `→` (or `A` `D`, `H` `L`) | move the paddle |
| `Space` / `Enter` | launch the ball, restart after game over |
| `P` | pause yourself |
| `Esc` | hand the keyboard back to the prompt |

When the game freezes, press `Esc`, answer Claude, then click back into the
field.

It runs in the terminal and the desktop app. Mobile and VS Code cannot draw the
game region yet and show a note instead.

## Develop

```
claude plugin validate .
claude plugin test .
```

- `hooks/register.tsx`: the hooks module. It registers `/arcade`, opens the
  pane and turns Claude's turn events into a pause state.
- `hooks/breakout.tsx`: the surface module. It runs on the drawing thread and
  owns the game loop, the keys and the frame.
- `hooks/breakout-game.ts`: Breakout as pure logic, tested on its own.
- `types/index.d.ts`: the plugin's state contract.

The engine writes the API types to `.claude-plugin/types/` when it loads the
plugin, and `tsc -p .` type-checks against them.

## Ideas

Asteroids, Snake and Tetris as further games, with a picker in the pane.

## License

MIT
