// arcade: a game pane that runs while Claude works and freezes the moment
// Claude is done, asks a question or waits for a permission.

import { atom, read, update } from 'claude-code'
import type { EngineInterface, PluginOptions, Register } from 'claude-code'

import { prefersAscii, resolveLocale, t } from './i18n'
import type { GlyphSet } from './glyphs'
import type { Display, PauseReason, PauseState } from '../types'

const PANE = 'arcade'
const BEST_KEY = 'best'
const SOUND = 'sounds/pause.wav'

const RUNNING: PauseState = { isPaused: false, reason: '' }
const paused = (reason: Exclude<PauseReason, ''>): PauseState => ({ isPaused: true, reason })

const pause = atom({ plugin: 'arcade', key: 'pause' } as const, paused('idle'))
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

/** Freezes the games; chimes once if the person asked for it and the arcade is open. */
async function freeze($: EngineInterface, reason: Exclude<PauseReason, ''>, isSoundOn: boolean): Promise<void> {
  const before = await read($, pause)
  await update($, pause, () => paused(reason))
  if (!isSoundOn || before.isPaused) return
  const isOpen = (await $.ui.panes()).some(p => p.id === PANE)
  if (isOpen) await $.audio.play({ asset: SOUND }).catch(() => undefined)
}

export const register: Register = (on, options) => {
  const isSoundOn = options.sound === true

  on('session.start', async ($, e, next) => {
    const shown = await resolveDisplay($, options)
    await update($, display, () => shown)
    await $.command.register({ name: 'arcade', description: t(shown.locale, 'cmd.description') })

    const stored = await $.store.get(BEST_KEY)
    const record: Record<string, number> = {}
    if (stored && typeof stored === 'object') {
      for (const [id, n] of Object.entries(stored)) if (typeof n === 'number') record[id] = n
    }
    await update($, best, now => ({ ...record, ...now }))

    return next(e)
  })

  on('command.run', { command: 'arcade' }, async $ => {
    const { locale } = await read($, display)
    const opened = await $.ui.open({ id: PANE, title: t(locale, 'title'), focus: true, rows: 24, columns: 76 })
    if (!opened.isPlaced) return { text: t(locale, 'cmd.tooNarrow') }

    return { text: t(locale, 'cmd.opened') }
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
    if (e.agentId === undefined) await freeze($, 'done', isSoundOn)

    return done
  })

  // A question for the person: freeze while the dialog is open.
  on('tool.call', { tool: 'AskUserQuestion' }, async ($, e, next) => {
    await freeze($, 'asking', isSoundOn)
    try {
      return await next(e)
    } finally {
      await update($, pause, p => (p.reason === 'asking' ? RUNNING : p))
    }
  })

  // A permission dialog: freeze until a tool runs again.
  on('classic.PermissionRequest', async ($, e, next) => {
    await freeze($, 'permission', isSoundOn)

    return next(e)
  })

  // The permission check runs inside the call: once the tool has run (or was
  // refused), the person has answered and Claude carries on.
  on('tool.call', async ($, e, next) => {
    try {
      return await next(e)
    } finally {
      await update($, pause, p => (p.reason === 'permission' ? RUNNING : p))
    }
  })

  on('ui.message', { requestId: PANE }, async ($, e, next) => {
    const data = e.data as { type?: unknown; game?: unknown; score?: unknown } | null
    if (data && data.type === 'over' && typeof data.game === 'string' && typeof data.score === 'number') {
      const game = data.game
      const score = data.score
      await update($, best, now => ({ ...now, [game]: Math.max(now[game] ?? 0, score) }))
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

    return (
      <Client
        key="arcade"
        module="./arcade.tsx"
        props={{ ...state, ...shown, best: record }}
        width="100%"
        height="100%"
      />
    )
  })
}
