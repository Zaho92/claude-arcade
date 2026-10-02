import { describe, expect, test } from 'claude-code/testing'

import { MAX_SPEED, brickAt, bricksLeft, frame, newGame, paddleRow, press, tick, START_LIVES } from '../hooks/games/bricks'
import type { Game } from '../hooks/games/bricks'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** Leaves one brick and sends the ball straight up into it. */
function clearWall(g: Game): void {
  g.bricks = g.bricks.map((_, i) => (i === 0 ? 1 : 0))
  g.phase = 'play'
  g.ballX = g.brickLeft + 0.5
  g.ballY = 2 + 1.1
  g.vx = 0
  g.vy = -0.4
  let r = tick(g)
  while (r === 'moved') r = tick(g)
  expect(r).toBe('cleared')
}

describe('bricks logic', () => {
  test('a new game waits with the ball on the paddle', () => {
    const g = newGame(60, 20)
    expect(g.phase).toBe('ready')
    expect(Math.floor(g.ballY)).toBe(paddleRow(g) - 1)
    expect(bricksLeft(g)).toBe(g.brickCols * g.brickRows)
    expect(tick(g)).toBe('none')
  })

  test('the paddle moves and stays inside the field', () => {
    const g = newGame(40, 20)
    for (let i = 0; i < 50; i++) press(g, 'left')
    expect(g.paddleX).toBe(0)
    for (let i = 0; i < 50; i++) press(g, 'right')
    expect(g.paddleX).toBe(g.w - g.paddleW)
  })

  test('space launches the ball upwards', () => {
    const g = newGame(40, 20)
    press(g, 'primary')
    expect(g.phase).toBe('play')
    expect(g.vy).toBeLessThan(0)
  })

  test('a ball that hits a brick removes it and scores', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    const col = g.brickLeft + 1
    const row = 2 + g.brickRows - 1
    g.ballX = col + 0.5
    g.ballY = row + 1.1
    g.vx = 0
    g.vy = -0.4
    const before = bricksLeft(g)
    for (let i = 0; i < 3; i++) tick(g)
    expect(bricksLeft(g)).toBe(before - 1)
    expect(g.score).toBeGreaterThan(0)
    expect(g.vy).toBeGreaterThan(0)
    expect(g.bricks[brickAt(g, col, row)]).toBe(0)
  })

  test('the paddle sends the ball back', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    g.ballX = g.paddleX + g.paddleW / 2
    g.ballY = paddleRow(g) - 0.6
    g.vx = 0
    g.vy = 0.3
    for (let i = 0; i < 3; i++) tick(g)
    expect(g.vy).toBeLessThan(0)
    expect(g.lives).toBe(START_LIVES)
  })

  test('missing the ball costs a life, the last one ends the game', () => {
    const g = newGame(40, 20)
    for (let life = START_LIVES; life > 0; life--) {
      g.phase = 'play'
      g.paddleX = 0
      g.ballX = g.w - 1
      g.ballY = g.h - 0.6
      g.vx = 0
      g.vy = 0.5
      let r = tick(g)
      while (r === 'moved') r = tick(g)
      expect(r).toBe(life === 1 ? 'over' : 'lost')
    }
    expect(g.phase).toBe('over')
  })

  test('a finished game stands still: the arcade starts the next one, not a key', () => {
    const g = newGame(40, 20)
    g.phase = 'over'
    const before = JSON.stringify(g)
    for (const key of ['left', 'right', 'up', 'down', 'primary', 'secondary'] as const) expect(press(g, key)).toBe(false)
    expect(tick(g)).toBe('none')
    expect(JSON.stringify(g)).toBe(before)
  })

  test('clearing the wall starts the next level, a little faster', () => {
    const g = newGame(40, 20)
    const speed = g.speed
    clearWall(g)
    expect(g.level).toBe(2)
    expect(g.phase).toBe('ready')
    expect(g.speed).toBeGreaterThan(speed)
    expect(bricksLeft(g)).toBe(g.brickCols * g.brickRows)
  })

  test('the ball stops getting faster at a pace the paddle can still meet', () => {
    const g = newGame(40, 20)
    for (let level = 1; level < 30; level++) clearWall(g)
    expect(g.level).toBe(30)
    expect(g.speed).toBe(MAX_SPEED)
    press(g, 'primary')
    expect(Math.hypot(g.vx, g.vy)).toBeLessThanOrEqual(MAX_SPEED)
  })

  test('every row of the frame is as wide as the field, in both glyph sets', () => {
    const g = newGame(50, 18)
    expectFrames(glyphs => frame(g, glyphs), g.w, g.h)
    const text = lines(frame(g, GLYPHS.ascii)).join('')
    expect(text).toContain('#')
    expect(text).toContain('=')
    expect(text).toContain('o')
  })

  test('a long rally never leaves the field', () => {
    const g = newGame(45, 20)
    press(g, 'primary')
    for (let i = 0; i < 3000 && g.phase === 'play'; i++) {
      g.paddleX = Math.max(0, Math.min(g.w - g.paddleW, Math.round(g.ballX - g.paddleW / 2)))
      tick(g)
      expect(g.ballX).toBeGreaterThanOrEqual(0)
      expect(g.ballX).toBeLessThan(g.w)
      expect(g.ballY).toBeGreaterThanOrEqual(0)
    }
    expect(g.lives).toBe(START_LIVES)
    expect(g.score).toBeGreaterThan(0)
  })
})
