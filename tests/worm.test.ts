import { describe, expect, test } from 'claude-code/testing'

import { framesPerStep, newWorm, press, step, tick, worm } from '../hooks/games/worm'
import type { Worm } from '../hooks/games/worm'
import { expectFrames } from './frames'

// Food always in the first free cell: (0,0) unless the worm is there.
const first = () => 0

function playing(w = 40, h = 12): Worm {
  const g = newWorm(w, h, first)
  press(g, 'primary')
  return g
}

describe('worm', () => {
  test('waits, then starts on Space or a direction', () => {
    const g = newWorm(40, 12, first)
    expect(g.phase).toBe('ready')
    expect(tick(g)).toBe('none')
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'up')).toBe(true)
    expect(g.phase).toBe('play')
  })

  test('moves one cell per step and keeps its length', () => {
    const g = playing()
    const head = { ...g.body[0]! }
    step(g)
    expect(g.body[0]).toEqual({ x: head.x + 1, y: head.y })
    expect(g.body).toHaveLength(4)
  })

  test('steps on the clock, not every frame', () => {
    const g = playing()
    const head = { ...g.body[0]! }
    let moved = 0
    for (let i = 0; i < 8; i++) if (tick(g) === 'changed') moved++
    expect(moved).toBe(2)
    expect(g.body[0]!.x).toBe(head.x + 2)
  })

  test('cannot turn straight back, and keeps two quick turns', () => {
    const g = playing()
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'up')).toBe(true)
    expect(press(g, 'left')).toBe(true)
    expect(press(g, 'down')).toBe(false)
    step(g)
    expect(g.dir).toBe('up')
    step(g)
    expect(g.dir).toBe('left')
  })

  test('eating grows the worm, scores and moves the food', () => {
    const g = playing()
    const head = g.body[0]!
    g.food = { x: head.x + 1, y: head.y }
    step(g)
    expect(g.body).toHaveLength(5)
    expect(g.score).toBe(10)
    expect(g.food).not.toEqual({ x: head.x + 1, y: head.y })
  })

  test('the wall ends the game', () => {
    const g = playing()
    let r = step(g)
    for (let i = 0; i < 100 && r !== 'over'; i++) r = step(g)
    expect(r).toBe('over')
    expect(g.phase).toBe('over')
    expect(g.isWon).toBe(false)
    // A crash gets the arcade's usual game-over line.
    expect(worm.banner(g)).toBeUndefined()
    expect(press(g, 'up')).toBe(false)
  })

  test('filling the whole board is a win, with a line of its own', () => {
    const g = playing()
    g.cols = 2
    g.rows = 2
    g.body = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]
    g.dir = 'right'
    g.food = { x: 1, y: 0 }
    expect(step(g)).toBe('over')
    expect(g.body).toHaveLength(4)
    expect(g.isWon).toBe(true)
    expect(worm.status(g)).toBe('over')
    expect(worm.banner(g)).toBe('worm.won')
  })

  test('biting itself ends the game', () => {
    const g = playing()
    g.body = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 6 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ]
    g.dir = 'down'
    expect(step(g)).toBe('over')
  })

  test('moving into the cell the tail leaves is fine', () => {
    const g = playing()
    g.body = [
      { x: 5, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
      { x: 6, y: 5 },
    ]
    g.dir = 'right'
    expect(step(g)).toBe('changed')
  })

  test('gets faster every five pieces of food, down to two frames a step', () => {
    const g = playing(48, 12)
    const eat = (pieces: number) => {
      for (let i = 0; i < pieces; i++) {
        const head = g.body[0]!
        g.food = { x: head.x + 1, y: head.y }
        g.dir = 'right'
        step(g)
        g.body = g.body.map(c => ({ x: c.x - 1, y: c.y }))
      }
    }
    expect(framesPerStep(g)).toBe(4)
    eat(5)
    expect(g.level).toBe(2)
    expect(framesPerStep(g)).toBe(3)
    // The clock follows: the next step comes after three frames, not four.
    g.wait = 1
    tick(g)
    let frames = 1
    while (tick(g) === 'none') frames++
    expect(frames).toBe(3)

    eat(10)
    expect(g.level).toBe(4)
    expect(framesPerStep(g)).toBe(2)
  })

  test('every row of the frame is as wide as the field, in both glyph sets', () => {
    const g = newWorm(41, 10, first)
    expect(g.w % 2).toBe(0)
    expectFrames(glyphs => worm.frame(g, glyphs), g.w, g.h)
  })
})
