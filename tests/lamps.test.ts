import { describe, expect, test } from 'claude-code/testing'

import { FIELD_H, FIELD_W, SIZE, board, flip, lamps, newLamps, pointsFor, press, pressesFor } from '../hooks/games/lamps'
import type { Lamps } from '../hooks/games/lamps'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** A tiny repeatable random source. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** A board with exactly the lamps in `at` lit. */
function lit(at: [number, number][]): Lamps {
  const g = newLamps(seeded(1))
  g.lit = Array.from({ length: SIZE * SIZE }, () => false)
  for (const [x, y] of at) g.lit[y * SIZE + x] = true
  return g
}

describe('lamps', () => {
  test('a press switches the lamp and its four neighbours, and nothing else', () => {
    const g = lit([])
    g.cursor = { x: 2, y: 2 }
    press(g, 'primary')
    const on = g.lit.flatMap((v, i) => (v ? [[i % SIZE, Math.floor(i / SIZE)]] : []))
    expect(on).toEqual([
      [2, 1],
      [1, 2],
      [2, 2],
      [3, 2],
      [2, 3],
    ])
    flip(g.lit, 2, 2)
    expect(g.lit.some(Boolean)).toBe(false)
  })

  test('a lamp in a corner has only two neighbours', () => {
    const g = lit([])
    g.cursor = { x: 0, y: 0 }
    press(g, 'primary')
    expect(g.lit.filter(Boolean)).toHaveLength(3)
  })

  test('the cursor wraps around the edges and the secondary key does nothing', () => {
    const g = lit([[1, 1]])
    g.cursor = { x: 0, y: 0 }
    press(g, 'left')
    press(g, 'up')
    expect(g.cursor).toEqual({ x: SIZE - 1, y: SIZE - 1 })
    expect(press(g, 'secondary')).toBe(false)
    expect(g.presses).toBe(0)
  })

  test('every generated board is solvable and never starts all dark', () => {
    for (let level = 1; level <= 20; level++) {
      for (let seed = 1; seed <= 40; seed++) {
        const b = board(level, seeded(seed * 7 + level))
        expect(b.lit.some(Boolean)).toBe(true)
        expect(b.par).toBe(pressesFor(level))
      }
    }
  })

  test('later levels start with more presses to undo, up to a limit', () => {
    expect(pressesFor(2)).toBeGreaterThan(pressesFor(1))
    expect(pressesFor(99)).toBe(pressesFor(50))
  })

  test('a board from the generator can be played to the end', () => {
    const b = board(3, seeded(11))
    const g = newLamps(seeded(2))
    g.lit = b.lit
    g.par = b.par
    for (const i of solve(b.lit)) {
      g.cursor = { x: i % SIZE, y: Math.floor(i / SIZE) }
      press(g, 'primary')
    }
    expect(g.level).toBe(2)
  })

  test('undoing a board wins it and leads to the next level', () => {
    const g = lit([])
    g.par = 1
    flip(g.lit, 2, 2)
    g.cursor = { x: 2, y: 2 }
    expect(press(g, 'primary')).toBe(true)
    expect(g.level).toBe(2)
    expect(g.presses).toBe(0)
    expect(g.lit.some(Boolean)).toBe(true)
    expect(g.score).toBe(pointsFor(1, 1))
    expect(lamps.banner(g)).toBe('lamps.solved')
    press(g, 'right')
    expect(lamps.banner(g)).toBeUndefined()
    expect(lamps.status(g)).toBe('play')
  })

  test('fewer presses score more, and a board is always worth something', () => {
    expect(pointsFor(4, 3)).toBeGreaterThan(pointsFor(4, 4))
    expect(pointsFor(4, 4)).toBeGreaterThan(pointsFor(4, 9))
    expect(pointsFor(4, 500)).toBeGreaterThan(0)
  })

  test('the score line shows the presses, the level and the score', () => {
    const g = newLamps(seeded(3))
    press(g, 'primary')
    expect(lamps.hud(g)).toEqual({ score: 0, level: 1, extra: { key: 'hud.presses', n: 1 } })
  })

  test('every row of the frame is as wide as the field, in both glyph sets', () => {
    const g = newLamps(seeded(5))
    expectFrames(glyphs => lamps.frame(g, glyphs), FIELD_W, FIELD_H)
    expect(lamps.minW).toBeLessThanOrEqual(26)
    expect(lamps.minH).toBeLessThanOrEqual(11)
  })

  test('lit and dark differ in the glyphs themselves, and the cursor is in brackets', () => {
    const g = lit([[0, 0]])
    g.cursor = { x: 4, y: 4 }
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      expect(glyphs.lampOn).not.toBe(glyphs.lampOff)
      const text = lines(lamps.frame(g, glyphs))
      expect(text[0]!.startsWith(` ${glyphs.lampOn} `)).toBe(true)
      expect(text[0]).toContain(` ${glyphs.lampOff} `)
      expect(text[SIZE * 2 - 2]!.endsWith(`${glyphs.cursorLeft}${glyphs.lampOff}${glyphs.cursorRight}`)).toBe(true)
    }
  })
})

/** Presses (cell indices) that darken `start`, found by trying every set of presses of the first row and chasing the rest. */
function solve(start: boolean[]): number[] {
  for (let mask = 0; mask < 1 << SIZE; mask++) {
    const b = [...start]
    const presses: number[] = []
    for (let x = 0; x < SIZE; x++) if (mask & (1 << x)) presses.push(x)
    for (const i of presses) flip(b, i % SIZE, 0)
    for (let y = 1; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++)
        if (b[(y - 1) * SIZE + x]) {
          presses.push(y * SIZE + x)
          flip(b, x, y)
        }
    if (!b.some(Boolean)) return presses
  }
  throw new Error('unsolvable')
}
