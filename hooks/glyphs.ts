// The characters the games draw with, and how wide text is on screen.
//
// Terminals set to Chinese, Japanese or Korean draw "ambiguous width"
// characters (●, ♥, ▀, box drawing) two cells wide, which tears a grid apart.
// The ascii set keeps every cell one column wide everywhere.

import type { GlyphSet } from '../types'

export type { GlyphSet }

export type Glyphs = {
  ball: string
  paddle: string
  block: string
  life: string
  lifeLost: string
  /** Two cells wide, so a square on the grid looks square on screen. */
  snakeHead: string
  snakeBody: string
  food: string
  empty: string
  dot: string
  border: 'round' | 'classic'
  pointer: string
  pause: string
}

export const GLYPHS: Record<GlyphSet, Glyphs> = {
  unicode: {
    ball: '●',
    paddle: '▀',
    block: '█',
    life: '♥',
    lifeLost: '·',
    snakeHead: '██',
    snakeBody: '▓▓',
    food: '()',
    empty: ' ',
    dot: '·',
    border: 'round',
    pointer: '▶',
    pause: '⏸',
  },
  ascii: {
    ball: 'o',
    paddle: '=',
    block: '#',
    life: '*',
    lifeLost: '-',
    snakeHead: '@@',
    snakeBody: 'oo',
    food: '()',
    empty: ' ',
    dot: '.',
    border: 'classic',
    pointer: '>',
    pause: '||',
  },
}

/** True for a code point a terminal draws two cells wide (East Asian Wide/Fullwidth, emoji). */
function isWide(cp: number): boolean {
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0x303e) ||
    (cp >= 0x3041 && cp <= 0x33ff) ||
    (cp >= 0x3400 && cp <= 0x4dbf) ||
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0xa000 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x20000 && cp <= 0x3fffd)
  )
}

/** Cells a string takes on screen. */
export function textWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp < 0x20 || (cp >= 0x300 && cp <= 0x36f) || cp === 0x200b) continue
    w += isWide(cp) ? 2 : 1
  }
  return w
}

/** Cuts a string to at most `width` cells. */
export function clip(text: string, width: number): string {
  let out = ''
  let w = 0
  for (const ch of text) {
    const cw = textWidth(ch)
    if (w + cw > width) break
    out += ch
    w += cw
  }
  return out
}

/** Centers text in `width` cells, padded with spaces on both sides. */
export function center(text: string, width: number): string {
  const t = clip(text, width)
  const left = Math.max(0, Math.floor((width - textWidth(t)) / 2))
  const right = Math.max(0, width - left - textWidth(t))
  return ' '.repeat(left) + t + ' '.repeat(right)
}
