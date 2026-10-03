import { describe, expect, test } from 'claude-code/testing'

import { FIELD_H, FIELD_W, fifteen, isSolved, newFifteen, press, score, shuffle, slide, solved } from '../hooks/games/fifteen'
import type { Fifteen } from '../hooks/games/fifteen'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** A small deterministic random function. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

function withGrid(grid: number[]): Fifteen {
  const g = newFifteen(0, 0, seeded(1))
  g.grid = [...grid]
  return g
}

// One slide from solved: the gap is in the corner, 15 sits left of it.
// prettier-ignore
const NEARLY = [
  1, 2, 3, 4,
  5, 6, 7, 8,
  9, 10, 11, 12,
  13, 14, 0, 15,
]

/** Counts the inversions: with the gap's row from the bottom, the puzzle's solvability test. */
function isSolvable(grid: readonly number[]): boolean {
  const tiles = grid.filter(v => v !== 0)
  let inversions = 0
  for (let i = 0; i < tiles.length; i++) for (let j = i + 1; j < tiles.length; j++) if ((tiles[i] ?? 0) > (tiles[j] ?? 0)) inversions++
  const gapRowFromBottom = 4 - Math.floor(grid.indexOf(0) / 4)
  return (inversions + gapRowFromBottom) % 2 === 1
}

describe('fifteen', () => {
  test('starts shuffled, never solved, with all fifteen tiles and the gap', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const g = newFifteen(0, 0, seeded(seed))
      expect([seed, [...g.grid].sort((a, b) => a - b)]).toEqual([seed, solved().sort((a, b) => a - b)])
      expect([seed, isSolved(g.grid)]).toEqual([seed, false])
    }
    const g = newFifteen(0, 0, seeded(7))
    expect(fifteen.status(g)).toBe('play')
    expect(g.moves).toBe(0)
    expect(fifteen.banner(g)).toBeUndefined()
  })

  test('every shuffle can be solved', () => {
    for (let seed = 1; seed <= 50; seed++) expect([seed, isSolvable(shuffle(seeded(seed)))]).toEqual([seed, true])
  })

  test('a shuffle that would end solved is shuffled again', () => {
    // A random function that always picks the first option walks left, right... never back, so
    // it cannot come home, but one that alternates could; either way the result is never solved.
    expect(isSolved(shuffle(() => 0))).toBe(false)
    expect(isSolved(shuffle(() => 0.999))).toBe(false)
  })

  test('an arrow slides the tile on its far side of the gap in its direction', () => {
    // prettier-ignore
    const start = [
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 0, 11,
      12, 13, 14, 15,
    ]
    const left = withGrid(start)
    expect(press(left, 'left')).toBe(true)
    expect(left.grid.slice(8, 12)).toEqual([9, 10, 11, 0])
    const right = withGrid(start)
    press(right, 'right')
    expect(right.grid.slice(8, 12)).toEqual([9, 0, 10, 11])
    const up = withGrid(start)
    press(up, 'up')
    expect(up.grid[10]).toBe(14)
    expect(up.grid[14]).toBe(0)
    const down = withGrid(start)
    press(down, 'down')
    expect(down.grid[10]).toBe(7)
    expect(down.grid[6]).toBe(0)
    expect(down.moves).toBe(1)
  })

  test('an arrow with no tile on that side moves nothing and costs no move', () => {
    // The gap sits in the last corner: nothing is to its right or below it.
    const g = withGrid(solved())
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'up')).toBe(false)
    expect(g.moves).toBe(0)
    expect(g.grid).toEqual(solved())
    expect(slide(solved(), 'left')).toBe(false)
  })

  test('Space and the other keys do nothing', () => {
    const g = withGrid(NEARLY)
    expect(press(g, 'primary')).toBe(false)
    expect(press(g, 'secondary')).toBe(false)
    expect(g.moves).toBe(0)
  })

  test('solving it ends the game with a banner and a score', () => {
    const g = withGrid(NEARLY)
    expect(press(g, 'left')).toBe(true)
    expect(isSolved(g.grid)).toBe(true)
    expect(fifteen.status(g)).toBe('over')
    expect(fifteen.banner(g)).toBe('fifteen.won')
    expect(fifteen.hud(g).score).toBeGreaterThan(0)
    expect(fifteen.hud(g).extra).toEqual({ key: 'hud.moves', n: 1 })
    // Over: no key moves anything.
    expect(press(g, 'left')).toBe(false)
  })

  test('the gap must be in the last corner: the right tiles in the wrong place with the gap first do not win', () => {
    // prettier-ignore
    const g = withGrid([
      0, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15,
    ])
    press(g, 'up')
    expect(fifteen.status(g)).toBe('play')
  })

  test('fewer moves score higher, and an unsolved game scores nothing', () => {
    const g = withGrid(NEARLY)
    expect(score(g)).toBe(0)
    const quick = withGrid(NEARLY)
    quick.moves = 40
    quick.isWon = true
    const slow = withGrid(NEARLY)
    slow.moves = 400
    slow.isWon = true
    const endless = withGrid(NEARLY)
    endless.moves = 100000
    endless.isWon = true
    expect(score(quick)).toBeGreaterThan(score(slow))
    expect(score(slow)).toBeGreaterThan(score(endless))
    expect(score(endless)).toBeGreaterThan(0)
  })

  test('the tray is drawn the same size in both glyph sets', () => {
    const g = withGrid([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0])
    expectFrames(glyphs => fifteen.frame(g, glyphs), FIELD_W, FIELD_H)
  })

  test('the numbers show on their tiles and tiles in their place have their own color', () => {
    const g = withGrid(NEARLY)
    const rows = fifteen.frame(g, GLYPHS.ascii)
    const text = lines(rows)
    expect(text[2]).toContain(' 1 ')
    expect(text[14]).toContain('15')
    const bgs = new Set(rows.flat().map(seg => seg.bg))
    // The gap color and both tile colors.
    expect(bgs.size).toBe(3)
    // 15 is out of place, 14 is in place: they differ.
    const color = (n: string): string | undefined => rows.flat().find(seg => seg.text.includes(n) && seg.bg !== undefined && seg.text.trim() === n)?.bg
    expect(color('15')).not.toBe(color('14'))
  })
})
