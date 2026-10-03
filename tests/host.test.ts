import { describe, expect, test } from 'claude-code/testing'

import { GAMES } from '../hooks/games'
import type { Game } from '../hooks/games/bricks'
import type { Merge } from '../hooks/games/merge'
import { GLYPHS, textWidth } from '../hooks/glyphs'
import { CHROME_ROWS, FRAME_MS, HOLD_AFTER_MS, checkpoint, commandFor, fieldSize, fits, frameTick, handle, newHost } from '../hooks/host'
import type { Host, Report } from '../hooks/host'
import type { ArcadeProps } from '../types'

const PLAYING: ArcadeProps = { isPaused: false, reason: '', locale: 'en', glyphs: 'unicode', best: {} }
const WAITING: ArcadeProps = { ...PLAYING, isPaused: true, reason: 'asking' }

/** A host with `id` started in a 70 × 24 pane. */
function playing(id: string): Host {
  const s = newHost(PLAYING)
  s.selected = GAMES.findIndex(def => def.id === id)
  handle(s, 'primary', 70, 24)
  return s
}

/** Bricks with the ball in the air. */
function rally(): { s: Host; g: Game } {
  const s = playing('bricks')
  handle(s, 'primary', 70, 24)
  const g = s.run?.g as Game
  expect(g.phase).toBe('play')
  return { s, g }
}

/** Claude needs the person for five seconds, then works again. */
function interrupt(s: Host): void {
  s.props = WAITING
  for (let ms = 0; ms < 5000; ms += FRAME_MS) frameTick(s, 70)
  s.props = PLAYING
}

/** Plays Bricks without moving the paddle until the last ball is lost. */
function loseBricks(s: Host): Report[] {
  const reports: Report[] = []
  for (let i = 0; i < 20000; i++) {
    const run = s.run
    if (!run || run.def.status(run.g) === 'over') break
    if (run.def.status(run.g) === 'ready') handle(s, 'primary', 70, 24)
    const out = frameTick(s, 70)
    if (out.report) reports.push(out.report)
  }
  return reports
}

/** Merge with a board where sliding left merges two 8s. */
function scoring(): Host {
  const s = playing('merge')
  const g = s.run?.g as Merge
  g.grid = [8, 8, ...Array<number>(14).fill(0)]
  return s
}

describe('keys', () => {
  test('arrows, WASD and vim keys move', () => {
    expect(commandFor({ key: 'left' })).toBe('left')
    expect(commandFor({ key: 'A' })).toBe('left')
    expect(commandFor({ key: 'l' })).toBe('right')
    expect(commandFor({ key: 'w' })).toBe('up')
    expect(commandFor({ key: 'j' })).toBe('down')
  })

  test('space and enter are the main action, Q and Backspace the menu, P the pause', () => {
    expect(commandFor({ key: ' ' })).toBe('primary')
    expect(commandFor({ key: 'return' })).toBe('primary')
    expect(commandFor({ key: 'q' })).toBe('menu')
    expect(commandFor({ key: 'backspace' })).toBe('menu')
    expect(commandFor({ key: 'P' })).toBe('pause')
  })

  test('F and X are the second action', () => {
    expect(commandFor({ key: 'f' })).toBe('secondary')
    expect(commandFor({ key: 'X' })).toBe('secondary')
  })

  test('a Russian layout reaches the same commands', () => {
    expect(commandFor({ key: 'й' })).toBe('menu')
    expect(commandFor({ key: 'з' })).toBe('pause')
    expect(commandFor({ key: 'ф' })).toBe('left')
    expect(commandFor({ key: 'а' })).toBe('secondary')
  })

  test('keys with ctrl are left to the terminal', () => {
    expect(commandFor({ key: 'c', ctrl: true })).toBeUndefined()
  })
})

