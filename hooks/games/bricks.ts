// Bricks (ball and paddle) as pure logic: no drawing, no input, no clock. The arcade host
// feeds it actions and ticks; the tests drive it directly.

import type { Glyphs } from '../glyphs'
import { put } from './types'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Ball = { x: number; y: number; vx: number; vy: number }

/** The four bonuses a broken brick can drop. */
export type PowerKind = 'ball' | 'wide' | 'slow' | 'life'

/** A bonus on its way down; `x` is a column, `y` a row (with fractions between). */
export type Drop = { kind: PowerKind; x: number; y: number }

export type Game = {
  w: number
  h: number
  paddleX: number
  /** The paddle as drawn now: `baseW`, or wider while the wide effect runs. */
  paddleW: number
  baseW: number
  /** Every ball in the air; a life is lost when the last one is gone. */
  balls: Ball[]
  /** Bonuses falling down the field. */
  drops: Drop[]
  /** Game ticks left of each timed effect; 0 when it is not running. */
  wideLeft: number
  slowLeft: number
  /** Bricks still to break before the next bonus drops (carried across walls). */
  untilDrop: number
  random: () => number
  /** The pace of the wall's level; a slowed ball runs at BASE_SPEED instead. */
  speed: number
  bricks: number[]
  brickCols: number
  brickRows: number
  brickLeft: number
  lives: number
  score: number
  level: number
  phase: Status
}

export const BRICK_W = 4
export const BRICK_STEP = BRICK_W + 1
export const BRICK_TOP = 2
export const START_LIVES = 3
export const BASE_SPEED = 0.55
// Each cleared wall speeds the ball up, to a pace the paddle can still meet.
const LEVEL_SPEEDUP = 1.12
export const MAX_SPEED = 1
const SUBSTEPS = 4
const PADDLE_STEP = 3
// Terminal cells are about twice as tall as wide: vertical speed is halved
// so the ball's path looks the angle it is.
const ASPECT = 0.5

// One bonus for every 15 to 20 bricks broken.
export const DROP_EVERY_MIN = 15
export const DROP_EVERY_MAX = 20
// Rows a falling bonus moves per game tick (a ball covers about 0.28).
export const DROP_FALL = 0.2
// How long the timed effects run, in game ticks of 33 ms: about 20 and 15 seconds.
export const WIDE_TICKS = 600
export const SLOW_TICKS = 450
export const WIDE_FACTOR = 1.6
export const MAX_BALLS = 4
// Width in cells of the bar that runs down beside a running effect.
export const BAR_W = 6

export const MIN_W = 25
export const MIN_H = 14

export function paddleRow(g: Game): number {
  return g.h - 2
}

export function newGame(w: number, h: number, random: () => number = Math.random): Game {
  const width = Math.max(MIN_W, Math.floor(w))
  const height = Math.max(MIN_H, Math.floor(h))
  const baseW = Math.max(5, Math.round(width / 6))
  const g: Game = {
    w: width,
    h: height,
    paddleX: 0,
    paddleW: baseW,
    baseW,
    balls: [],
    drops: [],
    wideLeft: 0,
    slowLeft: 0,
    untilDrop: 0,
    random,
    speed: BASE_SPEED,
    bricks: [],
    brickCols: 0,
    brickRows: 0,
    brickLeft: 0,
    lives: START_LIVES,
    score: 0,
    level: 1,
    phase: 'ready',
  }
  g.paddleX = Math.floor((width - g.paddleW) / 2)
  g.untilDrop = nextDropGap(g)
  buildWall(g)
  parkBall(g)
  return g
}

function buildWall(g: Game): void {
  g.brickCols = Math.max(1, Math.floor((g.w + 1) / BRICK_STEP))
  g.brickRows = Math.min(6, Math.max(3, Math.floor((g.h - 8) / 2)))
  g.brickLeft = Math.floor((g.w - (g.brickCols * BRICK_STEP - 1)) / 2)
  g.bricks = []
  for (let r = 0; r < g.brickRows; r++) {
    for (let c = 0; c < g.brickCols; c++) g.bricks.push(r + 1)
  }
}

/** One ball on the paddle, at rest; no other ball is in play. */
function parkBall(g: Game): void {
  g.balls = [{ x: g.paddleX + g.paddleW / 2, y: paddleRow(g) - 0.5, vx: 0, vy: 0 }]
}

/** The pace the balls move at now: the wall's level, or the first level's while slowed. */
export function currentSpeed(g: Game): number {
  return g.slowLeft > 0 ? Math.min(BASE_SPEED, g.speed) : g.speed
}

