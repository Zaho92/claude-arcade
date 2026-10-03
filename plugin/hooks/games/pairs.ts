// Pairs as pure logic, the old card game of finding the matching cards: cards
// lie face down, each symbol on exactly two of them, and two are turned per
// try. A match stays open; two cards that do not match stay shown until the
// next key, then turn back. No clock: it moves on keys alone, so a pause
// never hides or reveals anything. Each cleared board leads to a bigger one,
// as far as the pane has room; the cursor is drawn in brackets.

import type { Glyphs } from '../glyphs'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Card = {
  /** Index into `Glyphs.cards`. */
  sym: number
  state: 'down' | 'up' | 'done'
}

export type Pairs = {
  /** Field size in terminal cells; the board is centered in it. */
  w: number
  h: number
  /** Boards that fit this field, smallest first (columns, rows). */
  boards: readonly (readonly [number, number])[]
  level: number
  cols: number
  rows: number
  cards: Card[]
  cursor: { x: number; y: number }
  /** Tries on this board: two cards turned. */
  tries: number
  /** The first card of a try, turned and waiting for its partner. */
  first: number | undefined
  /** Two cards that did not match, shown until the next key. */
  mismatch: [number, number] | undefined
  /** Every pair of this board found; the next key opens the next board. */
  isCleared: boolean
  /** Points of the boards cleared so far. */
  score: number
  phase: Status
  isWon: boolean
  random: () => number
}

/** A card is 5 cells wide and 3 rows high; a gap column and a gap row follow it. */
const CARD_W = 5
const CARD_H = 3
const CELL_W = CARD_W + 1
const CELL_H = CARD_H + 1
const POINTS_STEP = 10

/** Every board the game knows, smallest first. Never an odd number of cards. */
const BOARDS: readonly (readonly [number, number])[] = [
  [4, 3],
  [4, 4],
  [6, 4],
  [8, 4],
]
const FIRST = BOARDS[0] ?? [4, 3]
const LAST = BOARDS[BOARDS.length - 1] ?? FIRST

export const MIN_W = FIRST[0] * CELL_W
export const MIN_H = FIRST[1] * CELL_H
export const MAX_W = LAST[0] * CELL_W
export const MAX_H = LAST[1] * CELL_H

// One color per symbol, our own: no two alike, so even without the shapes the
// pairs differ. All bright, so the faces they are drawn on are dark.
export const SYMBOL_COLORS = [
  '#ff7b9c',
  '#ff5f5f',
  '#ff9f43',
  '#ffd93d',
  '#a8e063',
  '#6bcb77',
  '#5ee6d6',
  '#4dd0ff',
  '#7cc4ff',
  '#4d96ff',
  '#8a6be8',
  '#c792ea',
  '#e052c8',
  '#d9a066',
  '#b5e8c8',
  '#f4d8a8',
]
const BACK_BG = '#4a5070'
const BACK_DOT = '#9aa0c0'
// An open card is the darkest thing on the board, darker than a found pair.
export const UP_BG = '#12141c'
export const DONE_BG = '#2b2f45'
const CURSOR_COLOR = '#ffffff'

/** The boards that fit a field of w × h cells; the smallest always does. */
export function boardsFor(w: number, h: number): readonly (readonly [number, number])[] {
  const fit = BOARDS.filter(([cols, rows]) => cols * CELL_W <= w && rows * CELL_H <= h)
  return fit.length > 0 ? fit : [FIRST]
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const k = Math.floor(random() * (i + 1))
    const tmp = items[i] as T
    items[i] = items[k] as T
    items[k] = tmp
  }
  return items
}

/** A shuffled board: `count` different symbols, each on exactly two cards. */
export function deal(count: number, random: () => number): Card[] {
  const symbols = shuffle(
    SYMBOL_COLORS.map((_, i) => i),
    random,
  ).slice(0, count)
  return shuffle(
    symbols.flatMap((sym): Card[] => [
      { sym, state: 'down' },
      { sym, state: 'down' },
    ]),
    random,
  )
}

function startBoard(g: Pairs): void {
  const [cols, rows] = g.boards[g.level - 1] ?? FIRST
  g.cols = cols
  g.rows = rows
  g.cards = deal((cols * rows) / 2, g.random)
  g.cursor = { x: 0, y: 0 }
  g.tries = 0
  g.first = undefined
  g.mismatch = undefined
  g.isCleared = false
}

export function newPairs(w: number, h: number, random: () => number = Math.random): Pairs {
  const g: Pairs = {
    w,
    h,
    boards: boardsFor(w, h),
    level: 1,
    cols: 0,
    rows: 0,
    cards: [],
    cursor: { x: 0, y: 0 },
    tries: 0,
    first: undefined,
    mismatch: undefined,
    isCleared: false,
    score: 0,
    phase: 'play',
    isWon: false,
    random,
  }
  startBoard(g)
  return g
}

/** Points for a cleared board: fewer tries, more points; never less than one step. */
export function boardPoints(count: number, tries: number): number {
  return Math.max(1, 3 * count - tries + 1) * POINTS_STEP
}

