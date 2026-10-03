// Meteors as pure logic: single rocks fall, each at its own pace with a
// glowing trail behind it, and the ship slides along the bottom row. The host
// feeds it actions and ticks; the tests drive it directly.
//
// The field starts almost empty and fills with the level: rocks come one at
// a time, never right next to one that has just appeared, so there is always
// open sky to steer into.

import type { Glyphs } from '../glyphs'
import { put } from './types'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Size = 1 | 2 | 3

/** `every` is the frames a row takes, `wait` the frames left on this row. */
export type Rock = { x: number; y: number; size: Size; every: number; wait: number }
export type Bonus = { x: number; y: number; every: number; wait: number }

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
  /** Frames of the host's clock left before the next rock appears. */
  spawnIn: number
  random: () => number
}

export const START_LIVES = 3
export const MIN_W = 25
export const MIN_H = 14
/** Cells the ship slides per key. */
export const SHIP_STEP = 2
const ROCK_SCORE = 1
export const BONUS_SCORE = 5
const BONUS_CHANCE = 0.06
export const SCORE_PER_LEVEL = 25
// Frames (of the host's 33 ms clock) a mid rock takes per row: slower at
// first, a frame faster every second level. Small rocks are a frame faster,
// big ones a frame slower.
const START_FRAMES = 7
export const MIN_FRAMES = 3
// Frames between two rocks on a field 40 wide: one fewer per level. A wider
// field gets them sooner, so every column sees the same.
const START_SPAWN = 16
const MIN_SPAWN = 5
const SPAWN_W = 40
// A new rock keeps this far, sideways, from rocks still in the top rows.
export const SPAWN_GAP = 3
export const SPAWN_ROWS = 3
const SPAWN_TRIES = 6

export const SHIP_COLOR = '#5fd7ff'
export const BONUS_COLOR = '#ffe14d'
export const ROCK_COLORS: Record<Size, string> = { 1: '#ff8a4c', 2: '#e06c3c', 3: '#b85a3a' }
// The trail cools as it falls behind: next to the rock, and one further up.
export const TRAIL_COLORS = ['#8a4a3a', '#55322c'] as const

export function newMeteors(w: number, h: number, random: () => number = Math.random): Meteors {
  const width = Math.max(MIN_W, Math.floor(w))
  const height = Math.max(MIN_H, Math.floor(h))
  return {
    w: width,
    h: height,
    shipX: Math.floor(width / 2),
    rocks: [],
    bonuses: [],
    lives: START_LIVES,
    score: 0,
    level: 1,
    phase: 'ready',
    spawnIn: 1,
    random,
  }
}

export function shipRow(g: Meteors): number {
  return g.h - 1
}

/** Frames a rock of this size takes per row at the game's level. */
export function framesPerRow(g: Meteors, size: Size): number {
  const mid = Math.max(MIN_FRAMES, START_FRAMES - Math.floor((g.level - 1) / 2))
  return Math.max(2, mid + size - 2)
}

/** Frames between two new rocks. */
export function spawnEvery(g: Meteors): number {
  const frames = Math.max(MIN_SPAWN, START_SPAWN + 1 - g.level)
  return Math.max(2, Math.round((frames * SPAWN_W) / g.w))
}

function overlaps(r: Rock, x: number): boolean {
  return x >= r.x && x < r.x + r.size
}

/** True when a rock of this size at `x` would crowd one that has just appeared. */
function isCrowded(g: Meteors, x: number, size: number): boolean {
  return g.rocks.some(r => r.y < SPAWN_ROWS && x < r.x + r.size + SPAWN_GAP && r.x < x + size + SPAWN_GAP)
}

