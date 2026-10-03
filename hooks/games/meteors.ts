// Meteors as pure logic: rocks fall, the ship slides along the bottom row.
// The host feeds it actions and ticks; the tests drive it directly.
//
// Fairness is built into the spawning: every row of rocks leaves a free
// lane three cells wide, and the lane never jumps further from one row to
// the next than the ship can slide in the time between the two rows.

import type { Glyphs } from '../glyphs'
import { put } from './types'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Size = 1 | 2 | 3

export type Rock = { x: number; y: number; size: Size }
export type Bonus = { x: number; y: number }

export type Meteors = {
  w: number
  h: number
  shipX: number
  rocks: Rock[]
  bonuses: Bonus[]
  lives: number
  score: number
  level: number
  phase: Status
  /** Frames of the host's clock left before everything falls one row. */
  wait: number
  /** Falls left until the next row of rocks appears at the top. */
  spawnIn: number
  /** Middle of the free lane in the last row of rocks. */
  lane: number
  random: () => number
}

export const START_LIVES = 3
export const MIN_W = 25
export const MIN_H = 14
/** Falls between two rows of rocks. */
export const ROW_GAP = 3
/** Frames the ship needs to slide one cell, at the very least: the fairness yardstick. */
export const SHIP_FRAMES_PER_CELL = 3
/** The lane is this many cells either side of its middle, so three wide. */
export const LANE_HALF = 1
const ROCK_SCORE = 1
export const BONUS_SCORE = 5
const BONUS_CHANCE = 0.12
const SCORE_PER_LEVEL = 10
// Frames (of the host's 33 ms clock) per fall: slower at first, faster per level.
const START_FRAMES = 6
export const MIN_FRAMES = 2

export const SHIP_COLOR = '#5fd7ff'
export const BONUS_COLOR = '#ffe14d'
export const ROCK_COLORS: Record<Size, string> = { 1: '#8a919c', 2: '#a38d7a', 3: '#8f7fa3' }

export function newMeteors(w: number, h: number, random: () => number = Math.random): Meteors {
  const width = Math.max(MIN_W, Math.floor(w))
  const height = Math.max(MIN_H, Math.floor(h))
  const shipX = Math.floor(width / 2)
  return {
    w: width,
    h: height,
    shipX,
    rocks: [],
    bonuses: [],
    lives: START_LIVES,
    score: 0,
    level: 1,
    phase: 'ready',
    wait: START_FRAMES,
    spawnIn: 1,
    lane: shipX,
    random,
  }
}

export function shipRow(g: Meteors): number {
  return g.h - 1
}

export function framesPerFall(g: Meteors): number {
  return Math.max(MIN_FRAMES, START_FRAMES + 1 - g.level)
}

/** How full a row of rocks is: more with the level, never all of it. */
function density(g: Meteors): number {
  return Math.min(0.7, 0.25 + 0.06 * g.level)
}

/**
 * How far the lane may move between two rows. The ship has to stay in the lane
 * while the rocks of its row are on the bottom row, which leaves two falls of
 * the three between the rows to slide in.
 */
export function laneReach(g: Meteors): number {
  return Math.max(1, Math.floor(((ROW_GAP - 1) * framesPerFall(g)) / SHIP_FRAMES_PER_CELL))
}

function overlaps(r: Rock, x: number): boolean {
  return x >= r.x && x < r.x + r.size
}

/** Puts a row of rocks, and now and then a bonus, at the top. */
export function spawnRow(g: Meteors): void {
  // Some rows stay empty, fewer with the level.
  if (g.random() < Math.max(0, 0.3 - 0.05 * g.level)) return
  const reach = laneReach(g)
  const shift = Math.floor(g.random() * (2 * reach + 1)) - reach
  g.lane = Math.min(g.w - 1 - LANE_HALF, Math.max(LANE_HALF, g.lane + shift))
  const row: Rock[] = []
  let x = 0
  while (x < g.w) {
    if (Math.abs(x - g.lane) <= LANE_HALF) {
      x = g.lane + LANE_HALF + 1
      continue
    }
    if (g.random() >= density(g)) {
      x += 1
      continue
    }
    // A rock never reaches into the lane or past the wall.
    const room = (x < g.lane ? g.lane - LANE_HALF : g.w) - x
    const size = Math.min(room, 1 + Math.floor(g.random() * 3)) as Size
    row.push({ x, y: 0, size })
    x += size + 1
  }
  g.rocks.push(...row)
  if (g.random() < BONUS_CHANCE) {
    const free: number[] = []
    for (let c = 0; c < g.w; c++) if (!row.some(r => overlaps(r, c))) free.push(c)
    const at = free[Math.floor(g.random() * free.length)]
    if (at !== undefined) g.bonuses.push({ x: at, y: 0 })
  }
}