/** Sends a ball upwards at `angle` from straight up (negative to the left). */
function aim(g: Game, ball: Ball, angle: number): void {
  const speed = currentSpeed(g)
  ball.vx = speed * Math.sin(angle)
  ball.vy = -speed * Math.cos(angle) * ASPECT
}

function launch(g: Game): void {
  const ball = g.balls[0]
  if (ball) aim(g, ball, (g.random() < 0.5 ? -1 : 1) * (Math.PI / 6))
  g.phase = 'play'
}

/** Bricks to break until the next bonus: 15 to 20, drawn anew after each drop. */
function nextDropGap(g: Game): number {
  return DROP_EVERY_MIN + Math.floor(g.random() * (DROP_EVERY_MAX - DROP_EVERY_MIN + 1))
}

/** Ends the timed effects and takes the falling bonuses off the field. */
function clearBonuses(g: Game): void {
  g.drops = []
  g.wideLeft = 0
  g.slowLeft = 0
  setPaddleWidth(g, g.baseW)
}

/** Resizes the paddle around its middle, kept inside the field. */
function setPaddleWidth(g: Game, width: number): void {
  if (width === g.paddleW) return
  const middle = g.paddleX + g.paddleW / 2
  g.paddleW = width
  g.paddleX = Math.min(g.w - width, Math.max(0, Math.round(middle - width / 2)))
}

/** Gives the balls the pace they should have after the slow effect started or ended. */
function rescale(g: Game, from: number): void {
  const to = currentSpeed(g)
  if (to === from) return
  for (const b of g.balls) {
    b.vx *= to / from
    b.vy *= to / from
  }
}

/** The bonuses that make sense right now; an extra life only below a full set. */
function candidates(g: Game): PowerKind[] {
  const list: PowerKind[] = ['wide']
  if (g.balls.length < MAX_BALLS) list.push('ball')
  // On the first wall the ball already runs at the first level's pace.
  if (g.speed > BASE_SPEED) list.push('slow')
  if (g.lives < START_LIVES) list.push('life')
  return list
}

function dropBonus(g: Game, col: number, row: number): void {
  const list = candidates(g)
  const kind = list[Math.floor(g.random() * list.length)] ?? 'wide'
  g.drops.push({ kind, x: col, y: row })
}

function collect(g: Game, kind: PowerKind): void {
  if (kind === 'life') {
    g.lives = Math.min(START_LIVES, g.lives + 1)
  } else if (kind === 'wide') {
    g.wideLeft = WIDE_TICKS
    setPaddleWidth(g, Math.min(g.w, Math.round(g.baseW * WIDE_FACTOR)))
  } else if (kind === 'slow') {
    const from = currentSpeed(g)
    g.slowLeft = SLOW_TICKS
    rescale(g, from)
  } else {
    const first = g.balls[0]
    if (!first || g.balls.length >= MAX_BALLS) return
    // The new ball leaves the first one's place upwards, to the other side.
    const side = first.vx > 0 ? -1 : first.vx < 0 ? 1 : g.random() < 0.5 ? -1 : 1
    const extra: Ball = { x: first.x, y: first.y, vx: 0, vy: 0 }
    aim(g, extra, side * (Math.PI / 6))
    g.balls.push(extra)
  }
}

/** Counts one broken brick; every 15 to 20 of them a bonus drops from its place. */
function brickBroken(g: Game, col: number, row: number): void {
  g.untilDrop -= 1
  if (g.untilDrop > 0) return
  g.untilDrop = nextDropGap(g)
  dropBonus(g, col, row)
}

export function bricksLeft(g: Game): number {
  return g.bricks.reduce((n, b) => n + (b > 0 ? 1 : 0), 0)
}

/** The brick index under a cell, or -1 for a gap or outside the wall. */
export function brickAt(g: Game, col: number, row: number): number {
  const r = row - BRICK_TOP
  if (r < 0 || r >= g.brickRows) return -1
  const x = col - g.brickLeft
  if (x < 0) return -1
  const c = Math.floor(x / BRICK_STEP)
  if (c >= g.brickCols || x % BRICK_STEP >= BRICK_W) return -1
  return r * g.brickCols + c
}

/** Applies one action; true when something changed. */
export function press(g: Game, action: Action): boolean {
  // A finished game stands still; the arcade starts the next one.
  if (g.phase === 'over') return false
  if (action === 'left') return movePaddle(g, -PADDLE_STEP)
  if (action === 'right') return movePaddle(g, PADDLE_STEP)
  if ((action === 'primary' || action === 'up') && g.phase === 'ready') {
    launch(g)
    return true
  }
  return false
}

