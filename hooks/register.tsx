// arcade: a game pane that runs while Claude works and freezes the
// moment Claude is done, asks a question or waits for a permission.

import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { PauseState } from '../types'

const PANE = 'arcade'
const BEST_KEY = 'breakout.best'

export const IDLE: PauseState = { isPaused: true, reason: '⏸  Läuft, sobald Claude arbeitet' }
export const DONE: PauseState = { isPaused: true, reason: '⏸  Claude ist fertig, du bist dran' }
export const ASKING: PauseState = { isPaused: true, reason: '⏸  Claude hat eine Frage an dich' }
export const PERMISSION: PauseState = { isPaused: true, reason: '⏸  Claude wartet auf deine Freigabe' }
export const RUNNING: PauseState = { isPaused: false, reason: '' }

const pause = atom({ plugin: 'arcade', key: 'pause' } as const, IDLE)
const best = atom({ plugin: 'arcade', key: 'best' } as const, 0)

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'arcade',
      description: 'Breakout spielen, solange Claude arbeitet (pausiert automatisch)',
    })
    const stored = await $.store.get(BEST_KEY)
    if (typeof stored === 'number') await update($, best, n => Math.max(n, stored))

    return next(e)
  })

  on('command.run', { command: 'arcade' }, async $ => {
    const opened = await $.ui.open({ id: PANE, title: 'Arcade · Breakout', focus: true, rows: 24, columns: 76 })
    if (!opened.isPlaced) return { text: 'Arcade: das Terminal ist zu schmal für das Spielfeld.' }

    return { text: 'Arcade geöffnet. Klick ins Feld zum Spielen, Esc zurück zur Eingabe.' }
  })

  // Claude starts working: play on.
  on('turn.start', async ($, e, next) => {
    await update($, pause, () => RUNNING)

    return next(e)
  })

  // Claude is done with the main turn: freeze. A subagent's turn carries an
  // agentId and ends while the main turn still runs, so it is left alone.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await update($, pause, () => DONE)

    return done
  })

  // A question for the person: freeze while the dialog is open.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await update($, pause, () => ASKING)
    try {
      return await next(e)
    } finally {
      await update($, pause, p => (p.reason === ASKING.reason ? RUNNING : p))
    }
  })

  // A permission dialog: freeze until a tool runs again.
  on('classic.PermissionRequest', async ($, e, next) => {
    await update($, pause, () => PERMISSION)

    return next(e)
  })

  // The permission check runs inside the call: once the tool has run (or was
  // refused), the person has answered and Claude carries on.
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      await update($, pause, p => (p.reason === PERMISSION.reason ? RUNNING : p))
    }
  })

  on('ui.message', { requestId: PANE }, async ($, e, next) => {
    const data = e.data as { type?: unknown; score?: unknown } | null
    if (data && data.type === 'over' && typeof data.score === 'number') {
      const score = data.score
      await update($, best, n => Math.max(n, score))
      await $.store.set(BEST_KEY, await read($, best))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>Arcade braucht das Terminal oder die Desktop-App.</Text>
    }
    const { Client } = $.ui.resolve(e)

    const state = await read($, pause)
    const record = await read($, best)

    return (
      <Client
        key="breakout"
        module="./breakout.tsx"
        props={{ ...state, best: record }}
        width="100%"
        height="100%"
      />
    )
  })
}