function addScore(g: Meteors, n: number): void {
  g.score += n
  g.level = 1 + Math.floor(g.score / SCORE_PER_LEVEL)
}

/** A hit costs a life and clears the field; Space brings the next ship. */
function hit(g: Meteors): TickResult {
  g.lives -= 1
  g.rocks = []
  g.bonuses = []
  g.spawnIn = 1
  g.wait = framesPerFall(g)
  if (g.lives <= 0) {
    g.phase = 'over'
    return 'over'
  }
  g.phase = 'ready'
  return 'changed'
}

/** Takes a bonus on the ship's cell, if there is one. */
function catchBonus(g: Meteors): void {
  const row = shipRow(g)
  const caught = g.bonuses.filter(b => b.y === row && b.x === g.shipX)
  if (caught.length === 0) return
  g.bonuses = g.bonuses.filter(b => !caught.includes(b))
  addScore(g, BONUS_SCORE * caught.length)
}

function isHit(g: Meteors): boolean {
  const row = shipRow(g)
  return g.rocks.some(r => r.y === row && overlaps(r, g.shipX))
}

/** Applies one action; true when something changed. */
export function press(g: Meteors, action: Action): boolean {
  if (g.phase === 'over') return false
  if (action === 'primary') {
    if (g.phase !== 'ready') return false
    g.phase = 'play'
    return true
  }
  if (action !== 'left' && action !== 'right') return false
  const x = Math.min(g.w - 1, Math.max(0, g.shipX + (action === 'left' ? -1 : 1)))
  if (x === g.shipX) return false
  g.shipX = x
  if (g.phase === 'play') {
    if (isHit(g)) hit(g)
    else catchBonus(g)
  }
  return true
}

/** Everything falls one row. */
export function fall(g: Meteors): TickResult {
  for (const r of g.rocks) r.y += 1
  for (const b of g.bonuses) b.y += 1
  if (isHit(g)) return hit(g)
  catchBonus(g)
  const row = shipRow(g)
  const passed = g.rocks.filter(r => r.y > row).length
  g.rocks = g.rocks.filter(r => r.y <= row)
  g.bonuses = g.bonuses.filter(b => b.y <= row)
  if (passed > 0) addScore(g, passed * ROCK_SCORE)
  g.spawnIn -= 1
  if (g.spawnIn <= 0) {
    g.spawnIn = ROW_GAP
    spawnRow(g)
  }
  return 'changed'
}

export function tick(g: Meteors): TickResult {
  if (g.phase !== 'play') return 'none'
  g.wait -= 1
  if (g.wait > 0) return 'none'
  g.wait = framesPerFall(g)
  return fall(g)
}

export function frame(g: Meteors, glyphs: Glyphs): Frame {
  const grid: { ch: string; color?: string }[][] = []
  for (let y = 0; y < g.h; y++) grid.push(Array.from({ length: g.w }, () => ({ ch: glyphs.empty })))
  const glyphOf: Record<Size, string> = { 1: glyphs.rockSmall, 2: glyphs.rockMid, 3: glyphs.rockBig }
  for (const r of g.rocks) {
    const chars = Array.from(glyphOf[r.size])
    for (let i = 0; i < r.size; i++) {
      const cell = grid[r.y]?.[r.x + i]
      if (cell) {
        cell.ch = chars[i] ?? chars[0] ?? glyphs.empty
        cell.color = ROCK_COLORS[r.size]
      }
    }
  }
  for (const b of g.bonuses) {
    const cell = grid[b.y]?.[b.x]
    if (cell) {
      cell.ch = glyphs.bonus
      cell.color = BONUS_COLOR
    }
  }
  const ship = grid[shipRow(g)]?.[g.shipX]
  if (ship) {
    ship.ch = glyphs.ship
    ship.color = SHIP_COLOR
  }
  return grid.map(line => {
    const cells: Segment[] = []
    for (const c of line) put(cells, c.ch, c.color)
    return cells
  })
}

export const meteors: GameDef<Meteors> = {
  id: 'meteors',
  name: 'meteors.name',
  blurb: 'meteors.blurb',
  help: 'meteors.help',
  sign: glyphs => [
    { text: glyphs.rockSmall, color: ROCK_COLORS[1] },
    { text: glyphs.ship, color: SHIP_COLOR },
  ],
  tickMs: 33,
  minW: MIN_W,
  minH: MIN_H,
  maxW: 60,
  maxH: 24,
  create: (w, h) => newMeteors(w, h),
  key: press,
  tick,
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level, lives: g.lives, maxLives: START_LIVES }),
  frame,
  banner: g => (g.phase === 'ready' ? (g.score === 0 && g.lives === START_LIVES ? 'start' : 'continue') : undefined),
}