function movePaddle(g: Game, dx: number): boolean {
  const x = Math.min(g.w - g.paddleW, Math.max(0, g.paddleX + dx))
  if (x === g.paddleX) return false
  g.paddleX = x
  if (g.phase === 'ready') parkBall(g)
  return true
}

export type StepResult = 'none' | 'moved' | 'lost' | 'over' | 'cleared'

/** Advances the game one frame: the balls, the falling bonuses and the effect timers. */
export function tick(g: Game): StepResult {
  if (g.phase !== 'play') return 'none'
  for (let i = 0; i < SUBSTEPS; i++) {
    for (const ball of [...g.balls]) {
      const r = step(g, ball, 1 / SUBSTEPS)
      if (r === 'cleared') return r
      if (r === 'out') {
        g.balls.splice(g.balls.indexOf(ball), 1)
        // A life is lost only when the last ball is gone.
        if (g.balls.length === 0) return loseLife(g)
      }
    }
  }
  fall(g)
  runDown(g)
  return 'moved'
}

/** A life less: the bonuses in play end and the next ball waits on the paddle. */
function loseLife(g: Game): StepResult {
  g.lives -= 1
  clearBonuses(g)
  if (g.lives <= 0) {
    g.phase = 'over'
    g.balls = []
    return 'over'
  }
  g.phase = 'ready'
  parkBall(g)
  return 'lost'
}

/** Moves the falling bonuses; the paddle catches one, a missed one leaves the field. */
function fall(g: Game): void {
  const pr = paddleRow(g)
  const kept: Drop[] = []
  for (const d of g.drops) {
    const prev = Math.floor(d.y)
    d.y += DROP_FALL
    if (prev < pr && Math.floor(d.y) >= pr && d.x >= g.paddleX && d.x < g.paddleX + g.paddleW) collect(g, d.kind)
    else if (d.y < g.h) kept.push(d)
  }
  g.drops = kept
}

/** One tick off each running effect; the paddle shrinks and the pace returns when it ends. */
function runDown(g: Game): void {
  if (g.wideLeft > 0) {
    g.wideLeft -= 1
    if (g.wideLeft === 0) setPaddleWidth(g, g.baseW)
  }
  if (g.slowLeft > 0) {
    const from = currentSpeed(g)
    g.slowLeft -= 1
    if (g.slowLeft === 0) rescale(g, from)
  }
}

function step(g: Game, ball: Ball, dt: number): 'moved' | 'out' | 'cleared' {
  const prevCol = Math.floor(ball.x)
  const prevRow = Math.floor(ball.y)
  ball.x += ball.vx * dt
  ball.y += ball.vy * dt

  if (ball.x < 0) {
    ball.x = -ball.x
    ball.vx = Math.abs(ball.vx)
  } else if (ball.x >= g.w) {
    ball.x = 2 * g.w - ball.x - 0.001
    ball.vx = -Math.abs(ball.vx)
  }
  if (ball.y < 0) {
    ball.y = -ball.y
    ball.vy = Math.abs(ball.vy)
  }

  const col = Math.floor(ball.x)
  const row = Math.floor(ball.y)

  const hit = brickAt(g, col, row)
  if (hit >= 0 && (g.bricks[hit] ?? 0) > 0) {
    const brickRow = Math.floor(hit / g.brickCols)
    g.score += 10 * (g.brickRows - brickRow) * g.level
    g.bricks[hit] = 0
    if (row !== prevRow) ball.vy = -ball.vy
    else if (col !== prevCol) ball.vx = -ball.vx
    else ball.vy = -ball.vy
    if (bricksLeft(g) === 0) {
      g.level += 1
      g.speed = Math.min(MAX_SPEED, g.speed * LEVEL_SPEEDUP)
      buildWall(g)
      // A new wall starts clean: no falling bonus, no running effect, one ball.
      clearBonuses(g)
      g.phase = 'ready'
      parkBall(g)
      return 'cleared'
    }
    brickBroken(g, col, row)
    return 'moved'
  }

  const pr = paddleRow(g)
  if (ball.vy > 0 && row >= pr && prevRow < pr) {
    const left = g.paddleX - 0.5
    const right = g.paddleX + g.paddleW + 0.5
    if (ball.x >= left && ball.x <= right) {
      const rel = Math.max(-1, Math.min(1, (ball.x - (g.paddleX + g.paddleW / 2)) / (g.paddleW / 2)))
      aim(g, ball, rel * (Math.PI / 3))
      ball.y = pr - 0.01
      return 'moved'
    }
  }

  return ball.y >= g.h ? 'out' : 'moved'
}

