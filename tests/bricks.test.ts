import { describe, expect, test } from 'claude-code/testing'

import {
  BAR_W,
  BASE_SPEED,
  BRICK_STEP,
  BRICK_W,
  DROP_EVERY_MAX,
  DROP_EVERY_MIN,
  MAX_BALLS,
  MAX_SPEED,
  SLOW_TICKS,
  WIDE_TICKS,
  barCells,
  brickAt,
  bricksLeft,
  currentSpeed,
  frame,
  newGame,
  paddleRow,
  press,
  tick,
  START_LIVES,
} from '../hooks/games/bricks'
import type { Ball, Game, PowerKind } from '../hooks/games/bricks'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** Puts the one ball somewhere, moving. */
function setBall(g: Game, x: number, y: number, vx: number, vy: number): Ball {
  const b: Ball = { x, y, vx, vy }
  g.balls = [b]
  return b
}

/** Leaves one brick and sends the ball straight up into it. */
function clearWall(g: Game): void {
  g.bricks = g.bricks.map((_, i) => (i === 0 ? 1 : 0))
  g.phase = 'play'
  setBall(g, g.brickLeft + 0.5, 2 + 1.1, 0, -0.4)
  let r = tick(g)
  while (r === 'moved') r = tick(g)
  expect(r).toBe('cleared')
}

describe('bricks logic', () => {
  test('a new game waits with the ball on the paddle', () => {
    const g = newGame(60, 20)
    expect(g.phase).toBe('ready')
    expect(Math.floor(g.balls[0]!.y)).toBe(paddleRow(g) - 1)
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
    expect(g.balls[0]!.vy).toBeLessThan(0)
  })

  test('a ball that hits a brick removes it and scores', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    const col = g.brickLeft + 1
    const row = 2 + g.brickRows - 1
    const ball = setBall(g, col + 0.5, row + 1.1, 0, -0.4)
    const before = bricksLeft(g)
    for (let i = 0; i < 3; i++) tick(g)
    expect(bricksLeft(g)).toBe(before - 1)
    expect(g.score).toBeGreaterThan(0)
    expect(ball.vy).toBeGreaterThan(0)
    expect(g.bricks[brickAt(g, col, row)]).toBe(0)
  })

  test('the paddle sends the ball back', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    const ball = setBall(g, g.paddleX + g.paddleW / 2, paddleRow(g) - 0.6, 0, 0.3)
    for (let i = 0; i < 3; i++) tick(g)
    expect(ball.vy).toBeLessThan(0)
    expect(g.lives).toBe(START_LIVES)
  })

  test('missing the ball costs a life, the last one ends the game', () => {
    const g = newGame(40, 20)
    for (let life = START_LIVES; life > 0; life--) {
      g.phase = 'play'
      g.paddleX = 0
      setBall(g, g.w - 1, g.h - 0.6, 0, 0.5)
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
    expect(Math.hypot(g.balls[0]!.vx, g.balls[0]!.vy)).toBeLessThanOrEqual(MAX_SPEED)
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
      const ball = g.balls[0]!
      g.paddleX = Math.max(0, Math.min(g.w - g.paddleW, Math.round(ball.x - g.paddleW / 2)))
      tick(g)
      expect(ball.x).toBeGreaterThanOrEqual(0)
      expect(ball.x).toBeLessThan(g.w)
      expect(ball.y).toBeGreaterThanOrEqual(0)
    }
    expect(g.lives).toBe(START_LIVES)
    expect(g.score).toBeGreaterThan(0)
  })
})

/** A game that always draws `values` in turn, then the last one again. */
function scripted(values: number[]): () => number {
  let i = 0
  return () => values[Math.min(i++, values.length - 1)] ?? 0
}

/** Puts the ball just under the lowest row's first brick, moving up into it. */
function aimAtBrick(g: Game): void {
  setBall(g, g.brickLeft + 0.5, 2 + g.brickRows - 1 + 1.1, 0, -0.4)
}

/** A game in the air whose next broken brick drops a bonus. */
function aboutToDrop(random: () => number): Game {
  const g = newGame(40, 20, random)
  g.phase = 'play'
  g.untilDrop = 1
  aimAtBrick(g)
  return g
}

/** Puts a bonus right above the paddle, about to be caught. */
function dropOnPaddle(g: Game, kind: PowerKind): void {
  g.drops = [{ kind, x: g.paddleX + 1, y: paddleRow(g) - 0.05 }]
}

