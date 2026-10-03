import { describe, expect, test } from 'claude-code/testing'

import {
  BONUS_SCORE,
  MIN_FRAMES,
  SCORE_PER_LEVEL,
  SHIP_STEP,
  SPAWN_GAP,
  SPAWN_ROWS,
  START_LIVES,
  frame,
  framesPerRow,
  meteors,
  newMeteors,
  press,
  shipRow,
  spawn,
  spawnEvery,
  tick,
  trailOf,
} from '../hooks/games/meteors'
import type { Meteors, Rock, Size } from '../hooks/games/meteors'
import { GLYPHS } from '../hooks/glyphs'
import { expectFrames, lines } from './frames'

/** A seeded random function, so every run of the tests plays the same game. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

/** A game under way with an empty sky: nothing appears unless the test puts it there. */
function playing(w = 40, h = 16): Meteors {
  const g = newMeteors(w, h, seeded(1))
  press(g, 'primary')
  g.spawnIn = 1e9
  return g
}

/** A rock that moves on the very next tick. */
function rock(x: number, y: number, size: Size = 1): Rock {
  return { x, y, size, every: 1, wait: 1 }
}

/** The shortest way to be hit: a rock one row above the ship, right over it. */
function dropOnShip(g: Meteors): void {
  g.rocks = [rock(g.shipX, shipRow(g) - 1)]
}

/** Frames until a rock stands on the ship's row over `x`; Infinity when none will. */
function threat(g: Meteors, x: number): number {
  let soonest = Infinity
  for (const r of g.rocks) {
    if (x < r.x || x >= r.x + r.size) continue
    const rows = shipRow(g) - r.y
    soonest = Math.min(soonest, rows <= 0 ? 0 : (rows - 1) * r.every + r.wait)
  }
  return soonest
}

