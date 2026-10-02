// arcade: a game pane that runs while Claude works and freezes the moment
// Claude is done, asks a question or waits for a permission.

import { atom, derive, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { prefersAscii, resolveLocale, t } from './i18n'
import type { GlyphSet } from './glyphs'
import type { Display, PauseState, Waiting } from '../types'

const PANE = 'arcade'
const BEST_KEY = 'best'
const SOUND = 'sounds/pause.wav'

const IDLE: Waiting = { turn: 'idle', asking: [], asked: [], permission: [] }

/** Why the games stand still, if they do: a dialog first, then the turn. */
export function pauseOf(w: Waiting): PauseState {
  const reason = w.permission.length > 0 ? 'permission' : w.asking.length > 0 ? 'asking' : w.turn
  return { isPaused: reason !== '', reason }
}

const waiting = atom({ plugin: 'arcade', key: 'waiting' } as const, IDLE)
const pause = derive([waiting], pauseOf)
const display = atom({ plugin: 'arcade', key: 'display' } as const, { locale: 'en', glyphs: 'unicode' } as Display)
const best = atom({ plugin: 'arcade', key: 'best' } as const, {} as Record<string, number>)

function option(options: PluginOptions, name: string): string | undefined {
  const v = options[name]
  return typeof v === 'string' ? v : undefined
}

/** Reads a source the display falls back past when it is missing or fails. */
async function quietly<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read()
  } catch {
    return undefined
  }
}

/** Language and glyphs: the plugin's settings first, then Claude Code's, then the system's. */
export async function resolveDisplay($: EngineInterface, options: PluginOptions): Promise<Display> {
  const settings = await quietly(() => $.settings.read())
  const claudeLanguage = typeof settings?.language === 'string' ? settings.language : undefined
  const locale = resolveLocale([
    option(options, 'language'),
    claudeLanguage,
    await quietly(() => $.env.get('LC_ALL')),
    await quietly(() => $.env.get('LC_MESSAGES')),
    await quietly(() => $.env.get('LANG')),
  ])
  const chosen = option(options, 'glyphs')
  const glyphs: GlyphSet = chosen === 'unicode' || chosen === 'ascii' ? chosen : prefersAscii(locale) ? 'ascii' : 'unicode'
  return { locale, glyphs }
}

/** Without the first `entry` in the list; the list itself when it is not there. */
export function without(list: string[], entry: string | undefined): string[] {
  const i = entry === undefined ? -1 : list.indexOf(entry)
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}

// A permission dialog names its tool and its loop, not its call. The engine's
// check of the call comes just before it and does carry the call's id, so the
// two are paired: `asked` remembers the calls put to a decider as
// `<tool>#<call id>`, and a dialog takes the oldest one of its tool. Its entry
// in `permission` is `<agent id>:<tool>#<call id>`; the main loop has no agent
// id, so its entries start with ":".
//
// The pairing can miss: the check names no loop, and a call put to a decider
// that is not the dialog (auto mode) stays in `asked` while it runs. So the
// end of a call is read generously, and the end of a loop's turn clears what
// is left of that loop.

/** The engine put a call to its decider: a dialog may follow. */
export function asked(w: Waiting, tool: string, call: string): Waiting {
  return { ...w, asked: [...w.asked, `${tool}#${call}`] }
}

/** A permission dialog opens for `tool` in the loop `agent`; its entry is the last in `permission`. */
export function dialog(w: Waiting, agent: string, tool: string): Waiting {
  const known = w.asked.find(a => a.startsWith(`${tool}#`))
  // No call known: the entry ends with "#", and any call of the tool in this loop ends it.
  const call = known ? known.slice(tool.length + 1) : ''
  return { ...w, asked: without(w.asked, known), permission: [...w.permission, `${agent}:${tool}#${call}`] }
}

/**
 * A tool call ended: its dialog, if it had one, is answered. The dialog is
 * the one paired with this call, whichever loop it was put down for. Failing
 * that, a call that was itself put to a decider, or a dialog whose call
 * nobody announced, ends the oldest dialog of its tool in its loop. A call
 * that needed no permission ends nothing: the same `w` comes back.
 */
export function ended(w: Waiting, agent: string, tool: string, call: string): Waiting {
  const mine = `${tool}#${call}`
  const ofTool = `${agent}:${tool}#`
  const paired = call ? w.permission.find(p => p.endsWith(`:${mine}`)) : undefined
  const wasAsked = w.asked.includes(mine)
  const other = w.permission.find(p => (wasAsked ? p.startsWith(ofTool) : p === ofTool))
  const permission = without(w.permission, paired ?? other)
  const left = without(w.asked, mine)
  return permission === w.permission && left === w.asked ? w : { ...w, asked: left, permission }
}

/** A loop's turn ends: whatever dialog of its own is still down has gone with it. */
export function loopEnds(w: Waiting, agent: string): Waiting {
  const others = (list: string[]) => list.filter(entry => !entry.startsWith(`${agent}:`))
  return { ...w, asking: others(w.asking), permission: others(w.permission) }
}

/** The main loop's turn starts or ends. A subagent's dialog may still be open. */
export function mainTurn(w: Waiting, turn: Waiting['turn']): Waiting {
  return { ...loopEnds(w, ''), turn, asked: turn === '' ? [] : w.asked }
}

/** The high scores in whatever the store holds. */
export function scores(stored: unknown): Record<string, number> {
  const record: Record<string, number> = {}
  if (stored && typeof stored === 'object') {
    for (const [id, n] of Object.entries(stored)) if (typeof n === 'number') record[id] = n
  }
  return record
}

