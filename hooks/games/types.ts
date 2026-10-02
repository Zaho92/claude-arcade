// What every game gives the arcade: pure logic over a field of cells. The
// host (arcade.tsx) owns keys, clock, pause, menu and drawing.

import type { Glyphs } from '../glyphs'
import type { TextKey } from '../i18n'

/** A key, already mapped from whatever layout typed it. */
export type Action = 'left' | 'right' | 'up' | 'down' | 'primary'

/** A run of cells in one color; `color` absent is the terminal's default. */
export type Segment = { text: string; color?: string }

/** The field, one array of runs per row, every row exactly `w` cells wide. */
export type Frame = Segment[][]

export type Status = 'ready' | 'play' | 'over'

export type Hud = {
  score: number
  level?: number
  lines?: number
  lives?: number
  maxLives?: number
}

export type TickResult = 'none' | 'changed' | 'over'

// Methods, not function-typed fields: a GameDef<Game> then stands in the
// GameDef list the host holds, whose games' states it never looks into.
export type GameDef<G = unknown> = {
  id: string
  /** The name in the menu and the high-score table. */
  name: TextKey
  /** One line under the name in the menu. */
  blurb: TextKey
  /** The game's own keys, shown under the field ("←/→ move · Space launch"). */
  help: TextKey
  /** How often `tick` runs, in milliseconds; 0 for a game that only moves on keys. */
  tickMs: number
  /** The smallest field the game can be played on. */
  minW: number
  minH: number
  /** The largest field worth drawing; a wider pane centers it. */
  maxW: number
  maxH: number
  create(w: number, h: number): G
  key(g: G, action: Action): boolean
  tick(g: G): TickResult
  status(g: G): Status
  hud(g: G): Hud
  frame(g: G, glyphs: Glyphs): Frame
  /** A line over the middle of the field while waiting, e.g. "Space: start". */
  banner(g: G): TextKey | undefined
}
