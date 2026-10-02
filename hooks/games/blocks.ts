// Falling blocks as pure logic: a 10-wide well, the seven pieces from a
// shuffled bag, rotation with wall kicks, a landing preview and the next
// piece beside the well. Cells are two terminal columns wide.

import type { Glyphs } from '../glyphs'
import type { Action, Frame, GameDef, Segment, TickResult } from './types'

export type Kind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L'
export type Cell = { x: number; y: number }
export type Phase = 'ready' | 'play' | 'over'

export type Piece = { kind: Kind; cells: Cell[]; size: number; x: number; y: number }

export type Blocks = {
  /** Field size in terminal cells. */
  w: number
  h: number
  /** The well in blocks; `well[y][x]` is the kind that settled there. */
  cols: number
  rows: number
  well: (Kind | undefined)[][]
  piece: Piece
  next: Kind
  bag: Kind[]
  score: number
  lines: number
  level: number
  phase: Phase
  /** Frames of the host's 33 ms clock until the piece falls one row. */
  wait: number
  /** The piece could not fall at the last drop: it settles at the next. */
  isGrounded: boolean
  random: () => number
}

export const COLS = 10
const CELL_W = 2
// The well with a wall each side, a gap, and the 4-block preview.
export const FIELD_W = 1 + COLS * CELL_W + 1 + 1 + 4 * CELL_W
const LINE_SCORE = [0, 100, 300, 500, 800]
const LINES_PER_LEVEL = 10

