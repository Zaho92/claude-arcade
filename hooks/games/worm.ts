// Worm as pure logic. The grid's cells are two terminal columns wide, so the
// board looks square; the host feeds it actions and ticks.

import type { Glyphs } from '../glyphs'
import { put } from './types'
import type { Action, Dir, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Cell = { x: number; y: number }

export type Worm = {
  /** Field size in terminal cells. */
  w: number
  h: number
  /** Grid size in worm cells. */
  cols: number
  rows: number
  /** Head first. */
  body: Cell[]
  dir: Dir
  /** Turns pressed faster than the worm moves, applied one per step. */
  queue: Dir[]
  food: Cell
  score: number
  level: number
  phase: Status
  /** True once the worm fills the whole board: nothing left to eat. */
  isWon: boolean
  /** Frames of the host's clock left before the next step. */
  wait: number
  random: () => number
}

const CELL_W = 2
const START_LEN = 4
const FOOD_SCORE = 10
// Frames (of the host's 33 ms clock) per step: slower at first, faster per level.
const START_FRAMES = 4
const MIN_FRAMES = 2
const FOOD_PER_LEVEL = 5

const OPPOSITE: Record<Dir, Dir> = { left: 'right', right: 'left', up: 'down', down: 'up' }
const STEP: Record<Dir, Cell> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } }

export const HEAD_COLOR = '#8ef08e'
export const BODY_COLOR = '#3fae5a'
export const FOOD_COLOR = '#ff5f5f'

export function newWorm(w: number, h: number, random: () => number = Math.random): Worm {
  const cols = Math.max(8, Math.floor(w / CELL_W))
  const rows = Math.max(6, h)
  const cy = Math.floor(rows / 2)
  const cx = Math.floor(cols / 2)
  const body: Cell[] = []
  for (let i = 0; i < START_LEN; i++) body.push({ x: cx - i, y: cy })
  const g: Worm = {
    w: cols * CELL_W,
    h: rows,
    cols,
    rows,
    body,
    dir: 'right',
    queue: [],
    food: { x: 0, y: 0 },
    score: 0,
    level: 1,
    phase: 'ready',
    isWon: false,
    wait: START_FRAMES,
    random,
  }
  g.food = placeFood(g) ?? { x: 0, y: 0 }
  return g
}

export function framesPerStep(g: Worm): number {
  return Math.max(MIN_FRAMES, START_FRAMES - (g.level - 1))
}

function isOn(cells: readonly Cell[], c: Cell): boolean {
  return cells.some(b => b.x === c.x && b.y === c.y)
}

/** A free cell for the food, or undefined when the worm fills the board. */
function placeFood(g: Worm): Cell | undefined {
  const free: Cell[] = []
  for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) if (!isOn(g.body, { x, y })) free.push({ x, y })
  if (free.length === 0) return undefined
  return free[Math.floor(g.random() * free.length)] ?? free[0]
}

export function press(g: Worm, action: Action): boolean {
  if (g.phase === 'over' || action === 'secondary') return false
  if (action === 'primary') {
    if (g.phase !== 'ready') return false
    g.phase = 'play'
    return true
  }
  if (g.phase === 'ready') {
    // A direction also starts a waiting game, but never straight back.
    if (action === OPPOSITE[g.dir]) return false
    g.phase = 'play'
    if (action !== g.dir) g.queue.push(action)
    return true
  }
  const last = g.queue[g.queue.length - 1] ?? g.dir
  if (action === last || action === OPPOSITE[last] || g.queue.length >= 2) return false
  g.queue.push(action)
  return true
}

/** One step of the worm. */
export function step(g: Worm): TickResult {
  const next = g.queue.shift()
  if (next) g.dir = next
  const head = g.body[0]
  if (!head) return 'none'
  const d = STEP[g.dir]
  const to = { x: head.x + d.x, y: head.y + d.y }
  const isEating = to.x === g.food.x && to.y === g.food.y
  // The tail moves away this step unless the worm grows.
  const blocking = isEating ? g.body : g.body.slice(0, -1)
  if (to.x < 0 || to.y < 0 || to.x >= g.cols || to.y >= g.rows || isOn(blocking, to)) {
    g.phase = 'over'
    return 'over'
  }
  g.body.unshift(to)
  if (!isEating) {
    g.body.pop()
    return 'changed'
  }
  g.score += FOOD_SCORE * g.level
  const eaten = g.body.length - START_LEN
  g.level = 1 + Math.floor(eaten / FOOD_PER_LEVEL)
  const food = placeFood(g)
  if (!food) {
    g.isWon = true
    g.phase = 'over'
    return 'over'
  }
  g.food = food
  return 'changed'
}

export function tick(g: Worm): TickResult {
  if (g.phase !== 'play') return 'none'
  g.wait -= 1
  if (g.wait > 0) return 'none'
  g.wait = framesPerStep(g)
  return step(g)
}

export function frame(g: Worm, glyphs: Glyphs): Frame {
  const rows: Frame = []
  const head = g.body[0]
  for (let y = 0; y < g.rows; y++) {
    const cells: Segment[] = []
    for (let x = 0; x < g.cols; x++) {
      if (head && head.x === x && head.y === y) put(cells, glyphs.wormHead, HEAD_COLOR)
      else if (isOn(g.body, { x, y })) put(cells, glyphs.wormBody, BODY_COLOR)
      else if (g.food.x === x && g.food.y === y) put(cells, glyphs.food, FOOD_COLOR)
      else put(cells, glyphs.empty.repeat(CELL_W))
    }
    rows.push(cells)
  }
  return rows
}

export const worm: GameDef<Worm> = {
  id: 'worm',
  name: 'worm.name',
  blurb: 'worm.blurb',
  help: 'worm.help',
  tickMs: 33,
  minW: 16,
  minH: 8,
  maxW: 48,
  maxH: 20,
  create: (w, h) => newWorm(w, h),
  key: press,
  tick,
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level }),
  frame,
  banner: g => (g.phase === 'ready' ? 'start' : g.isWon ? 'worm.won' : undefined),
}
