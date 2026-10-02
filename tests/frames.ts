// What every game's frame must hold to, in both glyph sets.

import { expect } from 'claude-code/testing'

import type { Frame } from '../hooks/games/types'
import { GLYPHS, textWidth } from '../hooks/glyphs'
import type { Glyphs } from '../hooks/glyphs'

/** A frame as lines of plain text. */
export function lines(rows: Frame): string[] {
  return rows.map(row => row.map(seg => seg.text).join(''))
}

/**
 * Draws with each glyph set and checks the frame: `h` rows, each exactly `w`
 * cells on screen, and nothing but plain ASCII in the ascii set.
 */
export function expectFrames(draw: (glyphs: Glyphs) => Frame, w: number, h: number): void {
  for (const set of ['unicode', 'ascii'] as const) {
    const text = lines(draw(GLYPHS[set]))
    expect([set, text.length]).toEqual([set, h])
    for (const line of text) expect([set, line, textWidth(line)]).toEqual([set, line, w])
    if (set === 'ascii') for (const line of text) expect(line).toMatch(/^[ -~]*$/)
  }
}
