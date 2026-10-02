import { describe, expect, test } from 'claude-code/testing'

import { GAMES } from '../hooks/games'
import { FRAME_MS, commandFor, frameTick, handle, newHost } from '../hooks/host'
import type { ArcadeProps } from '../types'

const PLAYING: ArcadeProps = { isPaused: false, reason: '', locale: 'en', glyphs: 'unicode', best: {} }

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

  test('a Russian layout reaches the same commands', () => {
    expect(commandFor({ key: 'й' })).toBe('menu')
    expect(commandFor({ key: 'з' })).toBe('pause')
    expect(commandFor({ key: 'ф' })).toBe('left')
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

  test('Q still leaves a game while Claude needs you', () => {
    const s = newHost(PLAYING)
    handle(s, 'primary', 70, 24)
    s.props = { ...PLAYING, isPaused: true, reason: 'done' }
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    expect(handle(s, 'menu', 70, 24).changed).toBe(true)
  })
})

describe('pause', () => {
  test('P stops the clock and the keys, P again resumes', () => {
    const s = newHost(PLAYING)
    handle(s, 'primary', 70, 24)
    handle(s, 'primary', 70, 24)
    handle(s, 'pause', 70, 24)
    expect(s.isManuallyPaused).toBe(true)
    expect(frameTick(s).changed).toBe(false)
    expect(handle(s, 'left', 70, 24).changed).toBe(false)
    handle(s, 'pause', 70, 24)
    expect(frameTick(s).changed).toBe(true)
  })

  test('nothing moves while Claude needs you', () => {
    const s = newHost({ ...PLAYING, isPaused: true, reason: 'asking' })
    handle(s, 'primary', 70, 24)
    expect(handle(s, 'primary', 70, 24).changed).toBe(false)
    expect(frameTick(s).changed).toBe(false)
    expect(handle(s, 'pause', 70, 24).changed).toBe(false)
  })
})

test('a game over is reported once, with the game and the score', () => {
  const s = newHost(PLAYING)
  handle(s, 'primary', 70, 24)
  handle(s, 'primary', 70, 24)
  const reports: unknown[] = []
  for (let i = 0; i < 20000 && reports.length < 2; i++) {
    // Serve again after each lost ball, never once the game is over.
    const run = s.run
    if (run && run.def.status(run.g) === 'ready') handle(s, 'primary', 70, 24)
    const out = frameTick(s)
    if (out.report) reports.push(out.report)
  }
  expect(reports).toHaveLength(1)
  expect(reports[0]).toMatchObject({ type: 'over', game: 'breakout' })
  expect(FRAME_MS).toBeGreaterThan(0)
})
