// The surface module: runs on the drawing thread, owns the game loop, the
// keys and the frame. The hooks module only tells it whether Claude is
// working (props.isPaused) and keeps the high score.

import type { ClientModule } from 'claude-code'

import { frame, newGame, press, tick, MIN_H, MIN_W, START_LIVES } from './breakout-game'
import type { Game, Segment } from './breakout-game'
import type { BreakoutProps } from '../types'

type Local = {
  game?: Game
  props: BreakoutProps
  isReported: boolean
}

const FRAME_MS = 33
const MAX_W = 72
// Border (2) plus the score line and the help line.
const CHROME_ROWS = 4

function fieldSize(columns: number, rows: number): { w: number; h: number } {
  return {
    w: Math.min(MAX_W, Math.max(MIN_W, columns - 2)),
    h: Math.max(MIN_H, rows - CHROME_ROWS),
  }
}

function centered(text: string, width: number): string {
  const pad = Math.max(0, Math.floor((width - text.length) / 2))
  return (' '.repeat(pad) + text).padEnd(width).slice(0, width)
}

const Breakout: ClientModule<BreakoutProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  const s = surface.state

  if (!s) {
    const local: Local = { props, isReported: false }
    surface.setState(local)
    surface.every(FRAME_MS, () => {
      const cur = surface.state
      if (!cur) return
      if (!cur.game) {
        if (surface.columns <= 0) return
        const { w, h } = fieldSize(surface.columns, surface.rows)
        surface.setState({ ...cur, game: newGame(w, h) })
        return
      }
      if (cur.props.isPaused) return
      const result = tick(cur.game)
      if (result === 'none') return
      if (result === 'over' && !cur.isReported) {
        surface.post({ type: 'over', score: cur.game.score })
        surface.setState({ ...cur, isReported: true })
        return
      }
      surface.setState({ ...cur })
    })
    surface.onKey(k => {
      const cur = surface.state
      if (!cur?.game || cur.props.isPaused) return
      const wasOver = cur.game.phase === 'over'
      if (!press(cur.game, k)) return
      surface.setState({ ...cur, isReported: wasOver && cur.game.phase !== 'over' ? false : cur.isReported })
    })
    return <Text dimColor>Breakout lädt …</Text>
  }

  // New props from the hooks module reach the running loop through here.
  s.props = props

  const g = s.game
  if (!g) return <Text dimColor>Breakout lädt …</Text>

  const rows = frame(g)
  const banner = bannerFor(g, props)
  if (banner) {
    const mid = Math.floor(g.h / 2)
    rows[mid] = [{ text: centered(banner, g.w), color: '#ffffff' }]
  }
  const isDim = props.isPaused || g.isManuallyPaused

  const hearts = '♥'.repeat(Math.max(0, g.lives)) + '·'.repeat(Math.max(0, START_LIVES - g.lives))
  const best = Math.max(props.best, g.score)

  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" width={g.w + 2}>
        <Text bold> Punkte {g.score}</Text>
        <Text color="#ff5f5f">{hearts}</Text>
        <Text dimColor>Level {g.level}  Rekord {best} </Text>
      </Box>
      <Box flexDirection="column" borderStyle="round" borderDimColor width={g.w + 2}>
        {rows.map(row => (
          <Text dimColor={isDim} wrap="truncate">
            {row.map((seg: Segment) => (seg.color ? <Text color={seg.color}>{seg.text}</Text> : seg.text))}
          </Text>
        ))}
      </Box>
      <Text dimColor wrap="truncate">
        {props.isPaused
          ? ' Esc: zurück zur Eingabe'
          : ' ←/→ bewegen · Leertaste starten · P Pause · Esc zur Eingabe'}
      </Text>
    </Box>
  )
}

function bannerFor(g: Game, props: BreakoutProps): string | undefined {
  if (props.isPaused) return props.reason || '⏸  Pause: Claude wartet auf dich'
  if (g.isManuallyPaused) return '⏸  Pause (P)'
  if (g.phase === 'over') return `Game over · ${g.score} Punkte · Leertaste`
  if (g.phase === 'ready') return g.score === 0 && g.level === 1 ? 'Leertaste: Ball los' : 'Leertaste: weiter'
  return undefined
}

export default Breakout
