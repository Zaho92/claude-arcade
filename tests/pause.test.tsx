import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

type World = {
  store: Map<string, unknown>
  sounds: string[]
  commands: { name: string; description?: string }[]
}

// What the engine answers beneath the plugin in a real session.
function engine(on: On, settings: Record<string, unknown> = {}, env: Record<string, string> = {}): World {
  const world: World = { store: new Map(), sounds: [], commands: [] }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('settings.read', () => ({ value: settings }) as never)
  on('env.get', (_$, e) => ({ value: env[e.name] }) as never)
  on('command.register', (_$, e) => {
    world.commands.push(e as never)
    return { value: { command: e.name } } as never
  })
  on('ui.panes', () => ({ value: [{ id: 'arcade', title: 'Arcade', isShown: true, isFocused: true, isPlaced: true }] }) as never)
  on('audio.play', (_$, e) => {
    world.sounds.push((e as { clip: { asset: string } }).clip.asset)
    return { value: undefined } as never
  })
  on('store.get', (_$, e) => ({ value: world.store.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    world.store.set(e.key, e.value)
    return { value: undefined } as never
  })
  return world
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

const SESSION = { cwd: '/tmp', surface: 'terminal', isInteractive: true } as const

type Ui = { find: (q: { type?: string; text?: RegExp; in?: string }) => Promise<unknown> }

function shows(ui: Ui, text: RegExp) {
  return ui.find({ type: 'Text', text, in: 'arcade' })
}

const DONE = { answer: 'done', durationMs: 1, isAborted: false, reason: 'answer' } as const

test('the game freezes when Claude is done and runs while Claude works', async ($, on) => {
  engine(on, { language: 'german' })
  await $.session.start(SESSION)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ surface, ...PANE })
    await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
    await ui.advance(100)

    // The menu first; Enter starts the selected game.
    expect(await shows(ui, /Mauerbrecher/)).toBeDefined()
    await ui.key({ key: 'return', in: 'arcade' })
    await ui.advance(100)
    // Idle at first, done after the previous surface's round: frozen either way.
    expect(await shows(ui, /⏸/)).toBeDefined()

    await $.turn.start({ text: 'build it', turnId: `${surface}-1` })
    await ui.advance(100)
    expect(await shows(ui, /Leertaste: Start/)).toBeDefined()

    await ui.key({ key: ' ', in: 'arcade' })
    await ui.advance(500)
    expect(await shows(ui, /Leertaste: Start/)).toBeUndefined()

    await $.turn.complete({ ...DONE, turnId: `${surface}-1` })
    await ui.advance(100)
    expect(await shows(ui, /Claude ist fertig – du bist dran/)).toBeDefined()

    await $.turn.start({ text: 'more', turnId: `${surface}-2` })
    await ui.advance(100)
    expect(await shows(ui, /Claude ist fertig/)).toBeUndefined()

    // Q leaves the game for the menu.
    await ui.key({ key: 'q', in: 'arcade' })
    await ui.advance(100)
    expect(await shows(ui, /Räum die Mauer ab/)).toBeDefined()

    await $.turn.complete({ ...DONE, turnId: `${surface}-2` })
    await ui.unmount()
  }
})

test('docked, the game region fills the pane, so a click anywhere in it gives the game the keys', async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const scroll = { offset: 0, bodyRows: 40 }
  for (const surface of ['terminal', 'desktop'] as const) {
    const docked = await $.ui.mount({ surface, ...PANE, props: { ...PANE.props, placement: 'dock', scroll } })
    expect((await docked.find({ type: 'Client' }))?.props.height).toBe(40)
    await docked.unmount()

    // Inline the pane takes its height from what is drawn, never the reverse.
    const inline = await $.ui.mount({ surface, ...PANE, props: { ...PANE.props, placement: 'inline', scroll } })
    expect((await inline.find({ type: 'Client' }))?.props.height).toBe('100%')
    await inline.unmount()
  }
})

test('without any language setting the arcade speaks English', async ($, on) => {
  const world = engine(on)
  await $.session.start(SESSION)
  expect(world.commands[0]?.description).toMatch(/while Claude works/)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  expect(await shows(ui, /Clear the wall/)).toBeDefined()
  await ui.unmount()
})

test('the system locale is used when Claude Code has no language set', async ($, on) => {
  const world = engine(on, {}, { LANG: 'fr_FR.UTF-8' })
  await $.session.start(SESSION)
  expect(world.commands[0]?.description).toMatch(/pendant que Claude travaille/)
})

test("the plugin's own language setting wins", { options: { language: 'ja' } }, async ($, on) => {
  engine(on, { language: 'german' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  expect(await shows(ui, /ブロック崩し/)).toBeDefined()
  // Japanese picks the ascii glyphs: the menu pointer is a plain '>'.
  expect(await shows(ui, /^> /)).toBeDefined()
  await ui.unmount()
})

test('a subagent finishing does not pause the game', async ($, on) => {
  engine(on, { language: 'german' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't9', agentId: 'a1' })
  await ui.advance(100)
  expect(await shows(ui, /Claude ist fertig/)).toBeUndefined()
  await ui.unmount()
})

test('a game over keeps the high score per game', async ($, on) => {
  const world = engine(on)
  world.store.set('best', { bricks: 300 })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  expect(await shows(ui, /Best 300/)).toBeDefined()
  await ui.post({ type: 'over', game: 'bricks', score: 420 }, { in: 'arcade' })
  await ui.advance(100)
  expect(world.store.get('best')).toEqual({ bricks: 420 })
  expect(await shows(ui, /Best 420/)).toBeDefined()
  await ui.unmount()
})

test('a question from Claude freezes the game until it is answered', async ($, on) => {
  engine(on, { language: 'german' })
  let seen: unknown
  let check = async (): Promise<void> => {}
  on('tool.call', async () => {
    await check()
    return { result: { text: 'Mines' } } as never
  })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  check = async () => {
    await ui.advance(100)
    seen = await shows(ui, /Claude hat eine Frage an dich/)
  }
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({
    tool: 'AskUserQuestion',
    questions: [
      {
        question: 'Welches Spiel?',
        header: 'Spiel',
        multiSelect: false,
        options: [
          { label: 'Mines', description: '' },
          { label: 'Merge', description: '' },
        ],
      },
    ],
  } as never)
  expect(seen).toBeDefined()
  await ui.advance(100)
  expect(await shows(ui, /eine Frage/)).toBeUndefined()
  await ui.unmount()
})

test('the chime is off unless switched on', async ($, on) => {
  const world = engine(on)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't1' })
  expect(world.sounds).toEqual([])
})

test('with sound on, Claude finishing chimes once', { options: { sound: true } }, async ($, on) => {
  const world = engine(on)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't1' })
  expect(world.sounds).toEqual(['sounds/pause.wav'])
})
