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
      pause: PauseState
      display: Display
      best: Record<string, number>
    }
  }
}