describe('meteors', () => {
  test('waits for Space with the ship in the middle of the bottom row', () => {
    const g = newMeteors(40, 16, seeded(1))
    expect(g.phase).toBe('ready')
    expect(g.shipX).toBe(20)
    expect(g.lives).toBe(START_LIVES)
    expect(tick(g)).toBe('none')
    expect(g.rocks).toHaveLength(0)
    expect(meteors.banner(g)).toBe('start')
    expect(press(g, 'up')).toBe(false)
    expect(press(g, 'primary')).toBe(true)
    expect(g.phase).toBe('play')
    expect(press(g, 'primary')).toBe(false)
    expect(meteors.banner(g)).toBeUndefined()
  })

  test('the ship slides two cells a key and stays inside the field', () => {
    const g = playing()
    press(g, 'left')
    expect(g.shipX).toBe(20 - SHIP_STEP)
    for (let i = 0; i < 100; i++) press(g, 'left')
    expect(g.shipX).toBe(0)
    expect(press(g, 'left')).toBe(false)
    for (let i = 0; i < 100; i++) press(g, 'right')
    expect(g.shipX).toBe(g.w - 1)
    expect(press(g, 'right')).toBe(false)
  })

  test('the ship also moves while waiting, but nothing falls', () => {
    const g = newMeteors(40, 16, seeded(1))
    expect(press(g, 'right')).toBe(true)
    expect(g.shipX).toBe(20 + SHIP_STEP)
    expect(tick(g)).toBe('none')
  })

  test('each rock falls at its own pace', () => {
    const g = playing()
    g.rocks = [
      { x: 3, y: 0, size: 1, every: 2, wait: 2 },
      { x: 9, y: 0, size: 3, every: 5, wait: 5 },
    ]
    expect(tick(g)).toBe('none')
    expect(tick(g)).toBe('changed')
    expect(g.rocks.map(r => r.y)).toEqual([1, 0])
    for (let i = 0; i < 8; i++) tick(g)
    expect(g.rocks.map(r => r.y)).toEqual([5, 2])
  })

  test('small rocks are faster than big ones, and all get faster with the level', () => {
    const g = playing()
    expect([1, 2, 3].map(size => framesPerRow(g, size as Size))).toEqual([6, 7, 8])
    g.level = 3
    expect(framesPerRow(g, 2)).toBe(6)
    g.level = 100
    expect(framesPerRow(g, 2)).toBe(MIN_FRAMES)
    expect(framesPerRow(g, 1)).toBe(MIN_FRAMES - 1)
  })

  test('a rock that passes the bottom row scores a point', () => {
    const g = playing()
    g.rocks = [rock(0, shipRow(g), 3)]
    expect(tick(g)).toBe('changed')
    expect(g.rocks).toHaveLength(0)
    expect(g.score).toBe(1)
  })

  test('a rock that lands on the ship costs a life and clears the field', () => {
    const g = playing()
    dropOnShip(g)
    g.rocks.push(rock(0, 3, 3))
    g.bonuses = [{ x: 9, y: 2, every: 1, wait: 1 }]
    expect(tick(g)).toBe('changed')
    expect(g.lives).toBe(START_LIVES - 1)
    expect(g.rocks).toHaveLength(0)
    expect(g.bonuses).toHaveLength(0)
    // Space brings the next ship.
    expect(g.phase).toBe('ready')
    expect(tick(g)).toBe('none')
    expect(meteors.banner(g)).toBe('continue')
    press(g, 'primary')
    expect(g.phase).toBe('play')
  })

  test('a wide rock hits with any of its cells, its trail with none', () => {
    const g = playing()
    g.rocks = [rock(g.shipX - 2, shipRow(g) - 1, 3)]
    tick(g)
    expect(g.lives).toBe(START_LIVES - 1)
    const h = playing()
    h.rocks = [rock(h.shipX - 3, shipRow(h) - 1, 3)]
    tick(h)
    expect(h.lives).toBe(START_LIVES)
    // A rock just past the ship's row is gone, and so is the trail behind it.
    const t = playing()
    t.rocks = [rock(t.shipX, shipRow(t))]
    tick(t)
    expect(t.lives).toBe(START_LIVES)
    expect(lines(frame(t, GLYPHS.ascii)).join('')).not.toContain(GLYPHS.ascii.rockTrail)
  })

  test('sliding into a rock on the bottom row is a hit, and the ship cannot jump one', () => {
    const g = playing()
    g.rocks = [{ x: g.shipX + SHIP_STEP, y: shipRow(g), size: 1, every: 9, wait: 9 }]
    expect(press(g, 'right')).toBe(true)
    expect(g.lives).toBe(START_LIVES - 1)
    expect(g.phase).toBe('ready')
    const h = playing()
    h.rocks = [{ x: h.shipX - 1, y: shipRow(h), size: 1, every: 9, wait: 9 }]
    press(h, 'left')
    expect(h.lives).toBe(START_LIVES - 1)
  })

  test('the third hit ends the game, and the game says so on its own key', () => {
    const g = playing()
    for (let i = 0; i < START_LIVES - 1; i++) {
      dropOnShip(g)
      tick(g)
      press(g, 'primary')
      g.spawnIn = 1e9
    }
    dropOnShip(g)
    expect(tick(g)).toBe('over')
    expect(g.lives).toBe(0)
    expect(meteors.status(g)).toBe('over')
    // The arcade's usual game-over line.
    expect(meteors.banner(g)).toBeUndefined()
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'primary')).toBe(false)
    expect(tick(g)).toBe('none')
  })

  test('a bonus caught by the ship scores extra and is gone', () => {
    const g = playing()
    g.bonuses = [{ x: g.shipX, y: shipRow(g) - 1, every: 1, wait: 1 }]
    tick(g)
    expect(g.score).toBe(BONUS_SCORE)
    expect(g.bonuses).toHaveLength(0)
    expect(g.lives).toBe(START_LIVES)
  })

  test('a bonus can be caught by sliding over it, and one that is missed scores nothing', () => {
    const g = playing()
    g.bonuses = [{ x: g.shipX + 1, y: shipRow(g), every: 9, wait: 9 }]
    press(g, 'right')
    expect(g.score).toBe(BONUS_SCORE)
    g.bonuses = [{ x: 0, y: shipRow(g) - 1, every: 1, wait: 1 }]
    tick(g)
    tick(g)
    expect(g.bonuses).toHaveLength(0)
    expect(g.score).toBe(BONUS_SCORE)
  })

  test('the level rises with the score, and rocks then come sooner', () => {
    const g = playing()
    expect(g.level).toBe(1)
    const first = spawnEvery(g)
    g.score = SCORE_PER_LEVEL - 1
    g.rocks = [rock(0, shipRow(g))]
    tick(g)
    expect(g.level).toBe(2)
    expect(spawnEvery(g)).toBeLessThan(first)
    g.level = 100
    expect(spawnEvery(g)).toBeGreaterThanOrEqual(2)
    // A wider field gets its rocks sooner, so every column sees the same.
    g.level = 1
    expect(spawnEvery(newMeteors(60, 16))).toBeLessThan(spawnEvery(g))
  })

  test('the sky starts almost empty: a handful of rocks, far apart', () => {
    for (const w of [25, 40, 60]) {
      const g = newMeteors(w, 16, seeded(w))
      press(g, 'primary')
      let most = 0
      let covered = 0
      const frames = 1500
      for (let i = 0; i < frames; i++) {
        // Stays on the first level and out of the way: only the sky is watched.
        g.score = 0
        g.level = 1
        g.shipX = 0
        g.rocks = g.rocks.filter(r => !(r.x === 0 && r.y >= shipRow(g) - 1))
        tick(g)
        most = Math.max(most, g.rocks.length)
        covered += g.rocks.reduce((n, r) => n + r.size, 0)
      }
      expect(g.lives).toBe(START_LIVES)
      // On average not even one cell in twenty of the field holds a rock.
      expect([w, covered / frames / (g.w * g.h) < 0.05]).toEqual([w, true])
      expect([w, most > 2]).toEqual([w, true])
    }
  })

  test('a new rock never appears right next to one that has just appeared', () => {
    const g = newMeteors(30, 16, seeded(9))
    g.level = 12
    let spawned = 0
    for (let i = 0; i < 2000; i++) {
      const before = g.rocks.length
      spawn(g)
      const fresh = g.rocks[before]
      if (fresh) {
        spawned++
        for (const r of g.rocks.slice(0, before)) {
          if (r.y >= SPAWN_ROWS) continue
          const gap = fresh.x >= r.x + r.size ? fresh.x - (r.x + r.size) : r.x - (fresh.x + fresh.size)
          expect(gap).toBeGreaterThanOrEqual(SPAWN_GAP)
        }
        expect(fresh.x).toBeGreaterThanOrEqual(0)
        expect(fresh.x + fresh.size).toBeLessThanOrEqual(g.w)
      }
      // The rocks sink now and then, as they do in play.
      if (i % 3 === 0) for (const r of g.rocks) r.y += 1
      g.rocks = g.rocks.filter(r => r.y < g.h)
    }
    expect(spawned).toBeGreaterThan(500)
  })

  test('a ship that just steps aside survives the first minute', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = newMeteors(40, 16, seeded(seed))
      press(g, 'primary')
      for (let frames = 0; frames < 1800 && g.phase === 'play'; frames++) {
        // One key every third frame, and only when a rock is about to land.
        if (frames % 3 === 0 && threat(g, g.shipX) < 30) {
          const left = Math.max(0, g.shipX - SHIP_STEP)
          const right = Math.min(g.w - 1, g.shipX + SHIP_STEP)
          const to = threat(g, left) > threat(g, right) ? left : right
          const between = (to + g.shipX) / 2
          if (threat(g, to) > 0 && threat(g, Math.round(between)) > 0) press(g, to < g.shipX ? 'left' : 'right')
        }
        tick(g)
      }
      expect([seed, g.lives]).toEqual([seed, START_LIVES])
      expect(g.score).toBeGreaterThan(SCORE_PER_LEVEL)
    }
  })

  test('now and then a bonus falls instead of a rock', () => {
    const g = newMeteors(40, 16, seeded(3))
    for (let i = 0; i < 400; i++) spawn(g)
    expect(g.bonuses.length).toBeGreaterThan(0)
    expect(g.bonuses.length).toBeLessThan(80)
    for (const b of g.bonuses) expect(b.x >= 0 && b.x < g.w).toBe(true)
  })

  test('a rock leaves a trail behind it that hides nothing', () => {
    expect(trailOf(rock(5, 4, 1))).toEqual([{ x: 5, y: 3, age: 0 }, { x: 5, y: 2, age: 1 }])
    expect(trailOf(rock(5, 4, 2))).toEqual([{ x: 5, y: 3, age: 0 }, { x: 6, y: 3, age: 0 }])
    expect(trailOf(rock(5, 4, 3)).at(-1)).toEqual({ x: 6, y: 2, age: 1 })
    const g = newMeteors(25, 14, seeded(1))
    const glyphs = GLYPHS.ascii
    // A rock right behind another, a bonus and the ship in a trail: all still shown.
    g.rocks = [rock(4, 5), rock(4, 4), rock(g.shipX, shipRow(g) + 1), rock(9, 5)]
    g.bonuses = [{ x: 9, y: 4, every: 1, wait: 1 }]
    const text = lines(frame(g, glyphs))
    expect(text[5]?.[4]).toBe(glyphs.rockSmall)
    expect(text[4]?.[4]).toBe(glyphs.rockSmall)
    expect(text[3]?.[4]).toBe(glyphs.rockTrail)
    expect(text[2]?.[4]).toBe(glyphs.rockTrail)
    expect(text[4]?.[9]).toBe(glyphs.bonus)
    expect(text[shipRow(g)]?.[g.shipX]).toBe(glyphs.ship)
  })

  test('frames are as wide as the field in both glyph sets', () => {
    const g = newMeteors(40, 16, seeded(5))
    press(g, 'primary')
    for (let i = 0; i < 300 && g.phase === 'play'; i++) tick(g)
    g.bonuses.push({ x: 4, y: 3, every: 1, wait: 1 })
    g.rocks.push(rock(0, 0), rock(2, 1, 2), rock(37, 2, 3))
    expectFrames(glyphs => meteors.frame(g, glyphs), g.w, g.h)
    const small = newMeteors(10, 5, seeded(1))
    expect([small.w, small.h]).toEqual([25, 14])
    expectFrames(glyphs => frame(small, glyphs), 25, 14)
  })

  test('ship, the three rocks, the trail and the bonus look different without colors, in both sets', () => {
    for (const set of ['unicode', 'ascii'] as const) {
      const glyphs = GLYPHS[set]
      const all = [glyphs.ship, glyphs.rockSmall, glyphs.rockMid, glyphs.rockBig, glyphs.rockTrail, glyphs.bonus]
      expect([set, new Set(all).size]).toEqual([set, all.length])
      expect([set, Array.from(glyphs.rockSmall).length]).toEqual([set, 1])
      expect([set, Array.from(glyphs.rockMid).length]).toEqual([set, 2])
      expect([set, Array.from(glyphs.rockBig).length]).toEqual([set, 3])
      expect([set, Array.from(glyphs.rockTrail).length]).toEqual([set, 1])
    }
  })

  test('the frame draws each thing where it is', () => {
    const g = newMeteors(25, 14, seeded(1))
    g.rocks = [rock(1, 0), rock(3, 1, 2), rock(7, 2, 3)]
    g.bonuses = [{ x: 12, y: 3, every: 1, wait: 1 }]
    const glyphs = GLYPHS.ascii
    const text = lines(frame(g, glyphs))
    expect(text[0]?.slice(1, 2)).toBe(glyphs.rockSmall)
    expect(text[1]?.slice(3, 5)).toBe(glyphs.rockMid)
    expect(text[2]?.slice(7, 10)).toBe(glyphs.rockBig)
    expect(text[1]?.slice(7, 10)).toBe(glyphs.rockTrail.repeat(3))
    expect(text[3]?.[12]).toBe(glyphs.bonus)
    expect(text[13]?.[g.shipX]).toBe(glyphs.ship)
  })
})
