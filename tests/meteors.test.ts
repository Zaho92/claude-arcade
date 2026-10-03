import { describe, expect, test } from 'claude-code/testing'

import {
  BONUS_SCORE,
  LANE_HALF,
  MIN_FRAMES,
  ROW_GAP,
  START_LIVES,
  fall,
  frame,
  framesPerFall,
  laneReach,
  meteors,
  newMeteors,
  press,
  shipRow,
  spawnRow,
  tick,
} from '../hooks/games/meteors'
import type { Meteors } from '../hooks/games/meteors'
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

// Never rolls below 0.99: no empty rows, no bonus, no rocks at any level.
const never = () => 0.99

function playing(w = 40, h = 16, random: () => number = never): Meteors {
  const g = newMeteors(w, h, random)
  press(g, 'primary')
  return g
}

/** The shortest way to be hit: a rock one row above the ship, right over it. */
function dropOnShip(g: Meteors): void {
  g.rocks = [{ x: g.shipX, y: shipRow(g) - 1, size: 1 }]
}

describe('meteors', () => {
  test('waits for Space with the ship in the middle of the bottom row', () => {
    const g = newMeteors(40, 16, never)
    expect(g.phase).toBe('ready')
    expect(g.shipX).toBe(20)
    expect(g.lives).toBe(START_LIVES)
    expect(tick(g)).toBe('none')
    expect(meteors.banner(g)).toBe('start')
    expect(press(g, 'up')).toBe(false)
    expect(press(g, 'primary')).toBe(true)
    expect(g.phase).toBe('play')
    expect(press(g, 'primary')).toBe(false)
    expect(meteors.banner(g)).toBeUndefined()
  })

  test('the ship slides one cell a key and stays inside the field', () => {
    const g = playing()
    press(g, 'left')
    expect(g.shipX).toBe(19)
    for (let i = 0; i < 100; i++) press(g, 'left')
    expect(g.shipX).toBe(0)
    expect(press(g, 'left')).toBe(false)
    for (let i = 0; i < 100; i++) press(g, 'right')
    expect(g.shipX).toBe(g.w - 1)
    expect(press(g, 'right')).toBe(false)
  })

  test('the ship also moves while waiting, but nothing falls', () => {
    const g = newMeteors(40, 16, never)
    expect(press(g, 'right')).toBe(true)
    expect(g.shipX).toBe(21)
    expect(tick(g)).toBe('none')
  })

  test('rocks fall one row per fall, on the clock of the level', () => {
    const g = playing()
    g.rocks = [{ x: 3, y: 4, size: 2 }]
    g.wait = framesPerFall(g)
    let frames = 1
    while (tick(g) === 'none') frames++
    expect(frames).toBe(framesPerFall(g))
    expect(g.rocks[0]?.y).toBe(5)
  })

  test('a rock that passes the bottom row scores a point', () => {
    const g = playing()
    g.rocks = [{ x: 0, y: shipRow(g), size: 3 }]
    expect(fall(g)).toBe('changed')
    expect(g.rocks).toHaveLength(0)
    expect(g.score).toBe(1)
  })

  test('a rock that lands on the ship costs a life and clears the field', () => {
    const g = playing()
    dropOnShip(g)
    g.rocks.push({ x: 0, y: 3, size: 3 })
    g.bonuses = [{ x: 9, y: 2 }]
    expect(fall(g)).toBe('changed')
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

  test('a wide rock hits with any of its cells', () => {
    const g = playing()
    g.rocks = [{ x: g.shipX - 2, y: shipRow(g) - 1, size: 3 }]
    fall(g)
    expect(g.lives).toBe(START_LIVES - 1)
    const h = playing()
    h.rocks = [{ x: h.shipX - 3, y: shipRow(h) - 1, size: 3 }]
    fall(h)
    expect(h.lives).toBe(START_LIVES)
  })

  test('sliding into a rock on the bottom row is a hit too', () => {
    const g = playing()
    g.rocks = [{ x: g.shipX + 1, y: shipRow(g), size: 1 }]
    expect(press(g, 'right')).toBe(true)
    expect(g.lives).toBe(START_LIVES - 1)
    expect(g.phase).toBe('ready')
  })

  test('the third hit ends the game, and the game says so on its own key', () => {
    const g = playing()
    for (let i = 0; i < START_LIVES - 1; i++) {
      dropOnShip(g)
      fall(g)
      press(g, 'primary')
    }
    dropOnShip(g)
    expect(fall(g)).toBe('over')
    expect(g.lives).toBe(0)
    expect(meteors.status(g)).toBe('over')
    // The arcade's usual game-over line.
    expect(meteors.banner(g)).toBeUndefined()
    expect(press(g, 'left')).toBe(false)
    expect(press(g, 'primary')).toBe(false)
    expect(tick(g)).toBe('none')
  })

  test('a hit by sliding can end the game as well', () => {
    const g = playing()
    g.lives = 1
    g.rocks = [{ x: g.shipX - 1, y: shipRow(g), size: 1 }]
    expect(press(g, 'left')).toBe(true)
    expect(g.phase).toBe('over')
  })

  test('a bonus caught by the ship scores extra and is gone', () => {
    const g = playing()
    g.bonuses = [{ x: g.shipX, y: shipRow(g) - 1 }]
    fall(g)
    expect(g.score).toBe(BONUS_SCORE)
    expect(g.bonuses).toHaveLength(0)
    expect(g.lives).toBe(START_LIVES)
  })

  test('a bonus can be caught by sliding under it, and one that is missed scores nothing', () => {
    const g = playing()
    g.bonuses = [{ x: g.shipX + 1, y: shipRow(g) }]
    press(g, 'right')
    expect(g.score).toBe(BONUS_SCORE)
    g.bonuses = [{ x: 0, y: shipRow(g) - 1 }]
    fall(g)
    fall(g)
    expect(g.bonuses).toHaveLength(0)
    expect(g.score).toBe(BONUS_SCORE)
  })

  test('the level rises with the score: faster falls, fuller rows', () => {
    const g = playing()
    expect(g.level).toBe(1)
    expect(framesPerFall(g)).toBe(6)
    g.bonuses = [{ x: g.shipX, y: shipRow(g) - 1 }]
    fall(g)
    g.bonuses = [{ x: g.shipX, y: shipRow(g) - 1 }]
    fall(g)
    expect(g.score).toBe(2 * BONUS_SCORE)
    expect(g.level).toBe(2)
    expect(framesPerFall(g)).toBe(5)
    g.score = 1000
    g.level = 101
    expect(framesPerFall(g)).toBe(MIN_FRAMES)
    // Rows hold more rocks at a higher level.
    const count = (level: number) => {
      const h = newMeteors(60, 16, seeded(7))
      h.level = level
      let n = 0
      for (let i = 0; i < 200; i++) {
        h.rocks = []
        spawnRow(h)
        n += h.rocks.length
      }
      return n
    }
    expect(count(8)).toBeGreaterThan(count(1))
  })

  test('every row keeps a free lane three cells wide, within reach of the lane before it', () => {
    const broken: string[] = []
    for (const w of [25, 40, 60]) {
      for (let seed = 1; seed <= 4; seed++) {
        const g = newMeteors(w, 16, seeded(seed))
        for (const level of [1, 3, 6, 12, 40]) {
          g.level = level
          let lane = g.lane
          for (let i = 0; i < 120; i++) {
            g.rocks = []
            g.bonuses = []
            spawnRow(g)
            if (g.rocks.length === 0 && g.lane === lane) continue
            const at = `w${w} seed${seed} level${level} row${i}`
            if (g.lane - LANE_HALF < 0 || g.lane + LANE_HALF >= w) broken.push(`${at}: lane outside the field`)
            for (let x = g.lane - LANE_HALF; x <= g.lane + LANE_HALF; x++) {
              if (g.rocks.some(r => x >= r.x && x < r.x + r.size)) broken.push(`${at}: rock in the lane`)
            }
            if (Math.abs(g.lane - lane) > laneReach(g)) broken.push(`${at}: lane jumped`)
            for (const r of g.rocks) if (r.x < 0 || r.x + r.size > w) broken.push(`${at}: rock outside the field`)
            lane = g.lane
          }
        }
      }
    }
    expect(broken).toEqual([])
  })

  test('the reach fits the time between rows at every speed', () => {
    const g = newMeteors(40, 16, never)
    for (let level = 1; level <= 40; level++) {
      g.level = level
      const frames = (ROW_GAP - 1) * framesPerFall(g)
      // The ship slides at least a cell per three frames; the lane may move
      // no further than that, and a lane three wide leaves a cell to spare.
      expect(laneReach(g)).toBeLessThanOrEqual(Math.max(1, Math.floor(frames / 3)))
    }
  })

  test('a ship that follows the lanes at the pace the spawning counts on is never hit, for a whole game', () => {
    const g = newMeteors(30, 16, seeded(42))
    press(g, 'primary')
    // Each row of rocks with its lane and the fall on which it reaches the ship.
    const rows: { lane: number; arrives: number }[] = []
    let falls = 0
    for (let frames = 0; frames < 60000 && g.phase === 'play'; frames++) {
      const next = rows.find(r => r.arrives >= falls)
      // One cell per three frames: the slowest slide the lane reach allows for.
      if (next && frames % 3 === 0 && Math.abs(next.lane - g.shipX) > LANE_HALF) press(g, next.lane < g.shipX ? 'left' : 'right')
      tick(g)
      if (g.wait === framesPerFall(g) && g.phase === 'play') {
        falls++
        if (g.rocks.some(r => r.y === 0)) rows.push({ lane: g.lane, arrives: falls + shipRow(g) })
      }
    }
    expect(g.lives).toBe(START_LIVES)
    expect(g.score).toBeGreaterThan(100)
  })

  test('a bonus never sits inside a rock', () => {
    const g = newMeteors(40, 16, seeded(3))
    let bonuses = 0
    for (let i = 0; i < 400; i++) {
      g.rocks = []
      g.bonuses = []
      spawnRow(g)
      for (const b of g.bonuses) {
        bonuses++
        expect(g.rocks.some(r => b.x >= r.x && b.x < r.x + r.size)).toBe(false)
      }
    }
    expect(bonuses).toBeGreaterThan(0)
  })

  test('frames are as wide as the field in both glyph sets', () => {
    const g = playing(40, 16, seeded(5))
    for (let i = 0; i < 40; i++) {
      g.wait = 1
      tick(g)
    }
    g.bonuses.push({ x: 4, y: 3 })
    g.rocks.push({ x: 0, y: 0, size: 1 }, { x: 2, y: 1, size: 2 }, { x: 6, y: 2, size: 3 })
    expect(g.rocks.length).toBeGreaterThanOrEqual(3)
    expectFrames(glyphs => meteors.frame(g, glyphs), g.w, g.h)
    const small = newMeteors(10, 5, never)
    expect([small.w, small.h]).toEqual([25, 14])
    expectFrames(glyphs => frame(small, glyphs), 25, 14)
  })

  test('ship, the three rocks and the bonus look different without colors, in both sets', () => {
    for (const set of ['unicode', 'ascii'] as const) {
      const glyphs = GLYPHS[set]
      const all = [glyphs.ship, glyphs.rockSmall, glyphs.rockMid, glyphs.rockBig, glyphs.bonus]
      expect([set, new Set(all).size]).toEqual([set, 5])
      expect([set, Array.from(glyphs.rockSmall).length]).toEqual([set, 1])
      expect([set, Array.from(glyphs.rockMid).length]).toEqual([set, 2])
      expect([set, Array.from(glyphs.rockBig).length]).toEqual([set, 3])
    }
  })

  test('the frame draws each thing where it is', () => {
    const g = newMeteors(25, 14, never)
    g.rocks = [{ x: 1, y: 0, size: 1 }, { x: 3, y: 1, size: 2 }, { x: 7, y: 2, size: 3 }]
    g.bonuses = [{ x: 12, y: 3 }]
    const glyphs = GLYPHS.ascii
    const text = lines(frame(g, glyphs))
    expect(text[0]?.slice(1, 2)).toBe(glyphs.rockSmall)
    expect(text[1]?.slice(3, 5)).toBe(glyphs.rockMid)
    expect(text[2]?.slice(7, 10)).toBe(glyphs.rockBig)
    expect(text[3]?.[12]).toBe(glyphs.bonus)
    expect(text[13]?.[g.shipX]).toBe(glyphs.ship)
  })
})