/** Two score tables as one, the higher score per game. */
export function highest(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a }
  for (const [id, n] of Object.entries(b)) out[id] = Math.max(out[id] ?? 0, n)
  return out
}

/** Changes what the games wait for. Resolves the state before and after. */
async function settle($: EngineInterface, change: (w: Waiting) => Waiting): Promise<{ before: Waiting; after: Waiting }> {
  let before = IDLE
  const after = await update($, waiting, w => {
    before = w
    return change(w)
  })
  return { before, after }
}

/** Chimes, if the person asked for it and the arcade is open. */
async function chime($: EngineInterface, isSoundOn: boolean): Promise<void> {
  if (!isSoundOn) return
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  // Not awaited: the clip plays for half a second, and the dialog must not wait for it.
  if (isOpen) void $.audio.play({ asset: SOUND }).catch(() => undefined)
}

/** Changes what the games wait for, and chimes when that froze a running game. */
async function freeze($: EngineInterface, change: (w: Waiting) => Waiting, isSoundOn: boolean): Promise<void> {
  const { before, after } = await settle($, change)
  if (pauseOf(after).isPaused && !pauseOf(before).isPaused) await chime($, isSoundOn)
}

export const register: Register = (on, options) => {
  const isSoundOn = options.sound === true

  on('session.start', async ($, e, next) => {
    const shown = await resolveDisplay($, options)
    await update($, display, () => shown)
    await $.command.register({ name: 'arcade', description: t(shown.locale, 'cmd.description') })

    const stored = scores(await $.store.get(BEST_KEY))
    await update($, best, now => highest(now, stored))

    return next(e)
  })

  on('command.run', { command: 'arcade' }, async $ => {
    const { locale } = await read($, display)
    const opened = await $.ui.open({ id: PANE, title: t(locale, 'title'), focus: true, rows: 24, columns: 76 })
    if (!opened.isPlaced) return { text: t(locale, 'cmd.waiting', { reason: opened.reason }) }

    return { text: t(locale, 'cmd.opened') }
  })

  // Claude starts working: play on.
  on('turn.start', async ($, e, next) => {
    await settle($, w => mainTurn(w, ''))

    return next(e)
  })

  // Claude is done with the main turn: freeze. A subagent's turn carries an
  // agentId and ends while the main turn still runs: it freezes nothing, but
  // a dialog of its own that is still down cannot be open any more.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    const agent = e.agentId
    if (agent === undefined) await freeze($, w => mainTurn(w, 'done'), isSoundOn)
    else await settle($, w => loopEnds(w, agent))

    return done
  })

  // A question for the person: freeze while the dialog is open.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const id = `${e.agentId ?? ''}:${e.tool_use_id ?? ''}`
    await freeze($, w => ({ ...w, asking: [...w.asking, id] }), isSoundOn)
    try {
      return await next(e)
    } finally {
      await settle($, w => ({ ...w, asking: without(w.asking, id) }))
    }
  })

  // The engine puts a call to its decider. That is the dialog in most modes,
  // but not in all, so nothing freezes yet: the call is only remembered.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const call = e.tool_use_id
    if (verdict.decision === 'ask' && call) await settle($, w => asked(w, e.tool, call))

    return verdict
  })

  // A permission dialog: freeze until the tool it is for has run. Frozen
  // before the hooks beneath are asked, so the game never runs on under a
  // dialog. When one of them answers instead of the person, no dialog opens:
  // the game runs again, and only a dialog that does open chimes.
  on('classic.PermissionRequest', async ($, e, next) => {
    const agent = e.agent_id ?? ''
    const { before, after } = await settle($, w => dialog(w, agent, e.tool_name))
    const entry = after.permission[after.permission.length - 1]
    const answer = await next(e)
    if (answer.decision) await settle($, w => ({ ...w, permission: without(w.permission, entry) }))
    else if (!pauseOf(before).isPaused) await chime($, isSoundOn)

    return answer
  })

  // The permission check runs inside the call: once the tool has run (or was
  // refused), the person has answered. Only the call the dialog was for ends
  // the wait: another tool finishing in between, a subagent's say, does not.
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      const [agent, call] = [e.agentId ?? '', e.tool_use_id ?? '']
      const now = await read($, waiting)
      if (ended(now, agent, e.tool, call) !== now) await settle($, w => ended(w, agent, e.tool, call))
    }
  })

  on('ui.message', { requestId: PANE }, async ($, e, next) => {
    const data = e.data as { type?: unknown; game?: unknown; score?: unknown } | null
    if (data && data.type === 'score' && typeof data.game === 'string' && typeof data.score === 'number') {
      const scored = { [data.game]: data.score }
      // Another session may have stored records since this one read them.
      const stored = scores(await $.store.get(BEST_KEY))
      await $.store.set(BEST_KEY, await update($, best, now => highest(highest(now, stored), scored)))
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shown = await read($, display)
    if (e.surface !== 'terminal' && e.surface !== 'desktop') {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{t(shown.locale, 'unsupported')}</Text>
    }
    const { Client } = $.ui.resolve(e)

    const state = await read($, pause)
    const record = await read($, best)

    // Docked, the region is as tall as the pane's body: a click anywhere in
    // the pane then lands in it and gives the game the keys. A percentage is
    // not enough there, the region would end below the last row drawn. Inline
    // the pane is as tall as what is drawn, so its body rows must not size it.
    const height = e.props.placement === 'dock' ? e.props.scroll.bodyRows : '100%'

    return (
      <Client
        key="arcade"
        module="./arcade.tsx"
        props={{ ...state, ...shown, best: record }}
        width="100%"
        height={height}
      />
    )
  })
}