describe('menu', () => {
  test('starts in the menu and wraps around the list', () => {
    const s = newHost(PLAYING)
    expect(s.run).toBeUndefined()
    handle(s, 'up', 70, 24)
    expect(s.selected).toBe(GAMES.length - 1)
    handle(s, 'down', 70, 24)
    expect(s.selected).toBe(0)
  })

  test('enter starts the selected game, Q goes back to the menu', () => {
    const s = newHost(PLAYING)
    handle(s, 'primary', 70, 24)
    expect(s.run?.def.id).toBe(GAMES[0]?.id)
    handle(s, 'menu', 70, 24)
    expect(s.run).toBeUndefined()
  })

  test('every game has a sign for the menu, two cells wide in both glyph sets', () => {
    for (const def of GAMES) {
      for (const set of ['unicode', 'ascii'] as const) {
        const sign = def
          .sign(GLYPHS[set])
          .map(seg => seg.text)
          .join('')
        expect([def.id, set, textWidth(sign)]).toEqual([def.id, set, 2])
        if (set === 'ascii') expect(sign).toMatch(/^[ -~]*$/)
      }
    }
  })

  test('the title is drawn letter by letter, every letter as wide and as tall as the others', () => {
    for (const set of ['unicode', 'ascii'] as const) {
      const { logo } = GLYPHS[set]
      expect(logo).toHaveLength(6)
      for (const letter of logo) {
        expect([set, letter.length]).toEqual([set, logo[0]!.length])
        for (const row of letter) {
          expect([set, row, textWidth(row)]).toEqual([set, row, 3])
          if (set === 'ascii') expect(row).toMatch(/^[ -~]*$/)
        }
      }
    }
  })

  test('Q still leaves a game while Claude needs you', () => {
    const s = playing('bricks')
    s.props = WAITING
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    expect(handle(s, 'menu', 70, 24).changed).toBe(true)
    expect(s.run).toBeUndefined()
  })
})

