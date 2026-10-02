// Merge as pure logic: slide the tiles, equal neighbours merge once per move,
// a new tile comes after every move that changed something. No clock: it
// moves on keys alone, so pausing mid-game never costs anything.

import { padTo, textWidth } from '../glyphs'
import type { Glyphs } from '../glyphs'
import type { Action, Dir, Frame, GameDef, Segment, TickResult } from './types'

export type Phase = 'play' | 'over'

export type Merge = {
  /** Field size in terminal cells. */
  w: number
  h: number
  /** 0 is an empty cell, row-major, SIZE × SIZE. */
  grid: number[]
  score: number
  phase: Phase
  /** Set by the move that first reached GOAL, cleared by the next. */
  isJustWon: boolean
  hasWon: boolean
  random: () => number
}

export const SIZE = 4
export const GOAL = 2048
const TILE_W = 6
const TILE_H = 3
export const FIELD_W = SIZE * TILE_W + (SIZE + 1)
export const FIELD_H = SIZE * TILE_H + (SIZE + 1)

// Background per tile: our own cool-to-warm ramp, from pale blue through
// violet and rose to gold.
const TILE_BG: Record<number, string> = {
  0: '#2b2f45',
  2: '#dfe7fd',
  4: '#c5d3fa',
  8: '#9db4f5',
  16: '#7b8cf0',
  32: '#8a6be8',
  64: '#a855d6',
  128: '#c94fb8',
  256: '#e0529a',
  512: '#ef6a6a',
  1024: '#f4a259',
  2048: '#f6d55c',
}
const BIG_BG = '#2ec4b6'
const DARK_TEXT = '#1d2440'
const LIGHT_TEXT = '#ffffff'
const GAP_BG = '#1b1d2e'
// Tiles light enough for dark numbers.
const DARK_ON = new Set([2, 4, 8, 1024, 2048])

function at(g: Merge, x: number, y: number): number {
  return g.grid[y * SIZE + x] ?? 0
}

function spawn(g: Merge): void {
  const free: number[] = []
  g.grid.forEach((v, i) => {
    if (v === 0) free.push(i)
  })
  if (free.length === 0) return
  const i = free[Math.floor(g.random() * free.length)] ?? free[0] ?? 0
  g.grid[i] = g.random() < 0.9 ? 2 : 4
}

export function newMerge(_w: number, _h: number, random: () => number = Math.random): Merge {
  const g: Merge = {
    w: FIELD_W,
    h: FIELD_H,
    grid: Array<number>(SIZE * SIZE).fill(0),
    score: 0,
    phase: 'play',
    isJustWon: false,
    hasWon: false,
    random,
  }
  spawn(g)
  spawn(g)
  return g
}

/** Slides one line toward its start; returns the new line and the points it made. */
export function slideLine(line: readonly number[]): { line: number[]; points: number } {
  const tiles = line.filter(v => v !== 0)
  const out: number[] = []
  let points = 0
  for (let i = 0; i < tiles.length; i++) {
    const v = tiles[i] ?? 0
    if (v === tiles[i + 1]) {
      out.push(v * 2)
      points += v * 2
      i++
    } else {
      out.push(v)
    }
  }
  while (out.length < line.length) out.push(0)
  return { line: out, points }
}

/** The cell indices of each line, ordered toward where the tiles slide. */
function lines(dir: Dir): number[][] {
  const result: number[][] = []
  for (let a = 0; a < SIZE; a++) {
    const line: number[] = []
    for (let b = 0; b < SIZE; b++) {
      if (dir === 'left') line.push(a * SIZE + b)
      else if (dir === 'right') line.push(a * SIZE + (SIZE - 1 - b))
      else if (dir === 'up') line.push(b * SIZE + a)
      else line.push((SIZE - 1 - b) * SIZE + a)
    }
    result.push(line)
  }
  return result
}

/** Slides the whole grid; true when anything moved. */
export function slide(g: Merge, dir: Dir): boolean {
  let moved = false
  for (const idx of lines(dir)) {
    const before = idx.map(i => g.grid[i] ?? 0)
    const { line, points } = slideLine(before)
    g.score += points
    idx.forEach((i, k) => {
      const v = line[k] ?? 0
      if (g.grid[i] !== v) moved = true
      g.grid[i] = v
    })
  }
  return moved
}

export function canMove(g: Merge): boolean {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = at(g, x, y)
      if (v === 0) return true
      if (x + 1 < SIZE && at(g, x + 1, y) === v) return true
      if (y + 1 < SIZE && at(g, x, y + 1) === v) return true
    }
  }
  return false
}

export function press(g: Merge, action: Action): boolean {
  if (g.phase === 'over' || action === 'primary' || action === 'secondary') return false
  // The note about the goal goes with the next key, moved or not.
  const hadNote = g.isJustWon
  g.isJustWon = false
  if (!slide(g, action)) return hadNote
  spawn(g)
  if (!g.hasWon && g.grid.some(v => v >= GOAL)) {
    g.hasWon = true
    g.isJustWon = true
  }
  if (!canMove(g)) g.phase = 'over'
  return true
}

function tileText(v: number): string {
  if (v === 0) return ' '.repeat(TILE_W)
  const s = String(v)
  const left = Math.floor((TILE_W - textWidth(s)) / 2)
  return padTo(' '.repeat(left) + s, TILE_W)
}

export function frame(g: Merge, glyphs: Glyphs): Frame {
  const rows: Frame = []
  const gap: Segment = { text: glyphs.empty, bg: GAP_BG }
  const gapRow = (): Segment[] => [{ text: glyphs.empty.repeat(FIELD_W), bg: GAP_BG }]
  rows.push(gapRow())
  for (let y = 0; y < SIZE; y++) {
    for (let line = 0; line < TILE_H; line++) {
      const cells: Segment[] = [{ ...gap }]
      for (let x = 0; x < SIZE; x++) {
        const v = at(g, x, y)
        const bg = TILE_BG[v] ?? BIG_BG
        const color = DARK_ON.has(v) || v > GOAL ? DARK_TEXT : LIGHT_TEXT
        cells.push({ text: line === 1 ? tileText(v) : ' '.repeat(TILE_W), color, bg })
        cells.push({ ...gap })
      }
      rows.push(cells)
    }
    rows.push(gapRow())
  }
  return rows
}

export const merge: GameDef<Merge> = {
  id: 'merge',
  name: 'merge.name',
  blurb: 'merge.blurb',
  help: 'merge.help',
  tickMs: 0,
  minW: FIELD_W,
  minH: FIELD_H,
  maxW: FIELD_W,
  maxH: FIELD_H,
  create: (w, h) => newMerge(w, h),
  key: press,
  tick: (): TickResult => 'none',
  status: g => g.phase,
  hud: g => ({ score: g.score }),
  frame,
  // A move that reaches the goal and leaves no other is the end, not a note to play on.
  banner: g => (g.isJustWon && g.phase !== 'over' ? 'merge.won' : undefined),
}
