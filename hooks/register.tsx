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
export function without(list: string[], entry: string): string[] {
  const i = list.indexOf(entry)
  return i < 0 ? list : [...list.slice(0, i), ...list.slice(i + 1)]
}

// A permission dialog names its tool and its loop, not its call. The engine's
// check of the call comes just before it and does carry the call's id, so the
// two are paired: `asked` remembers the calls put to a decider as
// `<tool>#<call id>`, and a dialog takes the oldest one of its tool. Its entry
// in `permission` is `<agent id>:<tool>#<call id>`; the main loop has no agent
// id, so its entries start with ":".

/** The engine put a call to its decider: a dialog may follow. */
export function asked(w: Waiting, tool: string, call: string): Waiting {
  return { ...w, asked: [...w.asked, `${tool}#${call}`] }
}

/** A permission dialog opens for `tool` in the loop `agent`. */
export function dialog(w: Waiting, agent: string, tool: string): Waiting {
  const known = w.asked.find(a => a.startsWith(`${tool}#`))
  // No call known: the entry ends with "#", and any call of the tool in this loop ends it.
  const call = known ? known.slice(tool.length + 1) : ''
  return { ...w, asked: known ? without(w.asked, known) : w.asked, permission: [...w.permission, `${agent}:${tool}#${call}`] }
}

/** A hook answered in the person's place: the newest dialog for the tool never opened. */
export function decided(w: Waiting, agent: string, tool: string): Waiting {
  const i = w.permission.findLastIndex(p => p.startsWith(`${agent}:${tool}#`))
  return i < 0 ? w : { ...w, permission: [...w.permission.slice(0, i), ...w.permission.slice(i + 1)] }
}

/** A tool call ended: its dialog, if it had one, is answered. The same `w` when it had none. */
export function ended(w: Waiting, agent: string, tool: string, call: string): Waiting {
  const own = `${agent}:${tool}#${call}`
  const unknown = `${agent}:${tool}#`
  const permission = without(w.permission, w.permission.includes(own) ? own : unknown)
  const left = without(w.asked, `${tool}#${call}`)
  return permission === w.permission && left === w.asked ? w : { ...w, asked: left, permission }
}

/** The main loop's turn starts or ends: its own dialogs are gone with it, a subagent's may still be open. */
export function mainTurn(w: Waiting, turn: Waiting['turn']): Waiting {
  const others = (list: string[]) => list.filter(entry => !entry.startsWith(':'))
  return { turn, asking: others(w.asking), asked: turn === '' ? [] : w.asked, permission: others(w.permission) }
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

/**
 * Changes what the games wait for. Chimes when that froze a running game, if
 * the person asked for it and the arcade is open.
 */
async function settle($: EngineInterface, change: (w: Waiting) => Waiting, isSoundOn: boolean): Promise<void> {
  let before = IDLE
  const after = await update($, waiting, w => {
    before = w
    return change(w)
  })
  if (!isSoundOn || !pauseOf(after).isPaused || pauseOf(before).isPaused) return
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  // Not awaited: the clip plays for half a second, and the dialog must not wait for it.
  if (isOpen) void $.audio.play({ asset: SOUND }).catch(() => undefined)
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
    await settle($, w => mainTurn(w, ''), isSoundOn)

    return next(e)
  })

  // Claude is done with the main turn: freeze. A subagent's turn carries an
  // agentId and ends while the main turn still runs, so it is left alone.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) await settle($, w => mainTurn(w, 'done'), isSoundOn)

    return done
  })

  // A question for the person: freeze while the dialog is open.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    const id = `${e.agentId ?? ''}:${e.tool_use_id ?? ''}`
    await settle($, w => ({ ...w, asking: [...w.asking, id] }), isSoundOn)
    try {
      return await next(e)
    } finally {
      await settle($, w => ({ ...w, asking: without(w.asking, id) }), isSoundOn)
    }
  })

  // The engine puts a call to its decider. That is the dialog in most modes,
  // but not in all, so nothing freezes yet: the call is only remembered.
  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const call = e.tool_use_id
    if (verdict.decision === 'ask' && call) await update($, waiting, w => asked(w, e.tool, call))

    return verdict
  })

  // A permission dialog: freeze until the tool it is for has run. Frozen
  // before the hooks beneath are asked, so the game never runs on under a
  // dialog; when one of them answers instead of the person, it runs again.
  on('classic.PermissionRequest', async ($, e, next) => {
    const agent = e.agent_id ?? ''
    await settle($, w => dialog(w, agent, e.tool_name), isSoundOn)
    const answer = await next(e)
    if (answer.decision) await settle($, w => decided(w, agent, e.tool_name), isSoundOn)

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
      if (ended(now, agent, e.tool, call) !== now) await settle($, w => ended(w, agent, e.tool, call), isSoundOn)
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
