import { describe, expect, test } from 'claude-code/testing'

import { COLS, FIELD_W, blocks, cellsOf, dropDistance, fits, newBlocks, press, tick } from '../hooks/games/blocks'
import type { Blocks, Kind } from '../hooks/games/blocks'
import { GLYPHS } from '../hooks/glyphs'

// A bag that is never shuffled: I, O, T, S, Z, J, L.
const ordered = () => 0.999

function playing(): Blocks {
  const g = newBlocks(0, 20, ordered)
  press(g, 'primary')
  return g
}

function fillRow(g: Blocks, y: number, gapAt?: number): void {
  g.well[y] = Array.from({ length: COLS }, (_, x): Kind | undefined => (x === gapAt ? undefined : 'O'))
}

describe('blocks', () => {
  test('waits for Space, then pieces fall on the clock', () => {
    const g = newBlocks(0, 20, ordered)
    expect(g.phase).toBe('ready')
    expect(press(g, 'left')).toBe(false)
    press(g, 'primary')
    const y = g.piece.y
    for (let i = 0; i < 25; i++) tick(g)
    expect(g.piece.y).toBe(y + 1)
  })

  test('every kind comes once per bag of seven', () => {
    const g = newBlocks(0, 20, Math.random)
    const seen = new Set<Kind>([g.piece.kind, g.next])
    while (seen.size < 7 && g.bag.length > 0) seen.add(g.bag.shift()!)
    expect(seen.size).toBe(7)
  })

  test('moves inside the well and stops at the walls', () => {
    const g = playing()
    for (let i = 0; i < 20; i++) press(g, 'left')
    expect(Math.min(...cellsOf(g.piece).map(c => c.x))).toBe(0)
    for (let i = 0; i < 20; i++) press(g, 'right')
    expect(Math.max(...cellsOf(g.piece).map(c => c.x))).toBe(COLS - 1)
  })

  test('turns, and kicks off a wall when needed', () => {
    const g = playing()
    expect(g.piece.kind).toBe('I')
    press(g, 'down')
    press(g, 'down')
    expect(press(g, 'up')).toBe(true)
    for (let i = 0; i < 10; i++) press(g, 'right')
    expect(press(g, 'up')).toBe(true)
    expect(fits(g, cellsOf(g.piece))).toBe(true)
  })

  test('Space drops the piece to the bottom and the next one comes', () => {
    const g = playing()
    const d = dropDistance(g)
    press(g, 'primary')
    expect(g.well[g.rows - 1]?.filter(Boolean)).toHaveLength(4)
    expect(g.score).toBe(2 * d)
    expect(g.piece.kind).toBe('O')
  })

  test('a full row clears and scores', () => {
    const g = playing()
    fillRow(g, g.rows - 1, 9)
    // An upright I into the gap on the right.
    press(g, 'up')
    for (let i = 0; i < 10; i++) press(g, 'right')
    press(g, 'primary')
    expect(g.lines).toBe(1)
    expect(g.score).toBeGreaterThanOrEqual(100)
    expect(g.well[g.rows - 1]?.filter(Boolean).length).toBe(1)
  })

  test('a landed piece gets one drop of grace before it settles', () => {
    const g = playing()
    g.piece.y += dropDistance(g)
    const kind = g.piece.kind
    for (let i = 0; i < 20; i++) tick(g)
    expect(g.piece.kind).toBe(kind)
    for (let i = 0; i < 20; i++) tick(g)
    expect(g.piece.kind).not.toBe(kind)
  })

  test('the game ends when a new piece has no room', () => {
    const g = playing()
    // Everything below the top row is taken (with a gap, so nothing clears):
    // the I settles on top and the O after it cannot come in.
    for (let y = 1; y < g.rows; y++) fillRow(g, y, y % 2 === 0 ? 0 : 9)
    press(g, 'primary')
    expect(g.phase).toBe('over')
    expect(press(g, 'left')).toBe(false)
  })

  test('the level rises every ten lines and speeds up the fall', () => {
    const g = playing()
    g.lines = 9
    fillRow(g, g.rows - 1, 9)
    press(g, 'up')
    for (let i = 0; i < 10; i++) press(g, 'right')
    press(g, 'primary')
    expect(g.level).toBe(2)
    expect(g.wait).toBeLessThan(20)
  })

  test('every row of the frame is as wide as the field, in both glyph sets', () => {
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const g = playing()
      const rows = blocks.frame(g, glyphs)
      expect(rows).toHaveLength(g.rows)
      for (const row of rows) expect(row.map(s => s.text).join('').length).toBe(FIELD_W)
    }
  })
})
