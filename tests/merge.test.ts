import { describe, expect, test } from 'claude-code/testing'

import { FIELD_H, FIELD_W, GOAL, canMove, merge, newMerge, press, slideLine } from '../hooks/games/merge'
import type { Merge } from '../hooks/games/merge'
import { GLYPHS } from '../hooks/glyphs'

// New tiles go to the first free cell and are always 2.
const low = () => 0

function withGrid(grid: number[]): Merge {
  const g = newMerge(0, 0, low)
  g.grid = [...grid]
  return g
}

describe('merge', () => {
  test('starts with two tiles and needs no start key', () => {
    const g = newMerge(0, 0, low)
    expect(g.grid.filter(v => v > 0)).toHaveLength(2)
    expect(merge.status(g)).toBe('play')
    expect(merge.banner(g)).toBeUndefined()
  })

  test('a line slides and merges each pair once', () => {
    expect(slideLine([2, 2, 2, 2])).toEqual({ line: [4, 4, 0, 0], points: 8 })
    expect(slideLine([0, 2, 0, 2])).toEqual({ line: [4, 0, 0, 0], points: 4 })
    expect(slideLine([4, 4, 8, 0])).toEqual({ line: [8, 8, 0, 0], points: 8 })
    expect(slideLine([2, 4, 2, 4])).toEqual({ line: [2, 4, 2, 4], points: 0 })
  })

  test('every direction slides the right way', () => {
    // prettier-ignore
    const start = [
      2, 0, 0, 2,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ]
    const right = withGrid(start)
    press(right, 'right')
    expect(right.grid[3]).toBe(4)
    const down = withGrid(start)
    press(down, 'down')
    expect(down.grid[12]).toBe(2)
    expect(down.grid[15]).toBe(2)
  })

  test('a move that changes nothing brings no new tile', () => {
    // prettier-ignore
    const g = withGrid([
      2, 4, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 0,
    ])
    expect(press(g, 'left')).toBe(false)
    expect(g.grid.filter(v => v > 0)).toHaveLength(2)
    expect(press(g, 'right')).toBe(true)
    expect(g.grid.filter(v => v > 0)).toHaveLength(3)
  })

  test('merges score their sum', () => {
    const g = withGrid([8, 8, 0, 0, ...Array(12).fill(0)])
    press(g, 'left')
    expect(g.score).toBe(16)
  })

  test('reaching the goal shows a note once and play goes on', () => {
    const g = withGrid([GOAL / 2, GOAL / 2, ...Array(14).fill(0)])
    press(g, 'left')
    expect(g.hasWon).toBe(true)
    expect(merge.banner(g)).toBe('merge.won')
    press(g, 'right')
    expect(merge.banner(g)).toBeUndefined()
    expect(g.phase).toBe('play')
  })

  test('moves are left while a cell is free or two neighbours match', () => {
    // prettier-ignore
    const stuck = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      4, 2, 4, 2,
    ]
    expect(canMove(withGrid(stuck))).toBe(false)
    expect(canMove(withGrid([...stuck.slice(0, 15), 0]))).toBe(true)
    expect(canMove(withGrid([...stuck.slice(0, 15), 4]))).toBe(true)
  })

  test('the board is drawn the same size in both glyph sets', () => {
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const rows = merge.frame(newMerge(0, 0, low), glyphs)
      expect(rows).toHaveLength(FIELD_H)
      for (const row of rows) expect(row.map(s => s.text).join('').length).toBe(FIELD_W)
    }
  })

  test('a key is all it takes to lose, and the host learns it from the key', () => {
    // prettier-ignore
    const g = withGrid([
      2, 4, 2, 4,
      4, 2, 4, 2,
      16, 32, 64, 128,
      4, 8, 16, 0,
    ])
    // The row slides to 0 4 8 16 and the new 2 fills the corner: no move left.
    press(g, 'right')
    expect(g.phase).toBe('over')
    expect(merge.status(g)).toBe('over')
    expect(press(g, 'left')).toBe(false)
  })
})
