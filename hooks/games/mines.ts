// Mines as pure logic: open every safe field, mark the mines. The first field
// opened is always safe, as are its neighbours. No clock: it moves on keys
// alone. Each field is three terminal columns wide; the cursor is drawn in
// brackets, so it shows without colors too.

import type { Glyphs } from '../glyphs'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Field = {
  isMine: boolean
  isOpen: boolean
  isFlagged: boolean
  /** Mines among the eight neighbours. */
  near: number
}

export type Mines = {
  /** Field size in terminal cells. */
  w: number
  h: number
  cols: number
  rows: number
  mineCount: number
  fields: Field[]
  cursor: { x: number; y: number }
  /** Mines are laid on the first open, away from it. */
  isLaid: boolean
  phase: Status
  isWon: boolean
  random: () => number
}

const CELL_W = 3
const DENSITY = 0.15
const WIN_BONUS_PER_MINE = 10

const NUMBER_COLORS = ['', '#7cc4ff', '#8fe388', '#ffb36b', '#ff7b9c', '#c792ea', '#5ee6d6', '#ffffff', '#bbbbbb']
const HIDDEN_BG = '#4a5070'
const HIDDEN_DOT = '#9aa0c0'
const OPEN_BG = '#20232f'
const FLAG_COLOR = '#ffd93d'
const MINE_COLOR = '#ff5f5f'
const CURSOR_COLOR = '#ffffff'

export function newMines(w: number, h: number, random: () => number = Math.random): Mines {
  const cols = Math.max(8, Math.min(16, Math.floor(w / CELL_W)))
  const rows = Math.max(8, Math.min(14, h))
  const fields: Field[] = Array.from({ length: cols * rows }, () => ({ isMine: false, isOpen: false, isFlagged: false, near: 0 }))
  return {
    w: cols * CELL_W,
    h: rows,
    cols,
    rows,
    mineCount: Math.round(cols * rows * DENSITY),
    fields,
    cursor: { x: Math.floor(cols / 2), y: Math.floor(rows / 2) },
    isLaid: false,
    phase: 'ready',
    isWon: false,
    random,
  }
}

export function fieldAt(g: Mines, x: number, y: number): Field | undefined {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return undefined
  return g.fields[y * g.cols + x]
}

function neighbours(g: Mines, x: number, y: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && fieldAt(g, x + dx, y + dy)) out.push({ x: x + dx, y: y + dy })
  return out
}

/** Lays the mines anywhere but on (x, y) and around it. */
export function lay(g: Mines, x: number, y: number): void {
  const spared = new Set([`${x},${y}`, ...neighbours(g, x, y).map(n => `${n.x},${n.y}`)])
  const free: number[] = []
  for (let i = 0; i < g.fields.length; i++) if (!spared.has(`${i % g.cols},${Math.floor(i / g.cols)}`)) free.push(i)
  const count = Math.min(g.mineCount, free.length)
  for (let k = 0; k < count; k++) {
    const pick = k + Math.floor(g.random() * (free.length - k))
    const tmp = free[k]!
    free[k] = free[pick]!
    free[pick] = tmp
    const f = g.fields[free[k]!]
    if (f) f.isMine = true
  }
  g.mineCount = count
  for (let yy = 0; yy < g.rows; yy++)
    for (let xx = 0; xx < g.cols; xx++) {
      const f = fieldAt(g, xx, yy)
      if (f) f.near = neighbours(g, xx, yy).filter(n => fieldAt(g, n.x, n.y)?.isMine).length
    }
  g.isLaid = true
}

function flags(g: Mines): number {
  return g.fields.filter(f => f.isFlagged).length
}

export function openCount(g: Mines): number {
  return g.fields.filter(f => f.isOpen && !f.isMine).length
}

function isCleared(g: Mines): boolean {
  return g.fields.every(f => f.isMine || f.isOpen)
}

/** Opens a field; a field with no mines around opens its neighbours too. */
export function open(g: Mines, x: number, y: number): void {
  if (!g.isLaid) lay(g, x, y)
  const start = fieldAt(g, x, y)
  if (!start || start.isOpen || start.isFlagged) return
  if (start.isMine) {
    start.isOpen = true
    for (const f of g.fields) if (f.isMine) f.isOpen = true
    g.phase = 'over'
    return
  }
  const todo = [{ x, y }]
  while (todo.length > 0) {
    const c = todo.pop()!
    const f = fieldAt(g, c.x, c.y)
    if (!f || f.isOpen || f.isFlagged || f.isMine) continue
    f.isOpen = true
    if (f.near === 0) todo.push(...neighbours(g, c.x, c.y))
  }
  if (isCleared(g)) {
    g.isWon = true
    g.phase = 'over'
  }
}

export function score(g: Mines): number {
  return openCount(g) + (g.isWon ? g.mineCount * WIN_BONUS_PER_MINE : 0)
}

export function press(g: Mines, action: Action): boolean {
  if (g.phase === 'over') return false
  const c = g.cursor
  switch (action) {
    case 'left':
      c.x = (c.x + g.cols - 1) % g.cols
      return true
    case 'right':
      c.x = (c.x + 1) % g.cols
      return true
    case 'up':
      c.y = (c.y + g.rows - 1) % g.rows
      return true
    case 'down':
      c.y = (c.y + 1) % g.rows
      return true
    case 'primary': {
      const f = fieldAt(g, c.x, c.y)
      if (!f || f.isOpen || f.isFlagged) return false
      g.phase = 'play'
      open(g, c.x, c.y)
      return true
    }
    case 'secondary': {
      const f = fieldAt(g, c.x, c.y)
      if (!f || f.isOpen) return false
      f.isFlagged = !f.isFlagged
      return true
    }
  }
}

export function frame(g: Mines, glyphs: Glyphs): Frame {
  const rows: Frame = []
  for (let y = 0; y < g.rows; y++) {
    const cells: Segment[] = []
    for (let x = 0; x < g.cols; x++) {
      const f = fieldAt(g, x, y)
      if (!f) continue
      let mark = glyphs.empty
      let color: string | undefined
      let bg = HIDDEN_BG
      if (f.isOpen) {
        bg = OPEN_BG
        if (f.isMine) {
          mark = glyphs.mine
          color = MINE_COLOR
        } else if (f.near > 0) {
          mark = String(f.near)
          color = NUMBER_COLORS[f.near]
        }
      } else if (f.isFlagged) {
        mark = glyphs.flag
        color = FLAG_COLOR
      } else {
        // A dot, so a closed field differs from an open empty one without colors.
        mark = glyphs.dot
        color = HIDDEN_DOT
      }
      const isCursor = g.phase !== 'over' && g.cursor.x === x && g.cursor.y === y
      const text = isCursor ? `${glyphs.cursorLeft}${mark}${glyphs.cursorRight}` : ` ${mark} `
      cells.push({ text, color: isCursor && (!color || color === HIDDEN_DOT) ? CURSOR_COLOR : color, bg })
    }
    rows.push(cells)
  }
  return rows
}

export const mines: GameDef<Mines> = {
  id: 'mines',
  name: 'mines.name',
  blurb: 'mines.blurb',
  help: 'mines.help',
  tickMs: 0,
  minW: 8 * CELL_W,
  minH: 8,
  maxW: 16 * CELL_W,
  maxH: 14,
  create: (w, h) => newMines(w, h),
  key: press,
  tick: (): TickResult => 'none',
  status: g => g.phase,
  hud: g => ({ score: score(g), extra: { key: 'hud.minesLeft', n: g.mineCount - flags(g) } }),
  frame,
  banner: g => (g.isWon ? 'mines.won' : undefined),
}