/** Puts one rock, or now and then a bonus, at the top. */
export function spawn(g: Meteors): void {
  if (g.random() < BONUS_CHANCE) {
    const every = framesPerRow(g, 2)
    g.bonuses.push({ x: Math.floor(g.random() * g.w), y: 0, every, wait: every })
    return
  }
  // Mostly small ones; a big one is rare.
  const roll = g.random()
  const size: Size = roll < 0.5 ? 1 : roll < 0.85 ? 2 : 3
  for (let i = 0; i < SPAWN_TRIES; i++) {
    const x = Math.floor(g.random() * (g.w - size + 1))
    if (isCrowded(g, x, size)) continue
    const every = framesPerRow(g, size)
    g.rocks.push({ x, y: 0, size, every, wait: every })
    return
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
  if (g.lives <= 0) {
    g.phase = 'over'
    return 'over'
  }
  g.phase = 'ready'
  return 'changed'
}

/** Takes a bonus on the ship's cell, if there is one. */
function catchBonus(g: Meteors, x: number = g.shipX): void {
  const row = shipRow(g)
  const caught = g.bonuses.filter(b => b.y === row && b.x === x)
  if (caught.length === 0) return
  g.bonuses = g.bonuses.filter(b => !caught.includes(b))
  addScore(g, BONUS_SCORE * caught.length)
}

function isHit(g: Meteors, x: number = g.shipX): boolean {
  const row = shipRow(g)
  return g.rocks.some(r => r.y === row && overlaps(r, x))
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
  const dir = action === 'left' ? -1 : 1
  const to = Math.min(g.w - 1, Math.max(0, g.shipX + dir * SHIP_STEP))
  if (to === g.shipX) return false
  // The ship passes every cell on its way: it cannot jump a rock.
  while (g.shipX !== to) {
    g.shipX += dir
    if (g.phase !== 'play') continue
    if (isHit(g)) {
      hit(g)
      break
    }
    catchBonus(g)
  }
  return true
}

/** Moves what is due one row down; true when anything moved. */
function fall(things: { y: number; every: number; wait: number }[]): boolean {
  let hasMoved = false
  for (const t of things) {
    t.wait -= 1
    if (t.wait > 0) continue
    t.wait = t.every
    t.y += 1
    hasMoved = true
  }
  return hasMoved
}

export function tick(g: Meteors): TickResult {
  if (g.phase !== 'play') return 'none'
  const rocksMoved = fall(g.rocks)
  const bonusesMoved = fall(g.bonuses)
  let hasChanged = rocksMoved || bonusesMoved
  if (isHit(g)) return hit(g)
  catchBonus(g)
  const row = shipRow(g)
  const passed = g.rocks.filter(r => r.y > row).length
  if (passed > 0) {
    g.rocks = g.rocks.filter(r => r.y <= row)
    addScore(g, passed * ROCK_SCORE)
  }
  g.bonuses = g.bonuses.filter(b => b.y <= row)
  g.spawnIn -= 1
  if (g.spawnIn <= 0) {
    g.spawnIn = spawnEvery(g)
    spawn(g)
    hasChanged = true
  }
  return hasChanged ? 'changed' : 'none'
}

/** The cells of a rock's trail: the row behind it, and one more behind its middle. */
export function trailOf(r: Rock): { x: number; y: number; age: 0 | 1 }[] {
  const cells: { x: number; y: number; age: 0 | 1 }[] = []
  for (let i = 0; i < r.size; i++) cells.push({ x: r.x + i, y: r.y - 1, age: 0 })
  // A rock two wide has no middle: its trail stays one row long.
  if (r.size !== 2) cells.push({ x: r.x + (r.size - 1) / 2, y: r.y - 2, age: 1 })
  return cells
}

export function frame(g: Meteors, glyphs: Glyphs): Frame {
  const grid: { ch: string; color?: string }[][] = []
  for (let y = 0; y < g.h; y++) grid.push(Array.from({ length: g.w }, () => ({ ch: glyphs.empty })))
  const set = (x: number, y: number, ch: string, color: string): void => {
    const cell = grid[y]?.[x]
    if (!cell) return
    cell.ch = ch
    cell.color = color
  }
  // Trails first: a trail never hides a rock, a bonus or the ship.
  for (const r of g.rocks) for (const t of trailOf(r)) set(t.x, t.y, glyphs.rockTrail, TRAIL_COLORS[t.age])
  const glyphOf: Record<Size, string> = { 1: glyphs.rockSmall, 2: glyphs.rockMid, 3: glyphs.rockBig }
  for (const r of g.rocks) {
    const chars = Array.from(glyphOf[r.size])
    for (let i = 0; i < r.size; i++) set(r.x + i, r.y, chars[i] ?? chars[0] ?? glyphs.empty, ROCK_COLORS[r.size])
  }
  for (const b of g.bonuses) set(b.x, b.y, glyphs.bonus, BONUS_COLOR)
  set(g.shipX, shipRow(g), glyphs.ship, SHIP_COLOR)
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
