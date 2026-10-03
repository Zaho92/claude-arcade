// Fifteen as pure logic, the sliding puzzle from around 1880: fifteen numbered
// tiles and one gap in a 4 × 4 tray. An arrow slides the tile on the far side
// of the gap in that direction, into the gap. The tiles read 1 to 15 with the
// gap in the last corner when it is solved. No clock: it moves on keys alone,
// so pausing mid-game never costs anything.

import { padTo, textWidth } from '../glyphs'
import type { Glyphs } from '../glyphs'
import type { Action, Dir, Frame, GameDef, Segment, TickResult } from './types'

export type Fifteen = {
  /** Field size in terminal cells. */
  w: number
  h: number
  /** Row-major, SIZE × SIZE; 0 is the gap. */
  grid: number[]
  moves: number
  phase: 'play' | 'over'
  isWon: boolean
}

export const SIZE = 4
const TILE_W = 6
const TILE_H = 3
export const FIELD_W = SIZE * TILE_W + (SIZE + 1)
export const FIELD_H = SIZE * TILE_H + (SIZE + 1)
/** How many slides the shuffle makes from the solved tray. */
const SHUFFLE_STEPS = 200
const SCORE_BASE = 1000
const SCORE_PER_MOVE = 2
const SCORE_MIN = 10

// Our own colors: warm sand for a tile still on its way, green for one in its place.
const TILE_BG = '#e7c27d'
const PLACED_BG = '#4fb286'
const TILE_TEXT = '#2b2410'
const PLACED_TEXT = '#0d2a1d'
const GAP_BG = '#1b1d2e'

export function solved(): number[] {
  return Array.from({ length: SIZE * SIZE }, (_, i) => (i + 1) % (SIZE * SIZE))
}

export function isSolved(grid: readonly number[]): boolean {
  return grid.every((v, i) => v === (i + 1) % (SIZE * SIZE))
}

/** The cell of the tile that moves in `dir` into the gap; undefined when the gap is at that edge. */
function source(gap: number, dir: Dir): number | undefined {
  const x = gap % SIZE
  const y = Math.floor(gap / SIZE)
  if (dir === 'left') return x + 1 < SIZE ? gap + 1 : undefined
  if (dir === 'right') return x > 0 ? gap - 1 : undefined
  if (dir === 'up') return y + 1 < SIZE ? gap + SIZE : undefined
  return y > 0 ? gap - SIZE : undefined
}

/** Slides one tile in `dir` into the gap; false when there is no tile on that side. */
export function slide(grid: number[], dir: Dir): boolean {
  const gap = grid.indexOf(0)
  const from = source(gap, dir)
  if (from === undefined) return false
  grid[gap] = grid[from] ?? 0
  grid[from] = 0
  return true
}

const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' }
const DIRS: readonly Dir[] = ['left', 'right', 'up', 'down']

/** Shuffles by sliding from the solved tray, so it can always be solved; never ends solved. */
export function shuffle(random: () => number): number[] {
  for (let attempt = 0; ; attempt++) {
    const grid = solved()
    let last: Dir | undefined
    for (let i = 0; i < SHUFFLE_STEPS; i++) {
      const gap = grid.indexOf(0)
      const options = DIRS.filter(d => d !== (last && OPPOSITE[last]) && source(gap, d) !== undefined)
      const dir = options[Math.min(options.length - 1, Math.floor(random() * options.length))]
      if (!dir) break
      slide(grid, dir)
      last = dir
    }
    // A walk that comes home is vanishingly rare; a stuck random function must not hang the pane.
    if (!isSolved(grid) || attempt > 100) return isSolved(grid) ? solvedOneOff() : grid
  }
}

/** Fallback: the solved tray with one slide made. */
function solvedOneOff(): number[] {
  const grid = solved()
  slide(grid, 'right')
  return grid
}

export function newFifteen(_w: number, _h: number, random: () => number = Math.random): Fifteen {
  return { w: FIELD_W, h: FIELD_H, grid: shuffle(random), moves: 0, phase: 'play', isWon: false }
}

/** Fewer moves, higher score; nothing until the tray is solved. */
export function score(g: Fifteen): number {
  return g.isWon ? Math.max(SCORE_MIN, SCORE_BASE - g.moves * SCORE_PER_MOVE) : 0
}

export function press(g: Fifteen, action: Action): boolean {
  if (g.phase === 'over' || action === 'primary' || action === 'secondary') return false
  if (!slide(g.grid, action)) return false
  g.moves++
  if (isSolved(g.grid)) {
    g.isWon = true
    g.phase = 'over'
  }
  return true
}

function tileText(v: number): string {
  const s = String(v)
  const left = Math.floor((TILE_W - textWidth(s)) / 2)
  return padTo(' '.repeat(left) + s, TILE_W)
}

export function frame(g: Fifteen, glyphs: Glyphs): Frame {
  const rows: Frame = []
  const gap: Segment = { text: glyphs.empty, bg: GAP_BG }
  const gapRow = (): Segment[] => [{ text: glyphs.empty.repeat(FIELD_W), bg: GAP_BG }]
  rows.push(gapRow())
  for (let y = 0; y < SIZE; y++) {
    for (let line = 0; line < TILE_H; line++) {
      const cells: Segment[] = [{ ...gap }]
      for (let x = 0; x < SIZE; x++) {
        const v = g.grid[y * SIZE + x] ?? 0
        if (v === 0) {
          cells.push({ text: glyphs.empty.repeat(TILE_W), bg: GAP_BG })
        } else {
          const isPlaced = v === y * SIZE + x + 1
          cells.push({
            text: line === 1 ? tileText(v) : ' '.repeat(TILE_W),
            color: isPlaced ? PLACED_TEXT : TILE_TEXT,
            bg: isPlaced ? PLACED_BG : TILE_BG,
          })
        }
        cells.push({ ...gap })
      }
      rows.push(cells)
    }
    rows.push(gapRow())
  }
  return rows
}

export const fifteen: GameDef<Fifteen> = {
  id: 'fifteen',
  name: 'fifteen.name',
  blurb: 'fifteen.blurb',
  help: 'fifteen.help',
  sign: glyphs => [{ text: glyphs.empty, bg: TILE_BG }, { text: glyphs.empty, bg: PLACED_BG }],
  tickMs: 0,
  minW: FIELD_W,
  minH: FIELD_H,
  maxW: FIELD_W,
  maxH: FIELD_H,
  create: (w, h) => newFifteen(w, h),
  key: press,
  tick: (): TickResult => 'none',
  status: g => g.phase,
  hud: g => ({ score: score(g), extra: { key: 'hud.moves', n: g.moves } }),
  frame,
  banner: g => (g.isWon ? 'fifteen.won' : undefined),
}