export const BRICK_COLORS = ['#ff5f5f', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#b388ff']
export const PADDLE_COLOR = '#e0e0e0'
export const BALL_COLOR = '#ffffff'
export const BAR_OFF_COLOR = '#6b6b6b'
export const POWER_COLORS: Record<PowerKind, string> = {
  ball: '#5fe3e3',
  wide: '#ff7ad9',
  slow: '#8ab4ff',
  life: '#ff5f7a',
}

/** The glyph that stands for a bonus, falling or in the corner. */
export function powerGlyph(kind: PowerKind, glyphs: Glyphs): string {
  if (kind === 'ball') return glyphs.powerBall
  if (kind === 'wide') return glyphs.powerWide
  if (kind === 'slow') return glyphs.powerSlow
  return glyphs.life
}

/** Cells of a bar that is `left` of `total` full, never empty while the effect runs. */
export function barCells(left: number, total: number): number {
  return left <= 0 ? 0 : Math.max(1, Math.ceil((left / total) * BAR_W))
}

/**
 * The corner gauges, drawn in the field's last row: the wide paddle at the
 * left, the slow ball at the right. That row sits below the paddle (row h-2),
 * so only a ball already lost or a missed bonus ever passes over it, and both
 * are drawn over the gauge. Keyed by column.
 */
function gauges(g: Game, glyphs: Glyphs): Map<number, Segment> {
  const cells = new Map<number, Segment>()
  const gauge = (kind: PowerKind, left: number, total: number, start: number): void => {
    if (left <= 0) return
    const on = barCells(left, total)
    cells.set(start, { text: powerGlyph(kind, glyphs), color: POWER_COLORS[kind] })
    for (let i = 0; i < BAR_W; i++) {
      const full = i < on
      cells.set(start + 2 + i, { text: full ? glyphs.barOn : glyphs.barOff, color: full ? POWER_COLORS[kind] : BAR_OFF_COLOR })
    }
  }
  gauge('wide', g.wideLeft, WIDE_TICKS, 0)
  gauge('slow', g.slowLeft, SLOW_TICKS, g.w - (BAR_W + 2))
  return cells
}

/** The field as rows of colored runs. */
export function frame(g: Game, glyphs: Glyphs): Frame {
  const rows: Frame = []
  const pr = paddleRow(g)
  const ballAt = new Set(g.phase === 'over' ? [] : g.balls.map(b => `${Math.floor(b.x)},${Math.floor(b.y)}`))
  const dropAt = new Map<string, Drop>()
  for (const d of g.drops) dropAt.set(`${Math.floor(d.x)},${Math.floor(d.y)}`, d)
  const corner = gauges(g, glyphs)
  for (let y = 0; y < g.h; y++) {
    const cells: Segment[] = []
    for (let x = 0; x < g.w; x++) {
      let ch = glyphs.empty
      let color: string | undefined
      const drop = dropAt.get(`${x},${y}`)
      const gauge = y === g.h - 1 ? corner.get(x) : undefined
      if (ballAt.has(`${x},${y}`)) {
        ch = glyphs.ball
        color = BALL_COLOR
      } else if (drop) {
        ch = powerGlyph(drop.kind, glyphs)
        color = POWER_COLORS[drop.kind]
      } else if (y === pr && x >= g.paddleX && x < g.paddleX + g.paddleW) {
        ch = glyphs.paddle
        color = PADDLE_COLOR
      } else {
        const b = brickAt(g, x, y)
        const v = b >= 0 ? (g.bricks[b] ?? 0) : 0
        if (v > 0) {
          ch = glyphs.block
          color = BRICK_COLORS[(v - 1) % BRICK_COLORS.length]
        } else if (gauge) {
          ch = gauge.text
          color = gauge.color
        }
      }
      put(cells, ch, color)
    }
    rows.push(cells)
  }
  return rows
}

function toTick(r: StepResult): TickResult {
  if (r === 'none') return 'none'
  if (r === 'over') return 'over'
  return 'changed'
}

export const bricks: GameDef<Game> = {
  id: 'bricks',
  name: 'bricks.name',
  blurb: 'bricks.blurb',
  help: 'bricks.help',
  sign: glyphs => [{ text: glyphs.block, color: BRICK_COLORS[0] }, { text: glyphs.block, color: BRICK_COLORS[2] }],
  tickMs: 33,
  minW: MIN_W,
  minH: MIN_H,
  maxW: 70,
  maxH: 24,
  create: (w, h) => newGame(w, h),
  key: press,
  tick: g => toTick(tick(g)),
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level, lives: g.lives, maxLives: START_LIVES }),
  frame,
  banner: g => (g.phase === 'ready' ? (g.score === 0 && g.level === 1 ? 'start' : 'continue') : undefined),
}
