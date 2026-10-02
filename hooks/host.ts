// The arcade's own rules, apart from any game: what a key means, the menu,
// starting and leaving a game, the manual pause, the frame clock. Pure, so the
// tests drive it without a surface.

import type { ClientKeyEvent } from 'claude-code'

import { GAMES } from './games'
import type { Action, GameDef } from './games/types'
import type { ArcadeProps } from '../types'

export type Running = {
  def: GameDef
  g: unknown
  /** The field the game was started with, in cells. */
  w: number
  h: number
  isReported: boolean
  /** The highest score handed over while the game was still running. */
  saved: number
  /** Milliseconds of frame clock not yet spent on ticks. */
  carry: number
}

export type Host = {
  props: ArcadeProps
  selected: number
  run?: Running
  isManuallyPaused: boolean
}

export type Command = Action | 'menu' | 'pause'

/** A game's score, for the hooks module to keep: when it ends, or when the person leaves it. */
export type Report = { type: 'score'; game: string; score: number }

export const FRAME_MS = 33
// How often a running game's record is handed over, so that closing the pane
// in the middle of a game does not lose it.
export const CHECKPOINT_MS = 5000
// Around the bordered field: the score line, the two border rows, the line
// that says why nothing moves, and the help line.
export const CHROME_ROWS = 5
// The field's left and right border.
const BORDER_COLUMNS = 2

// Keys typed on a Russian layout, mapped to the Latin key in the same place.
const CYRILLIC: Record<string, string> = {
  й: 'q',
  з: 'p',
  ф: 'a',
  в: 'd',
  ц: 'w',
  ы: 's',
  р: 'h',
  д: 'l',
  о: 'j',
  л: 'k',
  а: 'f',
  ч: 'x',
}

/** What a pressed key means to the arcade, whatever layout typed it. */
export function commandFor(k: ClientKeyEvent): Command | undefined {
  if (k.ctrl || k.meta) return undefined
  const raw = k.key.length === 1 ? k.key.toLowerCase() : k.key
  const key = CYRILLIC[raw] ?? raw
  switch (key) {
    case 'left':
    case 'a':
    case 'h':
      return 'left'
    case 'right':
    case 'd':
    case 'l':
      return 'right'
    case 'up':
    case 'w':
    case 'k':
      return 'up'
    case 'down':
    case 's':
    case 'j':
      return 'down'
    case ' ':
    case 'space':
    case 'return':
    case 'enter':
      return 'primary'
    case 'f':
    case 'x':
      return 'secondary'
    case 'q':
    case 'backspace':
      return 'menu'
    case 'p':
      return 'pause'
    default:
      return undefined
  }
}

/** The field for a pane: as large as fits, never below the game's smallest. */
export function fieldSize(def: GameDef, columns: number, rows: number): { w: number; h: number } {
  return {
    w: Math.min(def.maxW, Math.max(def.minW, columns - BORDER_COLUMNS)),
    h: Math.min(def.maxH, Math.max(def.minH, rows - CHROME_ROWS)),
  }
}

/**
 * True while the pane is wide enough to draw the running game's field. A
 * narrower pane would cut the field off on the right, so the game waits
 * instead. Zero columns is a pane not laid out yet: nothing to judge by.
 */
export function fits(run: Running, columns: number): boolean {
  return columns === 0 || columns >= run.w + BORDER_COLUMNS
}

export function newHost(props: ArcadeProps): Host {
  return { props, selected: 0, isManuallyPaused: false }
}

function start(def: GameDef, columns: number, rows: number): Running {
  const { w, h } = fieldSize(def, columns, rows)
  return { def, g: def.create(w, h), w, h, isReported: false, saved: 0, carry: 0 }
}

/**
 * The running game's score, if it is a new record not handed over yet. The
 * game goes on; its end or the person leaving it is reported as ever.
 */
export function checkpoint(s: Host): Report | undefined {
  const run = s.run
  if (!run || run.isReported) return undefined
  const score = run.def.hud(run.g).score
  if (score <= Math.max(run.saved, s.props.best[run.def.id] ?? 0)) return undefined
  run.saved = score
  return { type: 'score', game: run.def.id, score }
}

/** The run's score, once. */
function report(run: Running): Report | undefined {
  if (run.isReported) return undefined
  run.isReported = true
  return { type: 'score', game: run.def.id, score: run.def.hud(run.g).score }
}

function finish(run: Running): Report | undefined {
  return run.def.status(run.g) === 'over' ? report(run) : undefined
}

/** Leaving a game counts what was scored so far; a game not yet scored in leaves nothing. */
function leave(run: Running): Report | undefined {
  return run.def.hud(run.g).score > 0 ? report(run) : undefined
}

export type Outcome = { changed: boolean; report?: Report }

/** Applies a command to the arcade. */
export function handle(s: Host, cmd: Command, columns: number, rows: number): Outcome {
  const run = s.run
  if (!run) {
    if (cmd === 'up' || cmd === 'down') {
      const n = GAMES.length
      s.selected = (s.selected + (cmd === 'up' ? n - 1 : 1)) % n
      return { changed: true }
    }
    if (cmd === 'primary' || cmd === 'right') {
      const def = GAMES[s.selected]
      if (!def) return { changed: false }
      s.run = start(def, columns, rows)
      s.isManuallyPaused = false
      return { changed: true }
    }
    return { changed: false }
  }
  if (cmd === 'menu') {
    s.run = undefined
    s.isManuallyPaused = false
    return { changed: true, report: leave(run) }
  }
  if (s.props.isPaused || !fits(run, columns)) return { changed: false }
  if (cmd === 'pause') {
    s.isManuallyPaused = !s.isManuallyPaused
    return { changed: true }
  }
  if (s.isManuallyPaused) return { changed: false }
  // A finished game takes one key: the one that starts the next.
  if (run.def.status(run.g) === 'over') {
    if (cmd !== 'primary') return { changed: false }
    s.run = start(run.def, columns, rows)
    return { changed: true }
  }
  const changed = run.def.key(run.g, cmd)
  // A turn-based game can end on a key rather than on a tick.
  return { changed, report: changed ? finish(run) : undefined }
}

/** Runs one frame of the clock. */
export function frameTick(s: Host, columns: number): Outcome {
  const run = s.run
  if (!run || run.def.tickMs <= 0) return { changed: false }
  if (s.props.isPaused || s.isManuallyPaused || !fits(run, columns)) {
    run.carry = 0
    return { changed: false }
  }
  run.carry += FRAME_MS
  let changed = false
  while (run.carry >= run.def.tickMs) {
    run.carry -= run.def.tickMs
    const result = run.def.tick(run.g)
    if (result === 'changed') changed = true
    if (result === 'over') {
      run.carry = 0
      return { changed: true, report: finish(run) }
    }
  }
  return { changed }
}
