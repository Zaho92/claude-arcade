import { describe, expect, test } from 'claude-code/testing'

import { DIGITS, FIELD_H, FIELD_W, TRIES, cows, judge, newCows, press, score } from '../hooks/games/cows'
import type { Cows } from '../hooks/games/cows'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

function withSecret(secret: number[]): Cows {
  const g = newCows(0, 0)
  g.secret = secret
  return g
}

/** Turns the input to `digits` with the arrows, the way a player would. */
function enter(g: Cows, digits: number[]): void {
  // Park the slots on digits nobody wants, so turning never collides.
  g.input = [6, 7, 8, 9].filter(d => !digits.includes(d)).concat([0, 1, 2, 3, 4, 5].filter(d => !digits.includes(d))).slice(0, DIGITS)
  digits.forEach((d, i) => {
    g.slot = i
    for (let k = 0; k < 10 && g.input[i] !== d; k++) press(g, 'up')
  })
}

describe('bulls & cows', () => {
  test('the secret has four different digits', () => {
    for (let i = 0; i < 50; i++) {
      const g = newCows(0, 0)
      expect(new Set(g.secret).size).toBe(DIGITS)
    }
  })

  test('bulls are right places, cows right digits in wrong places', () => {
    expect(judge([1, 2, 3, 4], [1, 2, 3, 4])).toEqual({ bulls: 4, cows: 0 })
    expect(judge([1, 2, 3, 4], [4, 3, 2, 1])).toEqual({ bulls: 0, cows: 4 })
    expect(judge([1, 2, 3, 4], [1, 5, 2, 9])).toEqual({ bulls: 1, cows: 1 })
    expect(judge([1, 2, 3, 4], [5, 6, 7, 8])).toEqual({ bulls: 0, cows: 0 })
  })

  test('the arrows never let a digit appear twice in the input', () => {
    const g = newCows(0, 0)
    for (let i = 0; i < 40; i++) {
      press(g, i % 3 === 0 ? 'right' : i % 2 === 0 ? 'up' : 'down')
      expect(new Set(g.input).size).toBe(DIGITS)
    }
  })

  test('left and right wrap around the slots', () => {
    const g = newCows(0, 0)
    press(g, 'left')
    expect(g.slot).toBe(DIGITS - 1)
    press(g, 'right')
    expect(g.slot).toBe(0)
  })

  test('a right guess wins, sooner scores more', () => {
    const g = withSecret([5, 0, 9, 2])
    enter(g, [1, 2, 3, 4])
    press(g, 'primary')
    expect(g.guesses[0]).toMatchObject({ bulls: 0, cows: 1 })
    enter(g, [5, 0, 9, 2])
    press(g, 'primary')
    expect(g.isWon).toBe(true)
    expect(cows.status(g)).toBe('over')
    expect(cows.banner(g)).toBe('cows.won')
    expect(score(g)).toBe((TRIES - 1) * 100)
  })

  test('ten wrong guesses lose and reveal the secret', () => {
    const g = withSecret([5, 0, 9, 2])
    for (let i = 0; i < TRIES; i++) {
      enter(g, [1, 2, 3, 4])
      press(g, 'primary')
    }
    expect(g.phase).toBe('over')
    expect(g.isWon).toBe(false)
    expect(score(g)).toBe(0)
    expect(press(g, 'up')).toBe(false)
    const text = lines(cows.frame(g, GLYPHS.unicode))
    expect(text.join('\n')).toContain(`${GLYPHS.unicode.answer}  5  0  9  2`)
    // Every try stays on the board for the player to read back.
    for (let i = 1; i <= TRIES; i++) expect(text[i]).toContain('1  2  3  4')
    expectFrames(glyphs => cows.frame(g, glyphs), FIELD_W, FIELD_H)
  })

  test('every row is as wide as the field, in both glyph sets', () => {
    const g = withSecret([5, 0, 9, 2])
    enter(g, [5, 9, 1, 2])
    press(g, 'primary')
    expectFrames(glyphs => cows.frame(g, glyphs), FIELD_W, FIELD_H)
    for (const glyphs of [GLYPHS.unicode, GLYPHS.ascii]) {
      const text = lines(cows.frame(g, glyphs))
      expect(text[1]).toContain(`1${glyphs.ordinal}  5  9  1  2`)
      // The digit the keys act on stands in the cursor's brackets.
      expect(text[FIELD_H - 2]).toContain(`${glyphs.pointer}  ${glyphs.cursorLeft}${g.input[0]}${glyphs.cursorRight}`)
    }
  })
})
