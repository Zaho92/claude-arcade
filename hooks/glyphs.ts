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
  /** Bricks: the bonuses (an extra life is drawn as `life`) and the bar of a running effect. */
  powerBall: string
  powerWide: string
  powerSlow: string
  barOn: string
  barOff: string
  life: string
  lifeLost: string
  /** Two cells wide, so a square on the grid looks square on screen. */
  wormHead: string
  wormBody: string
  food: string
  /** Mines: a marked field and a mine. */
  flag: string
  mine: string
  /** Bulls & Cows: a right digit in the right place, and in the wrong one. */
  bull: string
  cow: string
  /** Lamps: a lit and a dark lamp, two cells wide. */
  lampOn: string
  lampOff: string
  /** Pairs: the symbols on the cards, one cell wide each and all different. */
  cards: string[]
  /** Around the field or digit the keys act on, so it shows without colors. */
  cursorLeft: string
  cursorRight: string
  /** After a try's number, and before the answer at the end. */
  ordinal: string
  answer: string
  empty: string
  /** A closed field and an empty slot. */
  dot: string
  /** Between two parts of a line ("P pause · Q menu"). */
  sep: string
  border: 'round' | 'classic'
  pointer: string
  pause: string
  /** The menu's title, letter by letter: each letter its rows, all equally wide. */
  logo: string[][]
}

export const GLYPHS: Record<GlyphSet, Glyphs> = {
  unicode: {
    ball: '●',
    paddle: '▀',
    block: '█',
    powerBall: '⊕',
    powerWide: '↔',
    powerSlow: '◔',
    barOn: '▰',
    barOff: '▱',
    life: '♥',
    lifeLost: '·',
    wormHead: '██',
    wormBody: '▓▓',
    food: '()',
    flag: 'F',
    mine: '✱',
    bull: '●',
    cow: '○',
    lampOn: '██',
    lampOff: '░░',
    cards: ['♠', '♥', '♦', '♣', '★', '●', '▲', '■', '◆', '♪', '☾', '✿', '✚', '▼', '◐', '✦'],
    cursorLeft: '[',
    cursorRight: ']',
    ordinal: '.',
    answer: '=',
    empty: ' ',
    dot: '·',
    sep: '·',
    border: 'round',
    pointer: '▶',
    pause: '⏸',
    logo: [
      ['▄▀█', '█▀█'],
      ['█▀█', '█▀▄'],
      ['█▀▀', '█▄▄'],
      ['▄▀█', '█▀█'],
      ['█▀▄', '█▄▀'],
      ['█▀▀', '██▄'],
    ],
  },
  ascii: {
    ball: 'o',
    paddle: '=',
    block: '#',
    powerBall: '8',
    powerWide: '<',
    powerSlow: '@',
    barOn: '+',
    barOff: '.',
    life: '*',
    lifeLost: '-',
    wormHead: '@@',
    wormBody: 'oo',
    food: '()',
    flag: 'F',
    mine: '*',
    bull: '+',
    cow: 'o',
    lampOn: '##',
    lampOff: '..',
    cards: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P'],
    cursorLeft: '[',
    cursorRight: ']',
    ordinal: '.',
    answer: '=',
    empty: ' ',
    dot: '.',
    sep: '|',
    border: 'classic',
    pointer: '>',
    pause: '||',
    logo: [
      [' _ ', '|_|', '| |'],
      [' _ ', '|_)', '| \\'],
      [' _ ', '|  ', '|_ '],
      [' _ ', '|_|', '| |'],
      [' _ ', '| \\', '|_/'],
      [' _ ', '|_ ', '|_ '],
    ],
  },
}

// The texts write the mark between two parts of a line as a middle dot.
const TEXT_SEP = '·'

/** A text with its separators in the glyph set's own mark. */
export function withSep(text: string, glyphs: Glyphs): string {
  return glyphs.sep === TEXT_SEP ? text : text.replaceAll(TEXT_SEP, glyphs.sep)
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

/** Fills text up to `width` cells with spaces on the right. */
export function padTo(text: string, width: number): string {
  return text + ' '.repeat(Math.max(0, width - textWidth(text)))
}
