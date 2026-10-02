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
  isReported: boolean
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

/** A finished game's score, for the hooks module to keep. */
export type Report = { type: 'over'; game: string; score: number }

export const FRAME_MS = 33
// The score line and the help line around the bordered field.
const CHROME_ROWS = 4

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

export function fieldSize(def: GameDef, columns: number, rows: number): { w: number; h: number } {
  return {
    w: Math.min(def.maxW, Math.max(def.minW, columns - 2)),
    h: Math.min(def.maxH, Math.max(def.minH, rows - CHROME_ROWS)),
  }
}

export function newHost(props: ArcadeProps): Host {
  return { props, selected: 0, isManuallyPaused: false }
}

function start(def: GameDef, columns: number, rows: number): Running {
  const { w, h } = fieldSize(def, columns, rows)
  return { def, g: def.create(w, h), isReported: false, carry: 0 }
}

function finish(run: Running): Report | undefined {
  if (run.isReported || run.def.status(run.g) !== 'over') return undefined
  run.isReported = true
  return { type: 'over', game: run.def.id, score: run.def.hud(run.g).score }
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
    return { changed: true }
  }
  if (s.props.isPaused) return { changed: false }
  if (cmd === 'pause') {
    s.isManuallyPaused = !s.isManuallyPaused
    return { changed: true }
  }
  if (s.isManuallyPaused) return { changed: false }
  if (cmd === 'primary' && run.def.status(run.g) === 'over') {
    s.run = start(run.def, columns, rows)
    return { changed: true }
  }
  const changed = run.def.key(run.g, cmd)
  // A turn-based game can end on a key rather than on a tick.
  return { changed, report: changed ? finish(run) : undefined }
}

/** Runs one frame of the clock. */
export function frameTick(s: Host): Outcome {
  const run = s.run
  if (!run || run.def.tickMs <= 0) return { changed: false }
  if (s.props.isPaused || s.isManuallyPaused) {
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