describe('pause', () => {
  test('P stops the clock and the keys, P again resumes', () => {
    const { s, g } = rally()
    expect(frameTick(s, 70).changed).toBe(true)
    handle(s, 'pause', 70, 24)
    expect(s.isManuallyPaused).toBe(true)
    const at = { x: g.ballX, y: g.ballY, paddle: g.paddleX }
    for (let i = 0; i < 10; i++) expect(frameTick(s, 70).changed).toBe(false)
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    expect({ x: g.ballX, y: g.ballY, paddle: g.paddleX }).toEqual(at)
    handle(s, 'pause', 70, 24)
    expect(frameTick(s, 70).changed).toBe(true)
    expect(g.ballY).not.toBe(at.y)
  })

  test('a ball in the air stands still while Claude needs you, and after it until P', () => {
    const { s, g } = rally()
    expect(frameTick(s, 70).changed).toBe(true)
    s.props = WAITING
    const at = { x: g.ballX, y: g.ballY, paddle: g.paddleX, lives: g.lives }
    for (let i = 0; i < 200; i++) expect(frameTick(s, 70).changed).toBe(false)
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    expect(handle(s, 'pause', 70, 24).changed).toBe(false)
    expect({ x: g.ballX, y: g.ballY, paddle: g.paddleX, lives: g.lives }).toEqual(at)
    // No time piles up for the moment Claude is back at work.
    expect(s.run?.carry).toBe(0)

    // Claude is back at work, but the keys may still be at the prompt: the
    // ball waits for the person.
    s.props = PLAYING
    for (let i = 0; i < 200; i++) expect(frameTick(s, 70).changed).toBe(false)
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    expect({ x: g.ballX, y: g.ballY, paddle: g.paddleX, lives: g.lives }).toEqual(at)

    expect(handle(s, 'pause', 70, 24).changed).toBe(true)
    expect(frameTick(s, 70).changed).toBe(true)
    expect(g.ballY).not.toBe(at.y)
  })

  test('a moment in which nobody was asked anything does not hold the ball', () => {
    const { s, g } = rally()
    // Twice just under the time that holds: the moments do not add up.
    for (let round = 0; round < 2; round++) {
      s.props = WAITING
      const y = g.ballY
      for (let ms = FRAME_MS; ms < HOLD_AFTER_MS; ms += FRAME_MS) expect(frameTick(s, 70).changed).toBe(false)
      s.props = PLAYING
      expect(frameTick(s, 70).changed).toBe(true)
      expect(s.isManuallyPaused).toBe(false)
      expect(g.ballY).not.toBe(y)
    }
  })

  test('a ball still on the paddle is not held: it waits for Space anyway', () => {
    const s = playing('bricks')
    interrupt(s)
    expect(s.isManuallyPaused).toBe(false)
    expect(handle(s, 'primary', 70, 24).changed).toBe(true)
    expect(frameTick(s, 70).changed).toBe(true)
  })

  test('every game on the clock stays paused after Claude interrupted it, until P', () => {
    const ids = GAMES.filter(def => def.tickMs > 0).map(def => def.id)
    expect(ids).toContain('meteors')
    for (const id of ids) {
      const s = playing(id)
      // Bricks launches its ball; the others start on Space as well.
      handle(s, 'primary', 70, 24)
      expect([id, s.run?.def.status(s.run.g)]).toEqual([id, 'play'])
      interrupt(s)
      expect([id, s.isManuallyPaused]).toEqual([id, true])
      for (let i = 0; i < 100; i++) expect(frameTick(s, 70).changed).toBe(false)
      expect([id, handle(s, 'left', 70, 24).changed]).toEqual([id, false])
      handle(s, 'pause', 70, 24)
      expect([id, s.isManuallyPaused]).toEqual([id, false])
    }
  })

  test('Meteors waits for Space before the first rock, and a ship not yet started is not held', () => {
    const s = playing('meteors')
    interrupt(s)
    expect(s.isManuallyPaused).toBe(false)
    expect(handle(s, 'primary', 70, 24).changed).toBe(true)
  })

  test('a game that only moves on keys goes on as soon as Claude works again', () => {
    const s = scoring()
    s.props = WAITING
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    interrupt(s)
    expect(s.isManuallyPaused).toBe(false)
    expect(handle(s, 'left', 70, 24).changed).toBe(true)
  })

  test('a game left while it was held starts the next one unpaused', () => {
    const { s } = rally()
    interrupt(s)
    expect(s.isManuallyPaused).toBe(true)
    handle(s, 'menu', 70, 24)
    handle(s, 'primary', 70, 24)
    expect(s.isManuallyPaused).toBe(false)
  })

  test('a game cannot be started into while Claude needs you', () => {
    const s = newHost(WAITING)
    handle(s, 'primary', 70, 24)
    expect(handle(s, 'primary', 70, 24).changed).toBe(false)
    expect(s.run?.def.status(s.run.g)).toBe('ready')
  })
})

