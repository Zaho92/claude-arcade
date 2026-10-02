// What holds the games still, as pure bookkeeping: each cause on its own, so
// that one ending never releases another.

import { describe, expect, test } from 'claude-code/testing'

import { asked, dialog, ended, highest, loopEnds, mainTurn, pauseOf, scores, without } from '../hooks/register'
import type { Waiting } from '../types'

const RUNNING: Waiting = { turn: '', asking: [], asked: [], permission: [] }

describe('why the games stand still', () => {
  test('a dialog comes before the turn, a permission before a question', () => {
    expect(pauseOf(RUNNING)).toEqual({ isPaused: false, reason: '' })
    expect(pauseOf({ ...RUNNING, turn: 'idle' })).toEqual({ isPaused: true, reason: 'idle' })
    expect(pauseOf({ ...RUNNING, turn: 'done' })).toEqual({ isPaused: true, reason: 'done' })
    expect(pauseOf({ ...RUNNING, asking: [':1'] })).toEqual({ isPaused: true, reason: 'asking' })
    expect(pauseOf({ ...RUNNING, turn: 'done', asking: [':1'], permission: [':Bash#1'] })).toEqual({ isPaused: true, reason: 'permission' })
  })

  test('a call put to the decider holds nothing still by itself', () => {
    expect(pauseOf(asked(RUNNING, 'Bash', 'c1'))).toEqual({ isPaused: false, reason: '' })
  })
})

describe('permission dialogs', () => {
  test('a dialog belongs to the call the engine asked about, and only that call ends it', () => {
    let w = asked(RUNNING, 'WebFetch', 'c1')
    w = dialog(w, '', 'WebFetch')
    expect(w).toMatchObject({ asked: [], permission: [':WebFetch#c1'] })

    // A second call of the same tool, in the same loop, needed no dialog.
    expect(ended(w, '', 'WebFetch', 'c2')).toBe(w)
    // Nor does another tool, or the same tool in a subagent.
    expect(ended(w, '', 'Read', 'c3')).toBe(w)
    expect(ended(w, 'a1', 'WebFetch', 'c4')).toBe(w)

    expect(pauseOf(ended(w, '', 'WebFetch', 'c1')).isPaused).toBe(false)
  })

  test('two dialogs for one tool take the calls in the order they were asked', () => {
    let w = asked(asked(RUNNING, 'Bash', 'c1'), 'Bash', 'c2')
    w = dialog(dialog(w, '', 'Bash'), '', 'Bash')
    expect(w.permission).toEqual([':Bash#c1', ':Bash#c2'])
    w = ended(w, '', 'Bash', 'c2')
    expect(w.permission).toEqual([':Bash#c1'])
    expect(pauseOf(w).reason).toBe('permission')
    expect(pauseOf(ended(w, '', 'Bash', 'c1')).isPaused).toBe(false)
  })

  test('a dialog for a call nobody announced ends with the next call of its tool in its loop', () => {
    const w = dialog(RUNNING, 'a1', 'Bash')
    expect(w.permission).toEqual(['a1:Bash#'])
    expect(ended(w, '', 'Bash', 'c1')).toBe(w)
    expect(ended(w, 'a1', 'Read', 'c2')).toBe(w)
    expect(ended(w, 'a1', 'Bash', 'c3').permission).toEqual([])
  })

  test('a call that was asked about but got no dialog leaves nothing behind', () => {
    const w = asked(RUNNING, 'Bash', 'c1')
    expect(ended(w, '', 'Bash', 'c1')).toEqual(RUNNING)
  })

  test('a dialog put down for the wrong loop still ends with its call', () => {
    // The check names no loop: main (c1) and a subagent (c2) are both asked
    // about Bash, and the dialogs come in the other order.
    let w = asked(asked(RUNNING, 'Bash', 'c1'), 'Bash', 'c2')
    w = dialog(dialog(w, 'a1', 'Bash'), '', 'Bash')
    expect(w.permission).toEqual(['a1:Bash#c1', ':Bash#c2'])
    w = ended(w, '', 'Bash', 'c1')
    expect(w.permission).toEqual([':Bash#c2'])
    expect(ended(w, 'a1', 'Bash', 'c2').permission).toEqual([])
  })

  test('a dialog paired with a call that needed none ends with the call it was really for', () => {
    // c1 was put to a decider that is not the dialog, and runs on. The
    // dialog for c2 takes c1 for its call.
    let w = asked(asked(RUNNING, 'Bash', 'c1'), 'Bash', 'c2')
    w = dialog(w, '', 'Bash')
    expect(w).toMatchObject({ asked: ['Bash#c2'], permission: [':Bash#c1'] })
    expect(ended(w, '', 'Bash', 'c2')).toEqual(RUNNING)
  })
})

describe('the end of a turn', () => {
  const open: Waiting = {
    turn: '',
    asking: [':q1', 'a1:q2', 'a2:q3'],
    asked: [],
    permission: [':Bash#c1', 'a1:Bash#c2', 'a2:Read#'],
  }

  test('a subagent that ends takes its own dialogs with it, and nobody else has to wait for them', () => {
    expect(loopEnds(open, 'a1')).toEqual({ ...open, asking: [':q1', 'a2:q3'], permission: [':Bash#c1', 'a2:Read#'] })
    expect(loopEnds(open, 'a9')).toEqual(open)
  })
})

describe('the main turn', () => {
  const open: Waiting = {
    turn: '',
    asking: [':q1', 'a1:q2'],
    asked: ['Bash#c9'],
    permission: [':Bash#c1', 'a1:Bash#c2'],
  }

  test('its end takes its own dialogs with it and leaves those of a subagent open', () => {
    expect(mainTurn(open, 'done')).toEqual({ turn: 'done', asking: ['a1:q2'], asked: ['Bash#c9'], permission: ['a1:Bash#c2'] })
  })

  test('its start does the same, and forgets the calls asked about before', () => {
    expect(mainTurn({ ...open, turn: 'done' }, '')).toEqual({ turn: '', asking: ['a1:q2'], asked: [], permission: ['a1:Bash#c2'] })
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