const SHAPES: Record<Kind, { size: number; cells: Cell[] }> = {
  I: { size: 4, cells: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }] },
  O: { size: 2, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  T: { size: 3, cells: [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  S: { size: 3, cells: [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }] },
  Z: { size: 3, cells: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  J: { size: 3, cells: [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
  L: { size: 3, cells: [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }] },
}

export const COLORS: Record<Kind, string> = {
  I: '#4dd0e1',
  O: '#ffd93d',
  T: '#b388ff',
  S: '#6bcb77',
  Z: '#ff5f5f',
  J: '#4d96ff',
  L: '#ff9f43',
}
const WALL_COLOR = '#808080'
const GHOST_COLOR = '#606060'

const KINDS: readonly Kind[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

function draw(g: Blocks): Kind {
  if (g.bag.length === 0) {
    const bag = [...KINDS]
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(g.random() * (i + 1))
      const tmp = bag[i]!
      bag[i] = bag[j]!
      bag[j] = tmp
    }
    g.bag = bag
  }
  return g.bag.shift() ?? 'T'
}

function spawn(kind: Kind): Piece {
  const shape = SHAPES[kind]
  const top = Math.min(...shape.cells.map(c => c.y))
  return { kind, size: shape.size, cells: shape.cells.map(c => ({ ...c })), x: Math.floor((COLS - shape.size) / 2), y: -top }
}

function framesPerDrop(level: number): number {
  return Math.max(2, 20 - (level - 1) * 2)
}

export function newBlocks(w: number, h: number, random: () => number = Math.random): Blocks {
  const rows = Math.max(12, h)
  const g: Blocks = {
    w: FIELD_W,
    h: rows,
    cols: COLS,
    rows,
    well: Array.from({ length: rows }, () => Array<Kind | undefined>(COLS).fill(undefined)),
    piece: spawn('T'),
    next: 'T',
    bag: [],
    score: 0,
    lines: 0,
    level: 1,
    phase: 'ready',
    wait: framesPerDrop(1),
    isGrounded: false,
    random,
  }
  g.piece = spawn(draw(g))
  g.next = draw(g)
  return g
}

/** The piece's cells in the well. */
export function cellsOf(p: Piece, dx = 0, dy = 0, cells: Cell[] = p.cells): Cell[] {
  return cells.map(c => ({ x: p.x + dx + c.x, y: p.y + dy + c.y }))
}

export function fits(g: Blocks, cells: readonly Cell[]): boolean {
  return cells.every(c => c.x >= 0 && c.x < g.cols && c.y < g.rows && (c.y < 0 || g.well[c.y]?.[c.x] === undefined))
}

function move(g: Blocks, dx: number, dy: number): boolean {
  if (!fits(g, cellsOf(g.piece, dx, dy))) return false
  g.piece.x += dx
  g.piece.y += dy
  return true
}

// Shifts tried, in order, when a rotation does not fit where it is.
const KICKS: readonly Cell[] = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
  { x: -2, y: 0 },
  { x: 2, y: 0 },
  { x: 0, y: -1 },
]

function rotate(g: Blocks): boolean {
  const p = g.piece
  if (p.kind === 'O') return false
  const turned = p.cells.map(c => ({ x: p.size - 1 - c.y, y: c.x }))
  for (const k of KICKS) {
    if (fits(g, cellsOf(p, k.x, k.y, turned))) {
      p.cells = turned
      p.x += k.x
      p.y += k.y
      return true
    }
  }
  return false
}

/** How far the piece would fall. */
export function dropDistance(g: Blocks): number {
  let d = 0
  while (fits(g, cellsOf(g.piece, 0, d + 1))) d++
  return d
}

function settle(g: Blocks): TickResult {
  for (const c of cellsOf(g.piece)) {
    if (c.y < 0) {
      g.phase = 'over'
      return 'over'
    }
    const row = g.well[c.y]
    if (row) row[c.x] = g.piece.kind
  }
  const kept = g.well.filter(row => row.some(k => k === undefined))
  const cleared = g.rows - kept.length
  while (kept.length < g.rows) kept.unshift(Array<Kind | undefined>(g.cols).fill(undefined))
  g.well = kept
  if (cleared > 0) {
    g.score += (LINE_SCORE[cleared] ?? 0) * g.level
    g.lines += cleared
    g.level = 1 + Math.floor(g.lines / LINES_PER_LEVEL)
  }
  g.piece = spawn(g.next)
  g.next = draw(g)
  g.isGrounded = false
  g.wait = framesPerDrop(g.level)
  if (!fits(g, cellsOf(g.piece))) {
    g.phase = 'over'
    return 'over'
  }
  return 'changed'
}

export function press(g: Blocks, action: Action): boolean {
  if (g.phase === 'over') return false
  if (g.phase === 'ready') {
    if (action !== 'primary') return false
    g.phase = 'play'
    return true
  }
  switch (action) {
    case 'left':
      return move(g, -1, 0)
    case 'right':
      return move(g, 1, 0)
    case 'up':
      return rotate(g)
    case 'down':
      if (!move(g, 0, 1)) return false
      g.score += 1
      return true
    case 'primary': {
      const d = dropDistance(g)
      g.piece.y += d
      g.score += 2 * d
      settle(g)
      return true
    }
  }
}

export function tick(g: Blocks): TickResult {
  if (g.phase !== 'play') return 'none'
  g.wait -= 1
  if (g.wait > 0) return 'none'
  g.wait = framesPerDrop(g.level)
  if (move(g, 0, 1)) {
    g.isGrounded = false
    return 'changed'
  }
  // One drop's grace to slide or turn a piece that has landed.
  if (!g.isGrounded) {
    g.isGrounded = true
    return 'none'
  }
  return settle(g)
}

export function frame(g: Blocks, glyphs: Glyphs): Frame {
  const falling = g.phase === 'over' ? [] : cellsOf(g.piece)
  const d = g.phase === 'over' ? 0 : dropDistance(g)
  const ghost = d > 0 ? cellsOf(g.piece, 0, d) : []
  const isAt = (cells: readonly Cell[], x: number, y: number) => cells.some(c => c.x === x && c.y === y)

  const preview = SHAPES[g.next]
  const blank = glyphs.empty.repeat(CELL_W)
  const rows: Frame = []
  for (let y = 0; y < g.rows; y++) {
    const cells: Segment[] = []
    const put = (text: string, color?: string) => {
      const last = cells[cells.length - 1]
      if (last && last.color === color) last.text += text
      else cells.push({ text, color })
    }
    put(glyphs.wall, WALL_COLOR)
    for (let x = 0; x < g.cols; x++) {
      const settled = g.well[y]?.[x]
      if (isAt(falling, x, y)) put(glyphs.tile, COLORS[g.piece.kind])
      else if (settled) put(glyphs.tile, COLORS[settled])
      else if (isAt(ghost, x, y)) put(glyphs.ghost, GHOST_COLOR)
      else put(blank)
    }
    put(glyphs.wall, WALL_COLOR)
    put(glyphs.empty)
    // The next piece, drawn in the top rows beside the well.
    for (let x = 0; x < 4; x++) {
      const py = y - 1
      if (py >= 0 && py < preview.size && preview.cells.some(c => c.x === x && c.y === py)) put(glyphs.tile, COLORS[g.next])
      else put(blank)
    }
    rows.push(cells)
  }
  return rows
}

export const blocks: GameDef<Blocks> = {
  id: 'blocks',
  name: 'blocks.name',
  blurb: 'blocks.blurb',
  help: 'blocks.help',
  tickMs: 33,
  minW: FIELD_W,
  minH: 14,
  maxW: FIELD_W,
  maxH: 20,
  create: (w, h) => newBlocks(w, h),
  key: press,
  tick,
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level, lines: g.lines }),
  frame,
  banner: g => (g.phase === 'ready' ? 'start' : undefined),
}
