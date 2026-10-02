export type PauseState = {
  /** True while Claude is not working: done, asking, or waiting for a permission. */
  isPaused: boolean
  /** Why the game is frozen, shown over the field. */
  reason: string
}

/** The props the hooks module hands the Breakout surface module. */
export type BreakoutProps = PauseState & { best: number }

declare module 'claude-code' {
  interface PluginState {
    'arcade': {
      pause: PauseState
      best: number
    }
  }
}