describe('scores', () => {
  test('a game over is reported once, with the game and the score', () => {
    const s = playing('bricks')
    const reports = loseBricks(s)
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ type: 'score', game: 'bricks' })

    // The end screen stands still: no key but Space does anything, and
    // nothing is reported twice.
    const g = s.run?.g as Game
    const paddle = g.paddleX
    for (const key of ['left', 'right', 'up', 'down', 'secondary', 'pause'] as const) {
      expect(handle(s, key, 70, 24)).toEqual({ changed: false })
    }
    for (let i = 0; i < 50; i++) expect(frameTick(s, 70)).toEqual({ changed: false })
    expect(g.paddleX).toBe(paddle)
    expect(s.run?.def.status(s.run.g)).toBe('over')
  })

  test('the game after a game over is reported too', () => {
    const s = playing('bricks')
    expect(loseBricks(s)).toHaveLength(1)
    expect(handle(s, 'primary', 70, 24).changed).toBe(true)
    expect(s.run?.def.status(s.run.g)).toBe('ready')
    expect(loseBricks(s)).toHaveLength(1)
  })

  test('a game that ends on a key, not a tick, is reported too', () => {
    const s = playing('merge')
    const g = s.run?.g as Merge
    // The new tile is a 2 in the first free field: no move left after it.
    g.random = () => 0
    // prettier-ignore
    g.grid = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      16, 32, 64, 128,
      4, 8, 16, 0,
    ]
    const out = handle(s, 'right', 70, 24)
    expect(out.report).toMatchObject({ type: 'score', game: 'merge' })
    expect(handle(s, 'primary', 70, 24).changed).toBe(true)
    expect(s.run?.def.status(s.run.g)).toBe('play')
  })

  test('leaving a game with Q keeps what was scored', () => {
    const s = scoring()
    expect(handle(s, 'left', 70, 24).report).toBeUndefined()
    expect(handle(s, 'menu', 70, 24)).toEqual({ changed: true, report: { type: 'score', game: 'merge', score: 16 } })
  })

  test('leaving a game nothing was scored in reports nothing', () => {
    const s = playing('merge')
    expect(handle(s, 'menu', 70, 24)).toEqual({ changed: true, report: undefined })
  })

  test('a record is handed over while the game still runs, once per score', () => {
    const s = scoring()
    expect(checkpoint(s)).toBeUndefined()
    handle(s, 'left', 70, 24)
    expect(checkpoint(s)).toEqual({ type: 'score', game: 'merge', score: 16 })
    expect(checkpoint(s)).toBeUndefined()
    // The game goes on, and leaving it still counts.
    expect(s.run?.def.status(s.run.g)).toBe('play')
    expect(handle(s, 'menu', 70, 24).report).toMatchObject({ score: 16 })
    expect(checkpoint(s)).toBeUndefined()
  })

  test('a score below the record is not handed over early', () => {
    const s = scoring()
    s.props = { ...PLAYING, best: { merge: 500 } }
    handle(s, 'left', 70, 24)
    expect(checkpoint(s)).toBeUndefined()
  })

  test('leaving a finished game does not report it a second time', () => {
    const s = playing('bricks')
    expect(loseBricks(s)).toHaveLength(1)
    expect(handle(s, 'menu', 70, 24).report).toBeUndefined()
  })
})

describe('field size', () => {
  const [bricks] = GAMES

  test('the field fills the pane, less the border and the lines around it', () => {
    expect(CHROME_ROWS).toBe(5)
    expect(fieldSize(bricks!, 60, 22)).toEqual({ w: 58, h: 17 })
  })

  test('the field is never larger than the game wants, nor smaller than it needs', () => {
    expect(fieldSize(bricks!, 500, 200)).toEqual({ w: bricks!.maxW, h: bricks!.maxH })
    expect(fieldSize(bricks!, 10, 5)).toEqual({ w: bricks!.minW, h: bricks!.minH })
  })

  test('a pane narrower than the field stops the game until it is wide again', () => {
    const { s, g } = rally()
    const run = s.run!
    expect(fits(run, 70)).toBe(true)
    expect(fits(run, run.w + 1)).toBe(false)

    const at = { x: g.ballX, y: g.ballY }
    for (let i = 0; i < 10; i++) expect(frameTick(s, 40).changed).toBe(false)
    expect(handle(s, 'left', 40, 24).changed).toBe(false)
    expect(handle(s, 'pause', 40, 24).changed).toBe(false)
    expect({ x: g.ballX, y: g.ballY }).toEqual(at)

    expect(frameTick(s, 70).changed).toBe(true)
  })

  test('a game started in a pane too narrow for it waits, and Q still leaves', () => {
    const s = newHost(PLAYING)
    handle(s, 'primary', 20, 24)
    expect(s.run?.w).toBe(bricks!.minW)
    expect(fits(s.run!, 20)).toBe(false)
    expect(handle(s, 'primary', 20, 24).changed).toBe(false)
    expect(handle(s, 'menu', 20, 24).changed).toBe(true)
  })

  test('a pane not laid out yet does not count as too narrow', () => {
    expect(fits(playing('bricks').run!, 0)).toBe(true)
  })
})
