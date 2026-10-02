// arcade: a game pane that runs while Claude works and freezes the moment
// Claude is done, asks a question or waits for a permission.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { prefersAscii, resolveLocale, t } from './i18n'
import type { GlyphSet } from './glyphs'
import type { Display, PauseState, Waiting } from '../types'

const PANE = 'arcade'
const BEST_KEY = 'best'
const SOUND = 'sounds/pause.wav'

const IDLE: Waiting = { turn: 'idle', asking: [], permission: [] }

/** Why the games stand still, if they do: a dialog first, then the turn. */
export function pauseOf(w: Waiting): PauseState {
  const reason = w.permission.length > 0 ? 'permission' : w.asking.length > 0 ? 'asking' : w.turn
  return { isPaused: reason !== '', reason }
}

const waiting = atom({ plugin: 'arcade', key: 'waiting' } as const, IDLE)
const pause = atom({ plugin: 'arcade', key: 'pause' } as const, pauseOf(IDLE))
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
export function without(list: readonly string[], entry: string): string[] {
  const i = list.indexOf(entry)
  return i < 0 ? [...list] : [...list.slice(0, i), ...list.slice(i + 1)]
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
 * Changes what the games wait for and tells the pane. Chimes when that froze
 * a running game, if the person asked for it and the arcade is open.
 */
async function settle($: EngineInterface, change: (w: Waiting) => Waiting, isSoundOn: boolean): Promise<void> {
  const before = await read($, pause)
  await update($, waiting, change)
  const now = pauseOf(await read($, waiting))
  if (now.reason !== before.reason) await update($, pause, () => now)
  if (!isSoundOn || !now.isPaused || before.isPaused) return
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

  // Claude starts working: play on. Dialogs of the turn before are gone with it.
  on('turn.start', async ($, e, next) => {
    await settle($, () => ({ turn: '', asking: [], permission: [] }), isSoundOn)

    return next(e)
  })

  // Claude is done with the main turn: freeze. A subagent's turn carries an
  // agentId and ends while the main turn still runs, so it is left alone.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (e.agentId === undefined) {
      // The main loop's own dialogs end with its turn; a subagent's may still be open.
      await settle($, w => ({ ...w, turn: 'done', permission: w.permission.filter(p => !p.startsWith(':')) }), isSoundOn)
    }

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

  // A permission dialog: freeze until the tool it is for has run.
  on('classic.PermissionRequest', async ($, e, next) => {
    const id = `${e.agent_id ?? ''}:${e.tool_name}`
    await settle($, w => ({ ...w, permission: [...w.permission, id] }), isSoundOn)

    return next(e)
  })

  // The permission check runs inside the call: once the tool has run (or was
  // refused), the person has answered. Only the call the dialog was for ends
  // the wait: another tool finishing in between, a subagent's say, does not.
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      const id = `${e.agentId ?? ''}:${e.tool}`
      if ((await read($, waiting)).permission.includes(id)) {
        await settle($, w => ({ ...w, permission: without(w.permission, id) }), isSoundOn)
      }
    }
  })

  on('ui.message', { requestId: PANE }, async ($, e, next) => {
    const data = e.data as { type?: unknown; game?: unknown; score?: unknown } | null
    if (data && data.type === 'score' && typeof data.game === 'string' && typeof data.score === 'number') {
      const scored = { [data.game]: data.score }
      // Another session may have stored records since this one read them.
      const stored = scores(await $.store.get(BEST_KEY))
      await update($, best, now => highest(highest(now, stored), scored))
      await $.store.set(BEST_KEY, await read($, best))
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
