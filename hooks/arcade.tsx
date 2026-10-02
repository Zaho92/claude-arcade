// The surface module: runs on the drawing thread and hosts the menu and the
// games. The rules live in host.ts; this file wires keys and the frame clock
// to them and draws. The hooks module tells it whether Claude is working, in
// which language to speak and which glyphs to use, and keeps the high scores.

import type { ClientElements, ClientModule } from 'claude-code'

import { GAMES } from './games'
import type { Frame } from './games/types'
import { GLYPHS, center, textWidth } from './glyphs'
import type { Glyphs } from './glyphs'
import { FRAME_MS, commandFor, frameTick, handle, newHost } from './host'
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
  const tr: Tr = (key, params) => t(props.locale, key, params)
  const s = surface.state

  if (!s) {
    surface.setState(newHost(props))
    surface.every(FRAME_MS, () => {
      const cur = surface.state
      if (!cur) return
      const out = frameTick(cur)
      if (out.report) surface.post(out.report)
      if (out.changed) surface.setState({ ...cur })
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
  const glyphs = GLYPHS[props.glyphs]

  return s.run ? drawGame(s, s.run, glyphs, tr, surface.elements) : drawMenu(s, glyphs, tr, surface.elements)
}

function pauseLine(s: Host, glyphs: Glyphs, tr: Tr): string | undefined {
  if (s.props.isPaused && s.props.reason) return `${glyphs.pause}  ${tr(REASON_TEXT[s.props.reason])}`
  if (s.isManuallyPaused) return `${glyphs.pause}  ${tr('pause.manual')}`
  return undefined
}

function drawMenu(s: Host, glyphs: Glyphs, tr: Tr, { Box, Text }: ClientElements) {
  const line = pauseLine(s, glyphs, tr)
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold>{tr('title')}</Text>
      <Text> </Text>
      {GAMES.map((def, i) => {
        const isSelected = i === s.selected
        const best = s.props.best[def.id] ?? 0
        return (
          <Box flexDirection="row" key={def.id}>
            <Text color={isSelected ? '#ffd93d' : undefined} bold={isSelected}>
              {isSelected ? glyphs.pointer : ' '} {tr(def.name)}
            </Text>
            <Text dimColor wrap="truncate">
              {'   '}
              {tr(def.blurb)}
              {best > 0 ? `  ·  ${tr('menu.best', { n: best })}` : ''}
            </Text>
          </Box>
        )
      })}
      <Text> </Text>
      <Text dimColor wrap="truncate">
        {tr('menu.hint')}
      </Text>
      {line ? <Text color="#ffd93d">{line}</Text> : null}
    </Box>
  )
}

function drawGame(s: Host, run: Running, glyphs: Glyphs, tr: Tr, { Box, Text }: ClientElements) {
  const { def, g } = run
  const rows: Frame = def.frame(g, glyphs)
  const w = rows[0]?.reduce((n, seg) => n + textWidth(seg.text), 0) ?? def.minW
  const hud = def.hud(g)
  const best = Math.max(s.props.best[def.id] ?? 0, hud.score)

  const waiting = def.banner(g)
  const banner =
    pauseLine(s, glyphs, tr) ?? (def.status(g) === 'over' ? tr('over', { n: hud.score }) : waiting ? tr(waiting) : undefined)
  if (banner) rows[Math.floor(rows.length / 2)] = [{ text: center(banner, w), color: '#ffffff' }]
  const isDim = s.props.isPaused || s.isManuallyPaused

  const lives =
    hud.lives === undefined
      ? ''
      : glyphs.life.repeat(Math.max(0, hud.lives)) +
        glyphs.lifeLost.repeat(Math.max(0, (hud.maxLives ?? hud.lives) - hud.lives))
  const right = [
    hud.lines === undefined ? '' : tr('hud.lines', { n: hud.lines }),
    hud.level === undefined ? '' : tr('hud.level', { n: hud.level }),
    tr('hud.best', { n: best }),
  ]
    .filter(Boolean)
    .join('  ')
  const help = s.props.isPaused ? tr('help.paused') : `${tr(def.help)} · ${tr('help.common')}`
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
            {row.map(seg => (seg.color ? <Text color={seg.color}>{seg.text}</Text> : seg.text))}
          </Text>
        ))}
      </Box>
      <Text dimColor wrap="wrap">
        {' '}
        {help}
      </Text>
    </Box>
  )
}

export default Arcade
