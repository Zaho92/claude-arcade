import { describe, expect, test } from 'claude-code/testing'

import { fieldAt, lay, mines, newMines, open, openCount, press, score } from '../hooks/games/mines'
import type { Mines } from '../hooks/games/mines'
import { GLYPHS } from '../hooks/glyphs'

/** A field with mines exactly where `at` says, numbers worked out. */
function rigged(at: [number, number][], cols = 8, rows = 8): Mines {
  const g = newMines(cols * 3, rows, () => 0)
  for (const [x, y] of at) fieldAt(g, x, y)!.isMine = true
  g.mineCount = at.length
  // Lay nothing more, but let lay() count the neighbours.
  const saved = g.mineCount
  g.mineCount = 0
  lay(g, -10, -10)
  g.mineCount = saved
  return g
}

describe('mines', () => {
  test('the first field opened is safe, and so are its neighbours', () => {
    for (let round = 0; round < 20; round++) {
      const g = newMines(24, 8)
      press(g, 'primary')
      const { x, y } = g.cursor
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(fieldAt(g, x + dx, y + dy)?.isMine ?? false).toBe(false)
      expect(g.phase).not.toBe('over')
      expect(g.fields.filter(f => f.isMine)).toHaveLength(g.mineCount)
    }
  })

  test('a field with no mines around opens its neighbours too', () => {
    const g = rigged([[7, 7]])
    open(g, 0, 0)
    expect(openCount(g)).toBe(63)
    expect(g.isWon).toBe(true)
    expect(g.phase).toBe('over')
    expect(mines.banner(g)).toBe('mines.won')
    expect(score(g)).toBe(63 + 10)
  })

  test('numbers count the mines around', () => {
    const g = rigged([
      [0, 0],
      [2, 0],
    ])
    expect(fieldAt(g, 1, 0)?.near).toBe(2)
    expect(fieldAt(g, 1, 1)?.near).toBe(2)
    expect(fieldAt(g, 3, 1)?.near).toBe(1)
  })

  test('opening a mine ends the game and shows every mine', () => {
    const g = rigged([
      [3, 3],
      [5, 5],
    ])
    open(g, 3, 3)
    expect(g.phase).toBe('over')
    expect(g.isWon).toBe(false)
    expect(fieldAt(g, 5, 5)?.isOpen).toBe(true)
    expect(mines.banner(g)).toBeUndefined()
    expect(press(g, 'primary')).toBe(false)
  })

  test('a flag protects a field and counts down the mines left', () => {
    const g = rigged([[3, 3]])
    g.cursor = { x: 3, y: 3 }
    g.phase = 'play'
    press(g, 'secondary')
    expect(mines.hud(g).extra?.n).toBe(0)
    expect(press(g, 'primary')).toBe(false)
    expect(g.phase).toBe('play')
    press(g, 'secondary')
    expect(mines.hud(g).extra?.n).toBe(1)
  })

  test('the cursor wraps around the edges', () => {
    const g = newMines(24, 8)
    g.cursor = { x: 0, y: 0 }
    press(g, 'left')
    press(g, 'up')
    expect(g.cursor).toEqual({ x: g.cols - 1, y: g.rows - 1 })
  })

  test('the field scales with the pane, within limits', () => {
    expect(newMines(10, 3).cols).toBe(8)
    expect(newMines(200, 50).cols).toBe(16)
    expect(newMines(200, 50).rows).toBe(14)
  })

  test('every row of the frame is as wide as the field, and the cursor shows without color', () => {
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const g = newMines(36, 10)
      const rows = mines.frame(g, glyphs)
      expect(rows).toHaveLength(g.rows)
      for (const row of rows) expect(row.map(s => s.text).join('').length).toBe(g.w)
      const line = rows[g.cursor.y]?.map(s => s.text).join('') ?? ''
      expect(line).toContain(`[${glyphs.dot}]`)
      // Closed fields carry a mark of their own, so they read without colors.
      expect(line).toContain(` ${glyphs.dot} `)
    }
  })
})
