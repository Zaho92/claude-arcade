// Bricks (ball and paddle) as pure logic: no drawing, no input, no clock. The arcade host
// feeds it actions and ticks; the tests drive it directly.

import type { Glyphs } from '../glyphs'
import { put } from './types'
import type { Action, Frame, GameDef, Segment, Status, TickResult } from './types'

export type Game = {
  w: number
  h: number
  paddleX: number
  paddleW: number
  ballX: number
  ballY: number
  vx: number
  vy: number
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
const BASE_SPEED = 0.55
// Each cleared wall speeds the ball up, to a pace the paddle can still meet.
const LEVEL_SPEEDUP = 1.12
export const MAX_SPEED = 1
const SUBSTEPS = 4
const PADDLE_STEP = 3
// Terminal cells are about twice as tall as wide: vertical speed is halved
// so the ball's path looks the angle it is.
const ASPECT = 0.5

export const MIN_W = 25
export const MIN_H = 14

export function paddleRow(g: Game): number {
  return g.h - 2
}

export function newGame(w: number, h: number): Game {
  const width = Math.max(MIN_W, Math.floor(w))
  const height = Math.max(MIN_H, Math.floor(h))
  const g: Game = {
    w: width,
    h: height,
    paddleX: 0,
    paddleW: Math.max(5, Math.round(width / 6)),
    ballX: 0,
    ballY: 0,
    vx: 0,
    vy: 0,
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

function parkBall(g: Game): void {
  g.ballX = g.paddleX + g.paddleW / 2
  g.ballY = paddleRow(g) - 0.5
  g.vx = 0
  g.vy = 0
}

function launch(g: Game): void {
  const angle = (Math.random() < 0.5 ? -1 : 1) * (Math.PI / 6)
  g.vx = g.speed * Math.sin(angle)
  g.vy = -g.speed * Math.cos(angle) * ASPECT
  g.phase = 'play'
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

/** Advances the ball one frame. */
export function tick(g: Game): StepResult {
  if (g.phase !== 'play') return 'none'
  for (let i = 0; i < SUBSTEPS; i++) {
    const r = step(g, 1 / SUBSTEPS)
    if (r !== 'moved') return r
  }
  return 'moved'
}

function step(g: Game, dt: number): StepResult {
  const prevCol = Math.floor(g.ballX)
  const prevRow = Math.floor(g.ballY)
  g.ballX += g.vx * dt
  g.ballY += g.vy * dt

  if (g.ballX < 0) {
    g.ballX = -g.ballX
    g.vx = Math.abs(g.vx)
  } else if (g.ballX >= g.w) {
    g.ballX = 2 * g.w - g.ballX - 0.001
    g.vx = -Math.abs(g.vx)
  }
  if (g.ballY < 0) {
    g.ballY = -g.ballY
    g.vy = Math.abs(g.vy)
  }

  const col = Math.floor(g.ballX)
  const row = Math.floor(g.ballY)

  const hit = brickAt(g, col, row)
  if (hit >= 0 && (g.bricks[hit] ?? 0) > 0) {
    const brickRow = Math.floor(hit / g.brickCols)
    g.score += 10 * (g.brickRows - brickRow) * g.level
    g.bricks[hit] = 0
    if (row !== prevRow) g.vy = -g.vy
    else if (col !== prevCol) g.vx = -g.vx
    else g.vy = -g.vy
    if (bricksLeft(g) === 0) {
      g.level += 1
      g.speed = Math.min(MAX_SPEED, g.speed * LEVEL_SPEEDUP)
      buildWall(g)
      g.phase = 'ready'
      parkBall(g)
      return 'cleared'
    }
    return 'moved'
  }

  const pr = paddleRow(g)
  if (g.vy > 0 && row >= pr && prevRow < pr) {
    const left = g.paddleX - 0.5
    const right = g.paddleX + g.paddleW + 0.5
    if (g.ballX >= left && g.ballX <= right) {
      const rel = Math.max(-1, Math.min(1, (g.ballX - (g.paddleX + g.paddleW / 2)) / (g.paddleW / 2)))
      const angle = rel * (Math.PI / 3)
      g.vx = g.speed * Math.sin(angle)
      g.vy = -g.speed * Math.cos(angle) * ASPECT
      g.ballY = pr - 0.01
      return 'moved'
    }
  }

  if (g.ballY >= g.h) {
    g.lives -= 1
    if (g.lives <= 0) {
      g.phase = 'over'
      return 'over'
    }
    g.phase = 'ready'
    parkBall(g)
    return 'lost'
  }
  return 'moved'
}

export const BRICK_COLORS = ['#ff5f5f', '#ff9f43', '#ffd93d', '#6bcb77', '#4d96ff', '#b388ff']
export const PADDLE_COLOR = '#e0e0e0'
export const BALL_COLOR = '#ffffff'

/** The field as rows of colored runs. */
export function frame(g: Game, glyphs: Glyphs): Frame {
  const rows: Frame = []
  const pr = paddleRow(g)
  const ballCol = Math.floor(g.ballX)
  const ballRow = Math.floor(g.ballY)
  for (let y = 0; y < g.h; y++) {
    const cells: Segment[] = []
    for (let x = 0; x < g.w; x++) {
      let ch = glyphs.empty
      let color: string | undefined
      if (g.phase !== 'over' && x === ballCol && y === ballRow) {
        ch = glyphs.ball
        color = BALL_COLOR
      } else if (y === pr && x >= g.paddleX && x < g.paddleX + g.paddleW) {
        ch = glyphs.paddle
        color = PADDLE_COLOR
      } else {
        const b = brickAt(g, x, y)
        const v = b >= 0 ? (g.bricks[b] ?? 0) : 0
        if (v > 0) {
          ch = glyphs.block
          color = BRICK_COLORS[(v - 1) % BRICK_COLORS.length]
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
  tickMs: 33,
  minW: MIN_W,
  minH: MIN_H,
  maxW: 70,
  maxH: 24,
  create: newGame,
  key: press,
  tick: g => toTick(tick(g)),
  status: g => g.phase,
  hud: g => ({ score: g.score, level: g.level, lives: g.lives, maxLives: START_LIVES }),
  frame,
  banner: g => (g.phase === 'ready' ? (g.score === 0 && g.level === 1 ? 'start' : 'continue') : undefined),
}
