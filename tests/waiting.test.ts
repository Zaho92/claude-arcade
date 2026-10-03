// What holds the games still, as pure bookkeeping: each cause on its own, so
// that one ending never releases another.

import { describe, expect, test } from 'claude-code/testing'

import { argsOf, dialog, digest, ended, highest, loopEnds, mainTurn, pauseOf, scores, started, without } from '../hooks/register'
import type { Waiting } from '../types'

const RUNNING: Waiting = { turn: '', asking: [], running: [], permission: [] }

const LS = digest({ command: 'ls' })
const RM = digest({ command: 'rm a' })

describe('why the games stand still', () => {
  test('a dialog comes before the turn, a permission before a question', () => {
    expect(pauseOf(RUNNING)).toEqual({ isPaused: false, reason: '' })
    expect(pauseOf({ ...RUNNING, turn: 'idle' })).toEqual({ isPaused: true, reason: 'idle' })
    expect(pauseOf({ ...RUNNING, turn: 'done' })).toEqual({ isPaused: true, reason: 'done' })
    expect(pauseOf({ ...RUNNING, asking: [':1'] })).toEqual({ isPaused: true, reason: 'asking' })
    expect(pauseOf({ ...RUNNING, turn: 'done', asking: [':1'], permission: [':Bash#1'] })).toEqual({ isPaused: true, reason: 'permission' })
  })

  test('a call under way holds nothing still by itself', () => {
    expect(pauseOf(started(RUNNING, '', 'Bash', 'c1', LS))).toEqual({ isPaused: false, reason: '' })
  })
})

describe('the arguments of a tool call', () => {
  test('are what the call carries beside its own names', () => {
    expect(argsOf({ tool: 'Bash', tool_use_id: 'c1', agentId: 'a1', consent: 'x', command: 'ls' })).toEqual({ command: 'ls' })
  })

  test('have one digest however their keys are ordered, and another when they differ', () => {
    expect(digest({ a: 1, b: { c: [1, 2], d: 'x' } })).toBe(digest({ b: { d: 'x', c: [1, 2] }, a: 1 }))
    expect(digest({ command: 'ls' })).not.toBe(digest({ command: 'rm a' }))
    expect(digest({ list: [1, 2] })).not.toBe(digest({ list: [2, 1] }))
    expect(digest(undefined)).toBe(digest(undefined))
  })
})