/** A game in the air with the ball parked out of the way. */
function quietGame(w = 40, h = 20): Game {
  const g = newGame(w, h)
  g.phase = 'play'
  setBall(g, 1, 3, 0, 0)
  return g
}

describe('bricks power-ups', () => {
  test('the gap to the next bonus is drawn between 15 and 20 bricks', () => {
    expect(newGame(40, 20, () => 0).untilDrop).toBe(DROP_EVERY_MIN)
    expect(newGame(40, 20, () => 0.999).untilDrop).toBe(DROP_EVERY_MAX)
  })

  test('a bonus drops after the drawn number of bricks, and the next count is drawn anew', () => {
    // Draws: the first gap 15, then the next gap 20 and the bonus kind.
    const g = newGame(80, 24, scripted([0, 0.999, 0]))
    expect(g.untilDrop).toBe(15)
    g.phase = 'play'
    let broken = 0
    const breakOne = (): void => {
      const i = g.bricks.findLastIndex(b => b > 0)
      const col = g.brickLeft + (i % g.brickCols) * BRICK_STEP
      const row = 2 + Math.floor(i / g.brickCols)
      setBall(g, col + 0.5, row + 1.1, 0, -0.4)
      for (let n = 0; n < 4 && g.bricks[i]! > 0; n++) tick(g)
      broken++
    }
    while (g.drops.length === 0 && broken < 100) breakOne()
    expect(broken).toBe(15)
    expect(g.untilDrop).toBe(20)
    while (g.drops.length === 1 && broken < 100) breakOne()
    expect(broken).toBe(35)
  })

  test('the count carries across walls', () => {
    const g = newGame(40, 20, () => 0)
    g.untilDrop = 9
    clearWall(g)
    // The last brick of a wall counts too.
    expect(g.untilDrop).toBeLessThanOrEqual(9)
    expect(g.untilDrop).toBeGreaterThan(0)
  })

  test('nothing drops before the count is used up', () => {
    const g = aboutToDrop(() => 0)
    g.untilDrop = 15
    for (let i = 0; i < 3; i++) tick(g)
    expect(g.drops).toHaveLength(0)
    expect(g.untilDrop).toBe(14)
  })

  test('an extra life only drops below three lives', () => {
    // The kind is picked by a draw of 0.999: the last one offered.
    const full = aboutToDrop(scripted([0, 0.999]))
    for (let i = 0; i < 3; i++) tick(full)
    expect(full.drops).toHaveLength(1)
    expect(full.drops[0]!.kind).not.toBe('life')

    const hurt = aboutToDrop(scripted([0, 0.999]))
    hurt.lives = 2
    for (let i = 0; i < 3; i++) tick(hurt)
    expect(hurt.drops[0]!.kind).toBe('life')
  })

  test('slow ball is only offered once the wall is faster than the first level', () => {
    const seen = new Set<PowerKind>()
    for (let i = 0; i < 10; i++) {
      const g = aboutToDrop(scripted([0, i / 10]))
      for (let n = 0; n < 3; n++) tick(g)
      for (const d of g.drops) seen.add(d.kind)
    }
    expect(seen.has('slow')).toBe(false)
    expect(seen.has('life')).toBe(false)
    expect(seen.has('wide') && seen.has('ball')).toBe(true)

    const fast = aboutToDrop(scripted([0, 0.99]))
    fast.speed = 0.7
    fast.lives = START_LIVES
    for (let n = 0; n < 3; n++) tick(fast)
    expect(fast.drops[0]!.kind).toBe('slow')
  })

  test('a bonus falls straight down; a missed one falls out and does nothing', () => {
    const g = quietGame()
    g.paddleX = 0
    g.lives = 1
    g.drops = [{ kind: 'life', x: 30, y: 8 }]
    tick(g)
    expect(g.drops[0]!.x).toBe(30)
    expect(g.drops[0]!.y).toBeGreaterThan(8)
    for (let i = 0; i < 100; i++) tick(g)
    expect(g.drops).toHaveLength(0)
    expect(g.lives).toBe(1)
  })

  test('catching an extra life gives one life, never more than three', () => {
    const g = quietGame()
    g.lives = 1
    dropOnPaddle(g, 'life')
    for (let i = 0; i < 3; i++) tick(g)
    expect(g.drops).toHaveLength(0)
    expect(g.lives).toBe(2)
    g.lives = START_LIVES
    dropOnPaddle(g, 'life')
    for (let i = 0; i < 3; i++) tick(g)
    expect(g.lives).toBe(START_LIVES)
  })

  test('extra ball adds a ball that goes up the other way; a life is lost only with the last one', () => {
    const g = newGame(40, 20, () => 0.5)
    g.phase = 'play'
    const first = setBall(g, 20, 10, 0.3, -0.2)
    dropOnPaddle(g, 'ball')
    for (let i = 0; i < 3; i++) tick(g)
    expect(g.balls).toHaveLength(2)
    const second = g.balls[1]!
    expect(second.vx).toBeLessThan(0)
    expect(second.vy).toBeLessThan(0)
    expect(first.vx).toBeGreaterThan(0)

    // The first ball falls out: the game goes on with the second.
    first.x = 0.5
    first.y = g.h - 0.2
    first.vx = 0
    first.vy = 0.5
    second.x = 20
    second.y = 6
    second.vx = 0
    second.vy = -0.01
    g.paddleX = 30
    expect(tick(g)).toBe('moved')
    expect(g.balls).toHaveLength(1)
    expect(g.lives).toBe(START_LIVES)
    expect(g.phase).toBe('play')

    // Now the last one falls out.
    const last = g.balls[0]!
    last.x = 0.5
    last.y = g.h - 0.2
    last.vx = 0
    last.vy = 0.5
    expect(tick(g)).toBe('lost')
    expect(g.lives).toBe(START_LIVES - 1)
    expect(g.phase).toBe('ready')
    expect(g.balls).toHaveLength(1)
  })

  test('extra balls stop at a limit', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    setBall(g, 20, 10, 0.3, -0.2)
    for (let i = 0; i < MAX_BALLS + 3; i++) {
      dropOnPaddle(g, 'ball')
      tick(g)
    }
    expect(g.balls).toHaveLength(MAX_BALLS)
  })

  test('wide paddle grows around its middle, runs down with the ticks, then shrinks back', () => {
    const g = quietGame(60, 20)
    const base = g.paddleW
    const middle = g.paddleX + base / 2
    dropOnPaddle(g, 'wide')
    tick(g)
    expect(g.paddleW).toBeGreaterThan(base)
    expect(Math.abs(g.paddleX + g.paddleW / 2 - middle)).toBeLessThanOrEqual(1)
    expect(g.wideLeft).toBe(WIDE_TICKS - 1)
    tick(g)
    expect(g.wideLeft).toBe(WIDE_TICKS - 2)
    g.wideLeft = 1
    tick(g)
    expect(g.wideLeft).toBe(0)
    expect(g.paddleW).toBe(base)
  })

  test('a wide paddle at the edge stays inside the field', () => {
    const g = quietGame()
    g.paddleX = g.w - g.paddleW
    dropOnPaddle(g, 'wide')
    tick(g)
    expect(g.paddleX + g.paddleW).toBeLessThanOrEqual(g.w)
    g.wideLeft = 1
    tick(g)
    expect(g.paddleX + g.paddleW).toBeLessThanOrEqual(g.w)
  })

  test('slow ball brings the balls to the first level pace, and the pace returns afterwards', () => {
    const g = newGame(40, 20)
    clearWall(g)
    clearWall(g)
    expect(g.speed).toBeGreaterThan(BASE_SPEED)
    const fast = g.speed
    press(g, 'primary')
    const ball = g.balls[0]!
    const pace = (): number => Math.hypot(ball.vx, ball.vy / 0.5)
    const near = (a: number, b: number): void => expect(Math.abs(a - b) < 1e-6).toBe(true)
    near(pace(), fast)
    ball.x = 30
    ball.y = 8
    dropOnPaddle(g, 'slow')
    tick(g)
    expect(g.slowLeft).toBe(SLOW_TICKS - 1)
    expect(currentSpeed(g)).toBe(BASE_SPEED)
    near(pace(), BASE_SPEED)
    g.slowLeft = 1
    tick(g)
    expect(g.slowLeft).toBe(0)
    near(pace(), fast)
  })

  test('a paused game keeps its bonuses and timers: they move only with ticks', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    setBall(g, 20, 8, 0.2, 0.1)
    g.drops = [{ kind: 'wide', x: 3, y: 6 }]
    g.wideLeft = 400
    g.slowLeft = 300
    const state = (): string => JSON.stringify({ ...g, random: 0 })
    const before = state()
    // The arcade stops calling tick while paused; drawing and keys that do
    // nothing leave the state exactly as it was.
    for (let i = 0; i < 1000; i++) frame(g, GLYPHS.unicode)
    press(g, 'up')
    expect(state()).toBe(before)
    tick(g)
    expect(g.wideLeft).toBe(399)
    expect(g.slowLeft).toBe(299)
    expect(g.drops[0]!.y).toBeGreaterThan(6)
  })

  test('losing a life ends the effects and the falling bonuses; the paddle is its old size', () => {
    const g = newGame(40, 20)
    g.phase = 'play'
    const base = g.paddleW
    g.wideLeft = 300
    g.slowLeft = 300
    g.paddleW = base + 3
    g.drops = [{ kind: 'wide', x: 3, y: 4 }]
    setBall(g, 0.5, g.h - 0.2, 0, 0.5)
    g.paddleX = 30
    expect(tick(g)).toBe('lost')
    expect(g.wideLeft).toBe(0)
    expect(g.slowLeft).toBe(0)
    expect(g.drops).toHaveLength(0)
    expect(g.paddleW).toBe(base)
    expect(g.balls).toHaveLength(1)
  })

  test('clearing a wall ends the effects and the falling bonuses and leaves one ball', () => {
    const g = newGame(40, 20)
    g.wideLeft = 300
    g.slowLeft = 300
    g.drops = [{ kind: 'ball', x: 3, y: 4 }]
    clearWall(g)
    expect(g.wideLeft).toBe(0)
    expect(g.slowLeft).toBe(0)
    expect(g.drops).toHaveLength(0)
    expect(g.paddleW).toBe(g.baseW)
    expect(g.balls).toHaveLength(1)
    expect(g.phase).toBe('ready')
  })

  test('the bar runs down with the time and is never empty while the effect runs', () => {
    expect(barCells(WIDE_TICKS, WIDE_TICKS)).toBe(BAR_W)
    expect(barCells(WIDE_TICKS / 2, WIDE_TICKS)).toBe(BAR_W / 2)
    expect(barCells(1, WIDE_TICKS)).toBe(1)
    expect(barCells(0, WIDE_TICKS)).toBe(0)
  })

  test('each bonus and both gauges are drawn, told apart without colors, and hide nothing', () => {
    const g = newGame(50, 18)
    g.phase = 'play'
    g.wideLeft = WIDE_TICKS
    g.slowLeft = SLOW_TICKS / 2
    setBall(g, 25.5, 10.5, 0, 0)
    g.drops = [
      { kind: 'ball', x: 5, y: 8 },
      { kind: 'wide', x: 10, y: 8 },
      { kind: 'slow', x: 15, y: 8 },
      { kind: 'life', x: 20, y: 8 },
      { kind: 'wide', x: 25, y: 10 },
    ]
    expectFrames(glyphs => frame(g, glyphs), g.w, g.h)
    for (const set of ['unicode', 'ascii'] as const) {
      const glyphs = GLYPHS[set]
      const rows = lines(frame(g, glyphs))
      const symbols = [glyphs.powerBall, glyphs.powerWide, glyphs.powerSlow, glyphs.life]
      expect(new Set(symbols).size).toBe(4)
      for (const other of [glyphs.ball, glyphs.paddle, glyphs.block, glyphs.empty]) expect(symbols).not.toContain(other)
      expect(rows[8]![5]).toBe(glyphs.powerBall)
      expect(rows[8]![10]).toBe(glyphs.powerWide)
      expect(rows[8]![15]).toBe(glyphs.powerSlow)
      expect(rows[8]![20]).toBe(glyphs.life)
      // A ball in the same cell as a bonus is the one that shows.
      expect(rows[10]![25]).toBe(glyphs.ball)
      // The gauges in the last row: wide at the left, slow (half full) at the right.
      const last = rows[g.h - 1]!
      expect(last.startsWith(glyphs.powerWide + ' ' + glyphs.barOn.repeat(BAR_W))).toBe(true)
      expect(last.endsWith(glyphs.powerSlow + ' ' + glyphs.barOn.repeat(3) + glyphs.barOff.repeat(3))).toBe(true)
      // The paddle row and the wall are untouched.
      expect(rows[paddleRow(g)]!.includes(glyphs.paddle.repeat(g.paddleW))).toBe(true)
      expect(rows[2]!.split(glyphs.block).length - 1).toBe(g.brickCols * BRICK_W)
    }
  })

  test('with no effect running the last row is empty', () => {
    const g = newGame(50, 18)
    expect(lines(frame(g, GLYPHS.ascii))[g.h - 1]).toBe(' '.repeat(g.w))
  })
})
