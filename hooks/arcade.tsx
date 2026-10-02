// The surface module: runs on the drawing thread and hosts the menu and the
// games. The rules live in host.ts; this file wires keys and the frame clock
// to them and draws. The hooks module tells it whether Claude is working, in
// which language to speak and which glyphs to use, and keeps the high scores.

import type { ClientElements, ClientModule } from 'claude-code'

import { GAMES } from './games'
import type { Frame } from './games/types'
import { GLYPHS, padTo, textWidth, withSep } from './glyphs'
import type { Glyphs } from './glyphs'
import { CHECKPOINT_MS, FRAME_MS, checkpoint, commandFor, fits, frameTick, handle, newHost } from './host'
import type { Host, Running } from './host'
import { t } from './i18n'
import type { TextKey } from './i18n'
import type { ArcadeProps, PauseReason } from '../types'

const REASON_TEXT: Record<Exclude<PauseReason, ''>, TextKey> = {
  idle: 'pause.idle',
  done: 'pause.done',
  asking: 'pause.asking',
  permission: 'pause.permission',
}

type Tr = (key: TextKey, params?: Record<string, string | number>) => string

const Arcade: ClientModule<ArcadeProps, Host> = (props, surface) => {
  const { Text } = surface.elements
  const glyphs = GLYPHS[props.glyphs]
  const tr: Tr = (key, params) => withSep(t(props.locale, key, params), glyphs)
  const s = surface.state

  if (!s) {
    surface.setState(newHost(props))
    surface.every(FRAME_MS, () => {
      const cur = surface.state
      if (!cur) return
      const out = frameTick(cur, surface.columns)
      if (out.report) surface.post(out.report)
      if (out.changed) surface.setState({ ...cur })
    })
    surface.every(CHECKPOINT_MS, () => {
      const record = surface.state && checkpoint(surface.state)
      if (record) surface.post(record)
    })
    surface.onKey(k => {
      const cur = surface.state
      const cmd = commandFor(k)
      if (!cur || !cmd) return
      const out = handle(cur, cmd, surface.columns, surface.rows)
      if (out.report) surface.post(out.report)
      if (out.changed) surface.setState({ ...cur })
    })
    return <Text dimColor>{tr('loading')}</Text>
  }

  // New props from the hooks module reach the running loop through here.
  s.props = props

  if (!s.run) return drawMenu(s, surface.columns, glyphs, tr, surface.elements)
  if (!fits(s.run, surface.columns)) return drawTooSmall(s.run, glyphs, tr, surface.elements)
  return drawGame(s, s.run, glyphs, tr, surface.elements)
}

function pauseLine(s: Host, glyphs: Glyphs, tr: Tr): string | undefined {
  if (s.props.isPaused && s.props.reason) return `${glyphs.pause}  ${tr(REASON_TEXT[s.props.reason])}`
  if (s.isManuallyPaused) return `${glyphs.pause}  ${tr('pause.manual')}`
  return undefined
}

