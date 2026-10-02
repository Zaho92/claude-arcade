# claude-arcade

Play retro games in a Claude Code pane while Claude works. The game freezes the
moment Claude needs you and picks up again when Claude gets back to work.
Speaks ten languages and follows the one you set for Claude Code.

```
 Score 120                  ♥♥·                   Level 1  Best 870
╭────────────────────────────────────────────────────────────────╮
│  ████ ████ ████ ████ ████ ████ ████ ████ ████ ████ ████ ████   │
│  ████ ████ ████ ████ ████      ████ ████ ████ ████ ████ ████   │
│  ████ ████ ████           ████ ████ ████      ████ ████ ████   │
│                                                                │
│                         ●                                      │
│                                                                │
│                      ▀▀▀▀▀▀▀▀▀▀                                │
╰────────────────────────────────────────────────────────────────╯
 ←/→ move · Space launch · P pause · Q menu · Esc prompt
```

## What it does

| Claude… | The game… |
|---|---|
| starts working on your prompt | runs |
| finishes its turn | freezes: *"Claude is done – your turn"* |
| asks you a question (AskUserQuestion) | freezes until you have answered |
| waits for a permission | freezes until the tool has run |
| runs a subagent that finishes | keeps running (only the main turn counts) |

Each game keeps its high score across sessions.

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

1. Type `/arcade`. A pane opens with the game menu (inline above the prompt,
   or docked beside the transcript in fullscreen mode).
2. Click into the pane so it gets the keyboard, pick a game with `↑`/`↓` and
   `Enter`.
3. Give Claude something to do. The game runs as soon as Claude starts.

| Key | |
|---|---|
| `←` `→` `↑` `↓` (or `WASD`, `HJKL`) | move |
| `Space` / `Enter` | the game's main action, restart after game over |
| `P` | pause yourself |
| `Q` / `Backspace` | back to the menu |
| `Esc` | hand the keyboard back to the prompt |

The letter keys also work on a Russian layout. When the game freezes, press
`Esc`, answer Claude, then click back into the pane.

It runs in the terminal and the desktop app. Mobile and VS Code cannot draw the
game region yet and show a note instead.

## Games

| Game | |
|---|---|
| Breakout | Clear the wall with ball and paddle |
| Snake | Eat, grow, never bite yourself; faster every five bites |

## Settings

Under `/plugin` → arcade → configure, or in `settings.json` under
`pluginConfigs.arcade`:

| Setting | Default | |
|---|---|---|
| `language` | `auto` | `auto`, `en`, `de`, `fr`, `es`, `pt`, `it`, `ja`, `zh`, `ko`, `ru` |
| `glyphs` | `auto` | `unicode` draws with block symbols, `ascii` with plain characters |
| `sound` | `false` | chime when Claude needs you while the arcade is open (macOS only) |

**Language.** `auto` takes the first of: Claude Code's own `language` setting
(free text such as `"german"` or `"日本語"`), then `LC_ALL`, `LC_MESSAGES`,
`LANG`, then English.

**Glyphs.** Terminals set to Chinese, Japanese or Korean often draw symbols
like `●` or `█` two cells wide, which tears the field apart. `auto` uses
`ascii` for those three languages and `unicode` otherwise.

## Translations

All texts live in `hooks/i18n.ts`. English is complete; the other nine were
translated without native review, so corrections are very welcome. To add a
language, follow the steps at the top of that file; the tests check that every
translation keeps its placeholders.

## Develop

```
claude plugin validate .
claude plugin test .
```

- `hooks/register.tsx`: the hooks module. It registers `/arcade`, opens the
  pane, picks the language and turns Claude's turn events into a pause state.
- `hooks/arcade.tsx`: the surface module. It runs on the drawing thread and
  draws the menu and the running game.
- `hooks/host.ts`: the arcade's rules: keys, menu, pause, frame clock.
- `hooks/games/`: one file per game as pure logic behind `GameDef`
  (`types.ts`), listed in `index.ts`.
- `hooks/i18n.ts`, `hooks/glyphs.ts`: texts and characters.
- `types/index.d.ts`: the plugin's state contract.

A new game is one file in `hooks/games/` implementing `GameDef`, its texts in
`hooks/i18n.ts`, an entry in `GAMES` and a test file.

The engine writes the API types to `.claude-plugin/types/` when it loads the
plugin, and `tsc -p .` type-checks against them.

## Ideas

Tetris and 2048 are next.

## License

MIT
