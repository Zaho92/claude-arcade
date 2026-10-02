// What every game gives the arcade: pure logic over a field of cells. The
// host (arcade.tsx) owns keys, clock, pause, menu and drawing.

import type { Glyphs } from '../glyphs'
import type { TextKey } from '../i18n'

/** A key, already mapped from whatever layout typed it. */
export type Action = 'left' | 'right' | 'up' | 'down' | 'primary' | 'secondary'

/** The four ways a game moves. */
export type Dir = 'left' | 'right' | 'up' | 'down'

/** A run of cells in one color; absent colors are the terminal's default. */
export type Segment = { text: string; color?: string; bg?: string }

/** The field, one array of runs per row, every row exactly `w` cells wide. */
export type Frame = Segment[][]

export type Status = 'ready' | 'play' | 'over'

/** Adds text to a row, joined to the run before it when the color is the same. */
export function put(cells: Segment[], text: string, color?: string): void {
  const last = cells[cells.length - 1]
  if (last && last.color === color && last.bg === undefined) last.text += text
  else cells.push({ text, color })
}

export type Hud = {
  score: number
  /** A game's own counter in the score line, e.g. mines left. */
  extra?: { key: TextKey; n: number }
  level?: number
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
  /**
   * A line under the field: while waiting ("Space: start"), or the game's
   * own ending ("All clear! {n} points"); `{n}` is the score. Left undefined
   * at the end, the arcade shows its usual game-over line.
   */
  banner(g: G): TextKey | undefined
}
