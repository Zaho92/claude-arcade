# claude-arcade

[![CI](https://github.com/Zaho92/claude-arcade/actions/workflows/ci.yml/badge.svg)](https://github.com/Zaho92/claude-arcade/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Zaho92/claude-arcade)](https://github.com/Zaho92/claude-arcade/releases)
[![License](https://img.shields.io/github/license/Zaho92/claude-arcade)](LICENSE)

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

The line under the field says why it stands still. Bricks and Worm, once
frozen in mid-play for a second or more, wait for `P` when Claude works again: your keyboard may
still be at the prompt. Each game keeps its high
score across sessions, also when you leave a game with `Q` or close the pane
in the middle of one.

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

   ```
      ▄▀█ █▀█ █▀▀ ▄▀█ █▀▄ █▀▀
      █▀█ █▀▄ █▄▄ █▀█ █▄▀ ██▄
   ╭───────────────────────────╮
   │ ▶ ██ Bricks      Best 870 │
   │                           │
   │   ██ Worm         Best 31 │
   │                           │
   │      Merge                │
   │                           │
   │   ✱  Mines                │
   │                           │
   │   ●○ Bulls & Cows         │
   │                           │
   │   ♥★ Pairs                │
   ╰───────────────────────────╯
    Clear the wall
    ↑/↓ choose · Enter play · Esc prompt
   ```

3. Give Claude something to do. The game runs as soon as Claude starts.

| Key | |
|---|---|
| `←` `→` `↑` `↓` (or `WASD`, `HJKL`) | move |
| `Space` / `Enter` | the game's main action, restart after game over |
| `F` / `X` | the game's second action (flag a field in Mines) |
| `P` | pause yourself, continue after a pause |
| `Q` / `Backspace` | back to the menu |
| `Esc` | hand the keyboard back to the prompt |

The letter keys also work on a Russian layout. When the game freezes, press
`Esc`, answer Claude, then click back into the pane (and press `P` in Bricks and Worm).

It runs in the Claude Code CLI in a terminal. Mobile and VS Code cannot draw
the game region yet and show a note instead.

## Games

| Game | |
|---|---|
| Bricks | Clear the wall with ball and paddle |
| Worm | Eat, grow, never bite yourself; faster every five bites |
| Merge | Slide and merge number tiles up to the gold tile and beyond; turn-based, so a pause never costs anything |
| Mines | Open every safe field, flag the mines; the first field is always safe |
| Bulls & Cows | Crack a four-digit code in ten tries, the old pencil-and-paper game |
| Pairs | Find the matching cards in as few tries as you can; bigger boards as the pane allows; turn-based |

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

## Contributing

Contributions are very welcome, translations and new games above all.

- **Translations:** the nine languages besides English were translated
  without native review. If yours reads oddly, a one-line pull request to
  `hooks/i18n.ts` makes a real difference. New languages are welcome too.
- **New games:** a game is one file of pure logic; the arcade handles keys,
  pausing, drawing and high scores. Original games and public-domain classics
  only, no trademarks or look-alikes.
- **Ideas and bugs:** open an issue.

[CONTRIBUTING.md](CONTRIBUTING.md) has the details, and how versions and
releases work. What changed in each version is in
[CHANGELOG.md](CHANGELOG.md); security problems go through
[SECURITY.md](SECURITY.md).

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

More games are on the way. Have one in mind? Open an issue.

## About this project

claude-arcade is a hobby project. I am a software developer, but not a
TypeScript developer: the code was written with AI (Claude Code) and reviewed
by me to the best of my knowledge and belief. Expect rough edges, and please
report them.

## Legal

Every game here is either original or based on a public-domain classic, with
its own name and its own look. None of them knowingly uses trademarks,
distinctive designs or assets of other games.

This is an unofficial community project, not affiliated with or endorsed by
Anthropic. Claude and Claude Code are trademarks of Anthropic and are named
here only to say what the plugin works with.

If you believe something in this repository infringes your rights, please get
in touch, by opening an issue or through the contact on my GitHub profile. I
will look into it right away and, when in doubt, take it down. Let's sort it
out directly and quickly.

## License

MIT