// The menu's own colors: one per letter of the title, the chosen game and
// the bar it stands on.
const TITLE_COLORS = ['#ff5f5f', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#b388ff']
const CHOSEN_COLOR = '#ffd93d'
const CHOSEN_BG = '#2b2f45'
// A game's sign in the menu, in cells.
const SIGN_W = 2

function drawMenu(s: Host, columns: number, glyphs: Glyphs, tr: Tr, { Box, Text }: ClientElements) {
  const line = pauseLine(s, glyphs, tr)
  const names = GAMES.map(def => tr(def.name))
  const bests = GAMES.map(def => {
    const n = s.props.best[def.id] ?? 0
    return n > 0 ? tr('menu.best', { n }) : ''
  })
  const nameW = Math.max(...names.map(textWidth))
  const bestW = Math.max(...bests.map(textWidth))

  // The title in large letters, a cell of air between them.
  const titleRows = (glyphs.logo[0] ?? []).map((_, row) => glyphs.logo.map(letter => letter[row] ?? ''))
  const titleW = textWidth((titleRows[0] ?? []).join(' '))

  // A row: pointer, sign, name, and the record at the right edge. The list
  // is as wide as its longest row, and never narrower than the title.
  const rowW = 2 + SIGN_W + 1 + nameW + (bestW > 0 ? 2 + bestW : 0)
  const innerW = Math.max(rowW, titleW)
  const nameCol = innerW - (2 + SIGN_W + 1) - bestW
  // Border and padding on both sides; a pane not laid out yet has no columns.
  const boxW = innerW + 4
  const width = columns > 0 ? Math.min(boxW, columns) : boxW
  const chosen = GAMES[s.selected]

  return (
    <Box flexDirection="column">
      {titleRows.map(letters => (
        <Box flexDirection="row" justifyContent="center" width={width}>
          <Text bold wrap="truncate">
            {letters.map((letter, i) => (
              <Text color={TITLE_COLORS[i % TITLE_COLORS.length]}>
                {i > 0 ? ' ' : ''}
                {letter}
              </Text>
            ))}
          </Text>
        </Box>
      ))}
      <Box flexDirection="column" borderStyle={glyphs.border} borderDimColor paddingX={1} width={width}>
        {GAMES.map((def, i) => {
          const isSelected = i === s.selected
          const best = bests[i] ?? ''
          return [
            // A line of air between two games, so their signs do not run together.
            i > 0 ? <Text> </Text> : null,
            <Text backgroundColor={isSelected ? CHOSEN_BG : undefined} wrap="truncate">
              <Text color={CHOSEN_COLOR}>{isSelected ? glyphs.pointer : ' '} </Text>
              {def.sign(glyphs).map(seg => (
                <Text color={seg.color} backgroundColor={seg.bg}>
                  {seg.text}
                </Text>
              ))}
              <Text color={isSelected ? CHOSEN_COLOR : undefined} bold={isSelected}>
                {' '}
                {padTo(names[i] ?? '', nameCol)}
              </Text>
              <Text color={isSelected ? CHOSEN_COLOR : undefined} dimColor={!isSelected}>
                {' '.repeat(bestW - textWidth(best))}
                {best}
              </Text>
            </Text>,
          ]
        })}
      </Box>
      <Text wrap="truncate">
        {' '}
        {chosen ? tr(chosen.blurb) : ''}
      </Text>
      <Text dimColor wrap="truncate">
        {' '}
        {tr('menu.hint')}
      </Text>
      {line ? <Text color="#ffd93d"> {line}</Text> : null}
    </Box>
  )
}

// The pane is narrower than the field: say so instead of drawing half a game.
function drawTooSmall(run: Running, glyphs: Glyphs, tr: Tr, { Box, Text }: ClientElements) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{tr(run.def.name)}</Text>
      <Text wrap="wrap">
        {glyphs.pause} {tr('tooSmall')}
      </Text>
      <Text dimColor wrap="wrap">
        {tr('help.small')}
      </Text>
    </Box>
  )
}

function drawGame(s: Host, run: Running, glyphs: Glyphs, tr: Tr, { Box, Text }: ClientElements) {
  const { def, g } = run
  const rows: Frame = def.frame(g, glyphs)
  const w = rows[0]?.reduce((n, seg) => n + textWidth(seg.text), 0) ?? def.minW
  const hud = def.hud(g)
  const best = Math.max(s.props.best[def.id] ?? 0, hud.score)

  // Under the field, not over it: the line may be longer than a small field
  // is wide, and the field keeps every row it drew.
  const own = def.banner(g)
  const line = own ?? (def.status(g) === 'over' ? 'over' : undefined)
  const banner = pauseLine(s, glyphs, tr) ?? (line ? tr(line, { n: hud.score }) : '')
  const isDim = s.props.isPaused || s.isManuallyPaused

  const lives =
    hud.lives === undefined
      ? ''
      : glyphs.life.repeat(Math.max(0, hud.lives)) +
        glyphs.lifeLost.repeat(Math.max(0, (hud.maxLives ?? hud.lives) - hud.lives))
  const right = [
    hud.extra ? tr(hud.extra.key, { n: hud.extra.n }) : '',
    hud.level === undefined ? '' : tr('hud.level', { n: hud.level }),
    tr('hud.best', { n: best }),
  ]
    .filter(Boolean)
    .join('  ')
  // A game's help may name its glyphs, as `{bull}` does.
  const glyphNames = glyphs as unknown as Record<string, string>
  const help = s.props.isPaused ? tr('help.paused') : `${tr(def.help, glyphNames)} ${glyphs.sep} ${tr('help.common')}`
  const score = tr('hud.score', { n: hud.score })
  // As wide as the field, or wider when a narrow game's score line needs it.
  const hudW = Math.max(w + 2, textWidth(score) + textWidth(lives) + textWidth(right) + 6)

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" width={hudW}>
        <Text bold> {score}</Text>
        <Text color="#ff5f5f">{lives}</Text>
        <Text dimColor>{right} </Text>
      </Box>
      <Box flexDirection="column" borderStyle={glyphs.border} borderDimColor width={w + 2}>
        {rows.map(row => (
          <Text dimColor={isDim} wrap="truncate">
            {row.map(seg =>
              seg.color || seg.bg ? (
                <Text color={seg.color} backgroundColor={seg.bg}>
                  {seg.text}
                </Text>
              ) : (
                seg.text
              ),
            )}
          </Text>
        ))}
      </Box>
      <Text bold wrap="wrap">
        {' '}
        {banner}
      </Text>
      <Text dimColor wrap="wrap">
        {' '}
        {help}
      </Text>
    </Box>
  )
}

export default Arcade