export function cardAt(g: Pairs, x: number, y: number): Card | undefined {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return undefined
  return g.cards[y * g.cols + x]
}

/** Turns a card, and judges the try when it is the second. */
function turn(g: Pairs, index: number): void {
  const card = g.cards[index]
  if (!card) return
  card.state = 'up'
  if (g.first === undefined) {
    g.first = index
    return
  }
  const other = g.cards[g.first]
  const firstIndex = g.first
  g.first = undefined
  g.tries++
  if (!other || other.sym !== card.sym) {
    g.mismatch = [firstIndex, index]
    return
  }
  other.state = 'done'
  card.state = 'done'
  if (g.cards.every(c => c.state === 'done')) {
    g.isCleared = true
    g.score += boardPoints(g.cards.length / 2, g.tries)
    if (g.level >= g.boards.length) {
      g.isWon = true
      g.phase = 'over'
    }
  }
}

export function press(g: Pairs, action: Action): boolean {
  if (g.phase === 'over') return false
  if (g.isCleared) {
    if (action !== 'primary') return false
    g.level++
    startBoard(g)
    return true
  }
  // Two cards that did not match turn back with the next key; that key then
  // does what it says, so it is never swallowed.
  const hadMismatch = g.mismatch !== undefined
  if (g.mismatch) {
    for (const i of g.mismatch) {
      const c = g.cards[i]
      if (c) c.state = 'down'
    }
    g.mismatch = undefined
  }
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
      const index = c.y * g.cols + c.x
      if (g.cards[index]?.state !== 'down') return hadMismatch
      turn(g, index)
      return true
    }
    case 'secondary':
      return hadMismatch
  }
}

function blank(n: number): Segment {
  return { text: ' '.repeat(n) }
}

/** One of the three rows of a card, CARD_W cells wide. */
function cardRow(g: Pairs, glyphs: Glyphs, card: Card, row: number, isCursor: boolean): Segment {
  if (card.state === 'down') {
    // A pattern on the back, so a closed card differs from an open one without colors.
    const d = glyphs.dot
    const mark = isCursor && row === 1 ? `${glyphs.cursorLeft} ${d} ${glyphs.cursorRight}` : row === 1 ? ` ${d} ${d} ` : `${d} ${d} ${d}`
    return { text: mark, color: isCursor && row === 1 ? CURSOR_COLOR : BACK_DOT, bg: BACK_BG }
  }
  const bg = card.state === 'up' ? UP_BG : DONE_BG
  const color = SYMBOL_COLORS[card.sym]
  if (row !== 1) return { text: ' '.repeat(CARD_W), bg }
  const symbol = glyphs.cards[card.sym] ?? glyphs.empty
  const text = isCursor ? `${glyphs.cursorLeft} ${symbol} ${glyphs.cursorRight}` : `  ${symbol}  `
  return { text, color, bg }
}

export function frame(g: Pairs, glyphs: Glyphs): Frame {
  const usedW = g.cols * CELL_W
  const usedH = g.rows * CELL_H
  const left = Math.max(0, Math.floor((g.w - usedW) / 2))
  const top = Math.max(0, Math.floor((g.h - usedH) / 2))
  const isCursorShown = g.phase !== 'over' && !g.isCleared
  const rows: Frame = []
  for (let y = 0; y < g.h; y++) {
    const cells: Segment[] = []
    const r = y - top
    if (r < 0 || r >= usedH) {
      rows.push([blank(g.w)])
      continue
    }
    const cardY = Math.floor(r / CELL_H)
    const inCard = r % CELL_H
    if (left > 0) cells.push(blank(left))
    for (let x = 0; x < g.cols; x++) {
      const card = cardAt(g, x, cardY)
      if (!card) continue
      if (inCard === CARD_H) cells.push(blank(CELL_W))
      else {
        cells.push(cardRow(g, glyphs, card, inCard, isCursorShown && g.cursor.x === x && g.cursor.y === cardY))
        cells.push(blank(1))
      }
    }
    const rest = g.w - left - usedW
    if (rest > 0) cells.push(blank(rest))
    rows.push(cells)
  }
  return rows
}

export const pairs: GameDef<Pairs> = {
  id: 'pairs',
  name: 'pairs.name',
  blurb: 'pairs.blurb',
  help: 'pairs.help',
  sign: glyphs => [
    { text: glyphs.cards[1] ?? '', color: SYMBOL_COLORS[1] },
    { text: glyphs.cards[4] ?? '', color: SYMBOL_COLORS[4] },
  ],
  tickMs: 0,
  minW: MIN_W,
  minH: MIN_H,
  maxW: MAX_W,
  maxH: MAX_H,
  create: (w, h) => newPairs(w, h),
  key: press,
  tick: (): TickResult => 'none',
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level, extra: { key: 'hud.tries', n: g.tries } }),
  frame,
  banner: g => (g.isWon ? 'pairs.won' : g.isCleared ? 'pairs.cleared' : undefined),
}
