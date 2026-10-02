import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

// What the engine answers beneath the plugin in a real session.
function engine(on: On): Map<string, unknown> {
  const store = new Map<string, unknown>()
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('store.get', (_$, e) => store.get(e.key) as never)
  on('store.set', (_$, e) => {
    store.set(e.key, e.value)
    return undefined as never
  })
  return store
}

const PANE = {
  plugin: 'arcade',
  component: 'Pane',
  requestId: 'arcade',
  props: {
    title: 'Arcade',
    isFocused: true,
    bodyColumns: 76,
    placement: 'inline',
    scroll: { offset: 0, bodyRows: 24 },
    view: {},
  },
} as const

async function banner(ui: { find: (q: { type?: string; text?: RegExp; in?: string }) => Promise<unknown> }, text: RegExp) {
  return ui.find({ type: 'Text', text, in: 'breakout' })
}

test('the game freezes when Claude is done and runs while Claude works', async ($, on) => {
  engine(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ surface, ...PANE })
    await ui.resize({ columns: 70, rows: 24, in: 'breakout' })
    await ui.advance(100)

    // Idle at first, done after the previous surface's round: frozen either way.
    expect(await banner(ui, /⏸/)).toBeDefined()

    await $.turn.start({ text: 'build it', turnId: 't1' })
    await ui.advance(100)
    expect(await banner(ui, /Leertaste: Ball los/)).toBeDefined()

    await ui.key({ key: ' ', in: 'breakout' })
    await ui.advance(500)
    expect(await banner(ui, /Leertaste: /)).toBeUndefined()

    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' })
    await ui.advance(100)
    expect(await banner(ui, /Claude ist fertig/)).toBeDefined()

    await $.turn.start({ text: 'more', turnId: 't2' })
    await ui.advance(100)
    expect(await banner(ui, /Claude ist fertig/)).toBeUndefined()

    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer' })
    await ui.unmount()
  }
})

test('a subagent finishing does not pause the game', async ($, on) => {
  engine(on)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'breakout' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ answer: 'sub', durationMs: 1, isAborted: false, turnId: 't9', reason: 'answer', agentId: 'a1' })
  await ui.advance(100)
  expect(await banner(ui, /Claude ist fertig/)).toBeUndefined()
  await ui.unmount()
})

test('a game over keeps the high score', async ($, on) => {
  const store = engine(on)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'breakout' })
  await ui.post({ type: 'over', score: 420 })
  await ui.advance(100)
  expect(store.get('breakout.best')).toBe(420)
  expect(await ui.find({ type: 'Text', text: /Rekord 420/, in: 'breakout' })).toBeDefined()
  await ui.unmount()
})

test('a question from Claude freezes the game until it is answered', async ($, on) => {
  engine(on)
  let seen: unknown
  let check = async (): Promise<void> => {}
  on('tool.call', async () => {
    await check()
    return { result: { text: 'Breakout' } } as never
  })
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'breakout' })
  check = async () => {
    await ui.advance(100)
    seen = await banner(ui, /eine Frage/)
  }
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [{ question: 'Welches Spiel?', header: 'Spiel', multiSelect: false, options: [{ label: 'Breakout', description: '' }, { label: 'Asteroids', description: '' }] }],
  } as never)
  expect(seen).toBeDefined()
  await ui.advance(100)
  expect(await banner(ui, /eine Frage/)).toBeUndefined()
  await ui.unmount()
})