describe('permission dialogs', () => {
  test('a dialog belongs to the call under way with its arguments, and only that call ends it', () => {
    let w = started(started(RUNNING, '', 'Bash', 'c1', LS), '', 'Bash', 'c2', RM)
    w = dialog(w, '', 'Bash', RM)
    expect(w.permission).toEqual([':Bash#c2'])

    // The other call of the same tool, in the same loop, needed no dialog.
    w = ended(w, '', 'Bash', 'c1')
    expect(w).toMatchObject({ running: [`:Bash#c2@${RM}`], permission: [':Bash#c2'] })
    // Nor does another tool end it, or the same tool in a subagent.
    expect(ended(w, '', 'Read', 'c3')).toBe(w)
    expect(ended(w, 'a1', 'Bash', 'c4')).toBe(w)

    expect(ended(w, '', 'Bash', 'c2')).toEqual(RUNNING)
  })

  test('a dialog takes only calls of its own loop', () => {
    let w = started(started(RUNNING, '', 'Bash', 'c1', LS), 'a1', 'Bash', 'c2', LS)
    w = dialog(w, 'a1', 'Bash', LS)
    expect(w.permission).toEqual(['a1:Bash#c2'])
    expect(pauseOf(ended(w, '', 'Bash', 'c1')).reason).toBe('permission')
    expect(pauseOf(ended(w, 'a1', 'Bash', 'c2')).isPaused).toBe(false)
  })

  test('a dialog whose arguments no call under way has waits for every call it could be for', () => {
    let w = started(started(RUNNING, '', 'Bash', 'c1', LS), '', 'Bash', 'c2', RM)
    // Something beneath rewrote the arguments before the dialog.
    w = dialog(w, '', 'Bash', digest({ command: 'rm b' }))
    expect(w.permission).toEqual([':Bash#c1,c2'])
    w = ended(w, '', 'Bash', 'c1')
    expect(w.permission).toEqual([':Bash#c2'])
    expect(pauseOf(w).reason).toBe('permission')
    expect(pauseOf(ended(w, '', 'Bash', 'c2')).isPaused).toBe(false)
  })

  test('two calls with the same arguments each get their dialog, and the last to end releases the game', () => {
    let w = started(started(RUNNING, '', 'Bash', 'c1', LS), '', 'Bash', 'c2', LS)
    w = dialog(dialog(w, '', 'Bash', LS), '', 'Bash', LS)
    expect(w.permission).toEqual([':Bash#c1,c2', ':Bash#c1,c2'])
    w = ended(w, '', 'Bash', 'c2')
    expect(w.permission).toEqual([':Bash#c1', ':Bash#c1'])
    expect(ended(w, '', 'Bash', 'c1')).toEqual(RUNNING)
  })

  test('a dialog with no call under way ends with the next call of its tool in its loop', () => {
    const w = dialog(RUNNING, 'a1', 'Bash', LS)
    expect(w.permission).toEqual(['a1:Bash#'])
    expect(ended(w, '', 'Bash', 'c1')).toBe(w)
    expect(ended(w, 'a1', 'Read', 'c2')).toBe(w)
    expect(ended(w, 'a1', 'Bash', 'c3').permission).toEqual([])
    expect(ended(w, 'a1', 'Bash', '').permission).toEqual([])
  })

  test('two such dialogs end one call at a time, the oldest first', () => {
    let w = dialog(dialog(RUNNING, '', 'Bash', LS), '', 'Bash', RM)
    w = ended(w, '', 'Bash', 'c1')
    expect(w.permission).toEqual([':Bash#'])
    expect(ended(w, '', 'Bash', 'c2').permission).toEqual([])
  })

  test('a call that got no dialog leaves nothing behind', () => {
    const w = started(RUNNING, '', 'Bash', 'c1', LS)
    expect(ended(w, '', 'Bash', 'c1')).toEqual(RUNNING)
    expect(ended(RUNNING, '', 'Bash', 'c1')).toBe(RUNNING)
  })
})

describe('the end of a turn', () => {
  const open: Waiting = {
    turn: '',
    asking: [':q1', 'a1:q2', 'a2:q3'],
    running: [`:Bash#c1@${LS}`, `a1:Bash#c2@${LS}`],
    permission: [':Bash#c1', 'a1:Bash#c2', 'a2:Read#'],
  }

  test('a subagent that ends takes its own dialogs and calls with it, and nobody else has to wait for them', () => {
    expect(loopEnds(open, 'a1')).toEqual({
      ...open,
      asking: [':q1', 'a2:q3'],
      running: [`:Bash#c1@${LS}`],
      permission: [':Bash#c1', 'a2:Read#'],
    })
    expect(loopEnds(open, 'a9')).toEqual(open)
  })

  test('the main turn takes its own with it, at its end and at its start, and leaves those of a subagent', () => {
    const left = { asking: ['a1:q2', 'a2:q3'], running: [`a1:Bash#c2@${LS}`], permission: ['a1:Bash#c2', 'a2:Read#'] }
    expect(mainTurn(open, 'done')).toEqual({ turn: 'done', ...left })
    expect(mainTurn({ ...open, turn: 'done' }, '')).toEqual({ turn: '', ...left })
  })
})

describe('lists and score tables', () => {
  test('one entry goes, the first of its kind; a list without it stays the same list', () => {
    const list = [':Bash#', 'a1:Bash#', ':Bash#']
    expect(without(list, ':Bash#')).toEqual(['a1:Bash#', ':Bash#'])
    expect(without(list, ':Read#')).toBe(list)
  })

  test('only numbers in the store count as scores', () => {
    expect(scores({ bricks: 300, worm: '70', mines: null })).toEqual({ bricks: 300 })
    expect(scores(undefined)).toEqual({})
    expect(scores('bricks')).toEqual({})
  })

  test('two tables merge to the higher score per game', () => {
    expect(highest({ bricks: 300, worm: 70 }, { bricks: 120, mines: 9 })).toEqual({ bricks: 300, worm: 70, mines: 9 })
  })
})
