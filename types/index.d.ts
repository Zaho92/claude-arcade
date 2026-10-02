/** The languages the arcade speaks (hooks/i18n.ts holds the texts). */
export type Locale = 'en' | 'de' | 'fr' | 'es' | 'pt' | 'it' | 'ja' | 'zh' | 'ko' | 'ru'

/** unicode draws with block symbols; ascii keeps every cell one column wide. */
export type GlyphSet = 'unicode' | 'ascii'

/** Why the games are frozen; '' while Claude works. */
export type PauseReason = '' | 'idle' | 'done' | 'asking' | 'permission'

export type PauseState = {
  /** True while Claude is not working: done, asking, or waiting for a permission. */
  isPaused: boolean
  reason: PauseReason
}

/**
 * What holds the games still, each kept apart so that one ending does not
 * release another. `PauseState` is worked out from it, not stored.
 */
export type Waiting = {
  /** The main turn: '' while Claude works. */
  turn: '' | 'idle' | 'done'
  /** The open questions, one entry per call, as `<agent id>:<call id>`. */
  asking: string[]
  /** Calls the engine put to its decider, as `<tool>#<call id>`: a dialog may follow. */
  asked: string[]
  /**
   * The open permission dialogs, one entry each, as
   * `<agent id>:<tool>#<call id>`; the call id is empty when it is not known.
   */
  permission: string[]
}

/** How the arcade speaks and draws, resolved once per session. */
export type Display = {
  locale: Locale
  glyphs: GlyphSet
}

/** The props the hooks module hands the arcade's surface module. */
export type ArcadeProps = PauseState & Display & {
  /** High score per game id. */
  best: Record<string, number>
}

declare module 'claude-code' {
  interface PluginState {
    arcade: {
      waiting: Waiting
      display: Display
      best: Record<string, number>
    }
  }
}
