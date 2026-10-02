// Bulls & Cows as pure logic, the old pencil-and-paper code game: guess a
// secret of four different digits in ten tries. A bull is a right digit in
// the right place, a cow a right digit in the wrong place. Entered with the
// arrows alone (digits need Shift on some layouts); no clock.

import type { Glyphs } from '../glyphs'
import type { Action, Frame, GameDef, Segment, TickResult } from './types'

export const DIGITS = 4
export const TRIES = 10
const SCORE_PER_TRY_LEFT = 100

export type Guess = { digits: number[]; bulls: number; cows: number }

export type Cows = {
  w: number
  h: number
  secret: number[]
  guesses: Guess[]
  /** The guess being entered; its digits are always different. */
  input: number[]
  slot: number
  phase: 'play' | 'over'
  isWon: boolean
  random: () => number
}

export const FIELD_W = 30
// A blank row, one per try, a blank row, the input row, a blank row.
export const FIELD_H = TRIES + 4

const DIGIT_COLOR = '#e0e0e0'
const SLOT_COLOR = '#ffd93d'
const BULL_COLOR = '#6bcb77'
const COW_COLOR = '#ffb36b'
const DIM = '#707070'
const SECRET_COLOR = '#ff7b9c'

export function newCows(_w: number, _h: number, random: () => number = Math.random): Cows {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  const secret: number[] = []
  for (let i = 0; i < DIGITS; i++) {
    const k = Math.floor(random() * pool.length)
    secret.push(pool.splice(k, 1)[0] ?? 0)
  }
  return {
    w: FIELD_W,
    h: FIELD_H,
    secret,
    guesses: [],
    input: [0, 1, 2, 3],
    slot: 0,
    phase: 'play',
    isWon: false,
    random,
  }
}

export function judge(secret: readonly number[], guess: readonly number[]): { bulls: number; cows: number } {
  let bulls = 0
  let cows = 0
  guess.forEach((d, i) => {
    if (secret[i] === d) bulls++
    else if (secret.includes(d)) cows++
  })
  return { bulls, cows }
}

/** The next digit up or down from the slot's, skipping those in other slots. */
function turn(g: Cows, step: 1 | -1): void {
  const others = g.input.filter((_, i) => i !== g.slot)
  let d = g.input[g.slot] ?? 0
  do d = (d + step + 10) % 10
  while (others.includes(d))
  g.input[g.slot] = d
}

export function score(g: Cows): number {
  return g.isWon ? (TRIES - g.guesses.length + 1) * SCORE_PER_TRY_LEFT : 0
}

export function press(g: Cows, action: Action): boolean {
  if (g.phase === 'over' || action === 'secondary') return false
  switch (action) {
    case 'left':
      g.slot = (g.slot + DIGITS - 1) % DIGITS
      return true
    case 'right':
      g.slot = (g.slot + 1) % DIGITS
      return true
    case 'up':
      turn(g, 1)
      return true
    case 'down':
      turn(g, -1)
      return true
    case 'primary': {
      const digits = [...g.input]
      g.guesses.push({ digits, ...judge(g.secret, digits) })
      if (digits.every((d, i) => g.secret[i] === d)) {
        g.isWon = true
        g.phase = 'over'
      } else if (g.guesses.length >= TRIES) {
        g.phase = 'over'
      }
      g.slot = 0
      return true
    }
  }
}

function pad(cells: Segment[], w: number): Segment[] {
  const used = cells.reduce((n, s) => n + s.text.length, 0)
  if (used < w) cells.push({ text: ' '.repeat(w - used) })
  return cells
}

export function frame(g: Cows, glyphs: Glyphs): Frame {
  const rows: Frame = [pad([], FIELD_W)]
  for (let i = 0; i < TRIES; i++) {
    const guess = g.guesses[i]
    const no = String(i + 1).padStart(4)
    if (!guess) {
      rows.push(pad([{ text: `${no}.  `, color: DIM }, { text: `${glyphs.dot}  `.repeat(DIGITS), color: DIM }], FIELD_W))
      continue
    }
    rows.push(
      pad(
        [
          { text: `${no}.  `, color: DIM },
          { text: guess.digits.map(d => `${d}  `).join(''), color: DIGIT_COLOR },
          { text: ' ' },
          { text: glyphs.bull.repeat(guess.bulls), color: BULL_COLOR },
          { text: glyphs.cow.repeat(guess.cows), color: COW_COLOR },
        ],
        FIELD_W,
      ),
    )
  }
  rows.push(pad([], FIELD_W))
  if (g.phase === 'over') {
    rows.push(pad([{ text: '    =  ', color: DIM }, { text: g.secret.map(d => `${d}  `).join(''), color: SECRET_COLOR }], FIELD_W))
  } else {
    const cells: Segment[] = [{ text: `    ${glyphs.pointer}  `.slice(0, 7), color: SLOT_COLOR }]
    g.input.forEach((d, i) => {
      cells.push(i === g.slot ? { text: `[${d}]`, color: SLOT_COLOR } : { text: ` ${d} `, color: DIGIT_COLOR })
    })
    rows.push(pad(cells, FIELD_W))
  }
  rows.push(pad([], FIELD_W))
  return rows
}

export const cows: GameDef<Cows> = {
  id: 'cows',
  name: 'cows.name',
  blurb: 'cows.blurb',
  help: 'cows.help',
  tickMs: 0,
  minW: FIELD_W,
  minH: FIELD_H,
  maxW: FIELD_W,
  maxH: FIELD_H,
  create: (w, h) => newCows(w, h),
  key: press,
  tick: (): TickResult => 'none',
  status: g => g.phase,
  hud: g => ({ score: score(g), extra: { key: 'hud.triesLeft', n: TRIES - g.guesses.length } }),
  frame,
  banner: g => (g.isWon ? 'cows.won' : undefined),
}
