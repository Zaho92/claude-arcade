// Lamps as pure logic: a board of lamps, some of them lit. Pressing a lamp
// switches it and the four next to it (above, below, left, right). All dark
// wins the board and leads to the next level, which starts with more presses
// to undo. Every board is made by pressing lamps on a dark board, so it can
// always be solved. No clock: it moves on keys alone. Each lamp is four
// terminal columns wide; the cursor is drawn in brackets, so it shows without
// colors too.

import type { Glyphs } from '../glyphs'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Lamps = {
  /** Field size in terminal cells. */
  w: number
  h: number
  /** True is lit, row-major, SIZE × SIZE. */
  lit: boolean[]
  cursor: { x: number; y: number }
  level: number
  score: number
  /** Presses on this board so far. */
  presses: number
  /** The presses the board was made with: a solution that long exists. */
  par: number
  /** The board just solved is still announced until the next key. */
  isSolved: boolean
  random: () => number
}

export const SIZE = 5
const LAMP_W = 4
export const FIELD_W = SIZE * LAMP_W + (SIZE - 1)
export const FIELD_H = SIZE * 2 - 1
const FIRST_PRESSES = 3
const MAX_PRESSES = 12
const BASE_POINTS = 60
const POINTS_PER_PAR = 20
const POINTS_PER_PRESS = 10
const MIN_POINTS = 10

const LIT_BG = '#6b4e00'
const LIT_MARK = '#ffe066'
const DARK_BG = '#23273a'
const DARK_MARK = '#5a6185'
const CURSOR_COLOR = '#ffffff'

/** How many presses a level's board is made with. */
export function pressesFor(level: number): number {
  return Math.min(MAX_PRESSES, FIRST_PRESSES + level - 1)
}

/** What a board solved in `presses` presses earns: fewer is more. */
export function pointsFor(par: number, presses: number): number {
  return Math.max(MIN_POINTS, BASE_POINTS + POINTS_PER_PAR * par - POINTS_PER_PRESS * presses)
}

/** Switches the lamp at (x, y) and the four next to it. */
export function flip(lit: boolean[], x: number, y: number): void {
  for (const [dx, dy] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const nx = x + dx
    const ny = y + dy
    if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE) lit[ny * SIZE + nx] = !lit[ny * SIZE + nx]
  }
}

/** A solvable board for the level: `pressesFor(level)` different lamps pressed on a dark one, never all dark. */
export function board(level: number, random: () => number): { lit: boolean[]; par: number } {
  const par = pressesFor(level)
  for (;;) {
    const lit = Array.from({ length: SIZE * SIZE }, () => false)
    const cells = Array.from({ length: SIZE * SIZE }, (_, i) => i)
    for (let k = 0; k < par; k++) {
      const pick = k + Math.floor(random() * (cells.length - k))
      const tmp = cells[k]!
      cells[k] = cells[pick]!
      cells[pick] = tmp
      flip(lit, cells[k]! % SIZE, Math.floor(cells[k]! / SIZE))
    }
    // Some sets of presses cancel out; try again rather than start won.
    if (lit.some(Boolean)) return { lit, par }
  }
}

export function newLamps(random: () => number = Math.random): Lamps {
  const first = board(1, random)
  return {
    w: FIELD_W,
    h: FIELD_H,
    lit: first.lit,
    cursor: { x: Math.floor(SIZE / 2), y: Math.floor(SIZE / 2) },
    level: 1,
    score: 0,
    presses: 0,
    par: first.par,
    isSolved: false,
    random,
  }
}

export function press(g: Lamps, action: Action): boolean {
  if (action === 'secondary') return false
  const c = g.cursor
  g.isSolved = false
  switch (action) {
    case 'left':
      c.x = (c.x + SIZE - 1) % SIZE
      return true
    case 'right':
      c.x = (c.x + 1) % SIZE
      return true
    case 'up':
      c.y = (c.y + SIZE - 1) % SIZE
      return true
    case 'down':
      c.y = (c.y + 1) % SIZE
      return true
    case 'primary': {
      flip(g.lit, c.x, c.y)
      g.presses++
      if (!g.lit.some(Boolean)) {
        g.score += pointsFor(g.par, g.presses)
        g.level++
        const next = board(g.level, g.random)
        g.lit = next.lit
        g.par = next.par
        g.presses = 0
        g.isSolved = true
      }
      return true
    }
  }
}

export function frame(g: Lamps, glyphs: Glyphs): Frame {
  const rows: Frame = []
  for (let y = 0; y < SIZE; y++) {
    const cells: Segment[] = []
    for (let x = 0; x < SIZE; x++) {
      if (x > 0) cells.push({ text: ' ' })
      const isLit = g.lit[y * SIZE + x] === true
      const mark = isLit ? glyphs.lampOn : glyphs.lampOff
      const isCursor = g.cursor.x === x && g.cursor.y === y
      const text = isCursor ? `${glyphs.cursorLeft}${mark}${glyphs.cursorRight}` : ` ${mark} `
      cells.push({ text, color: isCursor ? CURSOR_COLOR : isLit ? LIT_MARK : DARK_MARK, bg: isLit ? LIT_BG : DARK_BG })
    }
    rows.push(cells)
    if (y < SIZE - 1) rows.push([{ text: ' '.repeat(FIELD_W) }])
  }
  return rows
}

export const lamps: GameDef<Lamps> = {
  id: 'lamps',
  name: 'lamps.name',
  blurb: 'lamps.blurb',
  help: 'lamps.help',
  sign: glyphs => [{ text: glyphs.lampOn, color: LIT_MARK }],
  tickMs: 0,
  minW: FIELD_W,
  minH: FIELD_H,
  maxW: FIELD_W,
  maxH: FIELD_H,
  create: () => newLamps(),
  key: press,
  tick: (): TickResult => 'none',
  status: (): Status => 'play',
  hud: g => ({ score: g.score, level: g.level, extra: { key: 'hud.presses', n: g.presses } }),
  frame,
  banner: g => (g.isSolved ? 'lamps.solved' : undefined),
}
