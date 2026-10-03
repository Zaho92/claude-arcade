import { describe, expect, test } from 'claude-code/testing'

import { GAMES } from '../hooks/games'
import { boardPoints, boardsFor, cardAt, deal, newPairs, pairs, press } from '../hooks/games/pairs'
import type { Pairs } from '../hooks/games/pairs'
import { GLYPHS, textWidth } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** A tiny deterministic random: the same sequence every run. */
function seeded(seed = 7): () => number {
  let s = seed
  return () => {
    s = (s * 1103515245 + 12345) % 2147483648
    return s / 2147483648
  }
}

/** Moves the cursor to a card and turns it. */
function turnAt(g: Pairs, index: number): void {
  g.cursor = { x: index % g.cols, y: Math.floor(index / g.cols) }
  press(g, 'primary')
}

/** The positions of the two cards with this symbol. */
function partners(g: Pairs, index: number): number {
  const sym = g.cards[index]!.sym
  return g.cards.findIndex((c, i) => i !== index && c.sym === sym)
}

/** The position of a card that does not match the one at `index`. */
function stranger(g: Pairs, index: number): number {
  const sym = g.cards[index]!.sym
  return g.cards.findIndex((c, i) => i !== index && c.sym !== sym && c.state === 'down')
}

/** Finds every pair of the board, in the fewest tries. */
function solve(g: Pairs): void {
  for (let i = 0; i < g.cards.length; i++) {
    if (g.cards[i]!.state !== 'down') continue
    turnAt(g, i)
    turnAt(g, partners(g, i))
  }
}

describe('pairs', () => {
  test('every symbol is on exactly two cards, on every board', () => {
    for (const [cols, rows] of [
      [4, 3],
      [4, 4],
      [6, 4],
      [8, 4],
    ] as const) {
      const cards = deal((cols * rows) / 2, seeded(cols * rows))
      expect(cards).toHaveLength(cols * rows)
      const count = new Map<number, number>()
      for (const c of cards) count.set(c.sym, (count.get(c.sym) ?? 0) + 1)
      expect([...count.values()].every(n => n === 2)).toBe(true)
      expect(cards.every(c => c.state === 'down')).toBe(true)
    }
  })

  test('no board has an odd number of cards, and the pane decides how far they grow', () => {
    expect(boardsFor(pairs.minW, pairs.minH)).toEqual([[4, 3]])
    expect(boardsFor(24, 16)).toEqual([
      [4, 3],
      [4, 4],
    ])
    expect(boardsFor(pairs.maxW, pairs.maxH).map(([c, r]) => c * r)).toEqual([12, 16, 24, 32])
    expect(boardsFor(1, 1)).toEqual([[4, 3]])
    for (const [c, r] of boardsFor(200, 100)) expect((c * r) % 2).toBe(0)
  })

  test('the same random gives the same deal', () => {
    const a = newPairs(36, 16, seeded(3))
    const b = newPairs(36, 16, seeded(3))
    expect(a.cards).toEqual(b.cards)
  })

  test('two matching cards stay open and count one try', () => {
    const g = newPairs(36, 16, seeded())
    turnAt(g, 0)
    expect(g.tries).toBe(0)
    turnAt(g, partners(g, 0))
    expect(g.tries).toBe(1)
    expect(g.cards[0]!.state).toBe('done')
    expect(g.cards[partners(g, 0)]!.state).toBe('done')
    expect(g.mismatch).toBeUndefined()
  })

  test('two cards that do not match stay shown until the next key, which then acts', () => {
    const g = newPairs(36, 16, seeded())
    turnAt(g, 0)
    const other = stranger(g, 0)
    turnAt(g, other)
    expect(g.tries).toBe(1)
    expect(g.cards[0]!.state).toBe('up')
    expect(g.cards[other]!.state).toBe('up')
    // The cursor stands on the second card. A move turns both back and moves.
    const before = { ...g.cursor }
    expect(press(g, 'right')).toBe(true)
    expect(g.cards[0]!.state).toBe('down')
    expect(g.cards[other]!.state).toBe('down')
    expect(g.cursor).not.toEqual(before)
    expect(g.mismatch).toBeUndefined()
  })

  test('Space after a miss turns them back and turns the card under the cursor in one key', () => {
    const g = newPairs(36, 16, seeded())
    turnAt(g, 0)
    const other = stranger(g, 0)
    turnAt(g, other)
    const third = g.cards.findIndex((c, i) => i !== 0 && i !== other && c.state === 'down')
    g.cursor = { x: third % g.cols, y: Math.floor(third / g.cols) }
    g.mismatch = [0, other]
    press(g, 'primary')
    expect(g.cards[0]!.state).toBe('down')
    expect(g.cards[other]!.state).toBe('down')
    expect(g.cards[third]!.state).toBe('up')
    expect(g.first).toBe(third)
    expect(g.tries).toBe(1)
  })

  test('the key that turns a miss back is not lost even when it does nothing else', () => {
    const g = newPairs(36, 16, seeded())
    turnAt(g, 0)
    turnAt(g, stranger(g, 0))
    expect(press(g, 'secondary')).toBe(true)
    expect(g.cards.every(c => c.state === 'down')).toBe(true)
    expect(press(g, 'secondary')).toBe(false)
  })

  test('an open card cannot be turned again', () => {
    const g = newPairs(36, 16, seeded())
    turnAt(g, 0)
    expect(press(g, 'primary')).toBe(false)
    expect(g.first).toBe(0)
    expect(g.tries).toBe(0)
  })

  test('the cursor wraps around the edges', () => {
    const g = newPairs(36, 16, seeded())
    press(g, 'left')
    press(g, 'up')
    expect(g.cursor).toEqual({ x: g.cols - 1, y: g.rows - 1 })
    press(g, 'right')
    press(g, 'down')
    expect(g.cursor).toEqual({ x: 0, y: 0 })
  })

  test('fewer tries give more points', () => {
    expect(boardPoints(6, 6)).toBeGreaterThan(boardPoints(6, 7))
    expect(boardPoints(6, 7)).toBeGreaterThan(boardPoints(6, 20))
    expect(boardPoints(6, 1000)).toBeGreaterThan(0)
  })

  test('a cleared board scores, waits for Space, then opens a bigger one', () => {
    const g = newPairs(36, 16, seeded())
    solve(g)
    expect(g.isCleared).toBe(true)
    expect(g.tries).toBe(6)
    expect(g.score).toBe(boardPoints(6, 6))
    expect(pairs.hud(g).score).toBe(boardPoints(6, 6))
    expect(pairs.banner(g)).toBe('pairs.cleared')
    expect(pairs.status(g)).toBe('play')
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'primary')).toBe(true)
    expect([g.cols, g.rows]).toEqual([4, 4])
    expect(g.level).toBe(2)
    expect(g.tries).toBe(0)
    expect(g.isCleared).toBe(false)
    expect(g.cards.every(c => c.state === 'down')).toBe(true)
    expect(pairs.hud(g).level).toBe(2)
    // The points of the first board are kept.
    expect(g.score).toBe(boardPoints(6, 6))
  })

  test('the last board of the pane ends the game as won, and fewer tries beat more', () => {
    const play = (misses: number): number => {
      const g = newPairs(24, 16, seeded())
      for (let board = 0; board < 2; board++) {
        for (let m = 0; m < (board === 0 ? misses : 0); m++) {
          turnAt(g, 0)
          turnAt(g, stranger(g, 0))
          press(g, 'secondary')
        }
        solve(g)
        expect(g.isCleared).toBe(true)
        if (board === 0) press(g, 'primary')
      }
      expect(g.isWon).toBe(true)
      expect(g.phase).toBe('over')
      expect(pairs.status(g)).toBe('over')
      expect(pairs.banner(g)).toBe('pairs.won')
      expect(press(g, 'primary')).toBe(false)
      return pairs.hud(g).score
    }
    expect(play(0)).toBeGreaterThan(play(3))
  })

  test('it is listed, turn-based, and its sizes are consistent', () => {
    expect(GAMES.map(d => d.id)).toContain('pairs')
    expect(pairs.tickMs).toBe(0)
    expect(pairs.tick(newPairs(36, 16))).toBe('none')
    expect(pairs.minW).toBeLessThanOrEqual(pairs.maxW)
    expect(pairs.minH).toBeLessThanOrEqual(pairs.maxH)
  })

  test('every symbol is one cell wide and different, in both glyph sets', () => {
    for (const set of ['unicode', 'ascii'] as const) {
      const cards = GLYPHS[set].cards
      expect(cards.length).toBeGreaterThanOrEqual(16)
      expect(new Set(cards).size).toBe(cards.length)
      for (const c of cards) expect([set, c, textWidth(c)]).toEqual([set, c, 1])
    }
    expect(GLYPHS.ascii.cards.every(c => /^[A-Za-z]$/.test(c))).toBe(true)
  })

  test('every row of the frame is as wide as the field, on every board and pane', () => {
    for (const [w, h] of [
      [pairs.minW, pairs.minH],
      [30, 14],
      [36, 16],
      [pairs.maxW, pairs.maxH],
      [60, 20],
    ] as const) {
      const g = newPairs(w, h, seeded())
      for (let level = 0; level < g.boards.length; level++) {
        expectFrames(glyphs => pairs.frame(g, glyphs), w, h)
        solve(g)
        expectFrames(glyphs => pairs.frame(g, glyphs), w, h)
        if (g.phase !== 'over') press(g, 'primary')
      }
    }
  })

  test('the cursor and open cards show without color', () => {
    const g = newPairs(36, 16, seeded())
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const text = lines(pairs.frame(g, glyphs)).join('\n')
      expect(text).toContain(`${glyphs.cursorLeft} ${glyphs.dot} ${glyphs.cursorRight}`)
    }
    turnAt(g, 0)
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const symbol = glyphs.cards[g.cards[0]!.sym]!
      expect(lines(pairs.frame(g, glyphs)).join('\n')).toContain(symbol)
    }
    // Once the board is cleared the cursor is gone.
    turnAt(g, partners(g, 0))
    solve(g)
    expect(lines(pairs.frame(g, GLYPHS.ascii)).join('\n')).not.toContain(GLYPHS.ascii.cursorLeft)
  })

  test('cards of a pair look alike and different pairs differ, without colors', () => {
    const g = newPairs(pairs.maxW, pairs.maxH, seeded())
    g.level = 4
    g.cols = 8
    g.rows = 4
    g.cards = deal(16, seeded(5))
    g.cards.forEach(c => (c.state = 'up'))
    g.isCleared = false
    const text = lines(pairs.frame(g, GLYPHS.ascii)).join('')
    for (const letter of GLYPHS.ascii.cards) expect(text.split(letter).length - 1).toBe(2)
    expect(cardAt(g, 7, 3)).toBeDefined()
  })
})
