import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { highest, pauseOf, scores, without } from '../hooks/register'

type World = {
  store: Map<string, unknown>
  sounds: string[]
  commands: { name: string; description?: string }[]
  /** The panes the engine says are open. */
  panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[]
  /** What `ui.open` was asked for, and what it answers. */
  opened: unknown[]
  open: { isPlaced: true } | { isPlaced: false; reason: string }
}

// What the engine answers beneath the plugin in a real session.
function engine(on: On, settings: Record<string, unknown> = {}, env: Record<string, string> = {}): World {
  const world: World = {
    store: new Map(),
    sounds: [],
    commands: [],
    panes: [{ id: 'arcade', title: 'Arcade', isShown: true, isFocused: true, isPlaced: true }],
    opened: [],
    open: { isPlaced: true },
  }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('classic.PermissionRequest', () => ({}) as never)
  on('settings.read', () => ({ value: settings }) as never)
  on('env.get', (_$, e) => ({ value: env[e.name] }) as never)
  on('command.register', (_$, e) => {
    world.commands.push(e as never)
    return { value: { command: e.name } } as never
  })
  on('ui.panes', () => ({ value: world.panes }) as never)
  on('ui.open', (_$, e) => {
    world.opened.push(e)
    return { value: world.open } as never
  })
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

const QUESTION = {
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
} as never

const BASH = { tool_name: 'Bash', tool_input: { command: 'ls' } } as never

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

test('the line that says why nothing moves stands under the field, whole, and hides no row of it', async ($, on) => {
  engine(on, {}, { LANG: 'ko_KR.UTF-8' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)

  // Worm starts on the middle row of its field. Korean picks the ascii
  // glyphs, so its head is "@@".
  await ui.key({ key: 'down', in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await ui.advance(100)
  expect(await shows(ui, /Claude가 작업을 시작하면 시작됩니다/)).toBeDefined()
  expect(await shows(ui, /@@/)).toBeDefined()

  // Merge's field is 29 cells wide, the sentence about 45.
  await ui.key({ key: 'q', in: 'arcade' })
  await ui.key({ key: 'down', in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't1' })
  await ui.advance(100)
  expect(await shows(ui, /Claude가 작업을 마쳤어요\. 이제 당신 차례예요/)).toBeDefined()
  await ui.unmount()
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

test('a pane too narrow for the game says so, and the game comes back when it is wide again', async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  expect(await shows(ui, /Space: start/)).toBeDefined()

  await ui.resize({ columns: 30, rows: 24, in: 'arcade' })
  await ui.advance(100)
  expect(await shows(ui, /Make the pane bigger/)).toBeDefined()
  expect(await shows(ui, /Space: start/)).toBeUndefined()

  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  expect(await shows(ui, /Make the pane bigger/)).toBeUndefined()
  expect(await shows(ui, /Space: start/)).toBeDefined()
  await ui.unmount()
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

test('the glyphs setting wins over what the language would pick', { options: { language: 'ja', glyphs: 'unicode' } }, async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  expect(await shows(ui, /^▶ /)).toBeDefined()
  await ui.unmount()
})

test('/arcade opens the pane and says how to play', async ($, on) => {
  const world = engine(on, { language: 'german' })
  await $.session.start(SESSION)
  const answer = await $.command.run({ command: 'arcade', args: '' } as never)
  expect(world.opened).toHaveLength(1)
  expect(world.opened[0]).toMatchObject({ id: 'arcade', title: 'Arcade', focus: true })
  expect(JSON.stringify(answer)).toContain('Arcade geöffnet')
})

test('/arcade passes on why the pane cannot be shown, instead of blaming the width', async ($, on) => {
  const world = engine(on)
  world.open = { isPlaced: false, reason: 'no attached surface places panes' }
  await $.session.start(SESSION)
  const answer = JSON.stringify(await $.command.run({ command: 'arcade', args: '' } as never))
  expect(answer).toContain('cannot be shown here yet: no attached surface places panes')
  expect(answer).not.toContain('Click into the field')
})

test('a surface that is neither terminal nor desktop is told so', async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'mobile', ...PANE })
  expect(await ui.find({ type: 'Text', text: /needs the terminal or the desktop app/ })).toBeDefined()
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
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

test('a game over keeps the high score per game, and a lower score never replaces it', async ($, on) => {
  const world = engine(on)
  world.store.set('best', { bricks: 300, junk: 'not a score' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  expect(await shows(ui, /Best 300/)).toBeDefined()

  await ui.post({ type: 'score', game: 'bricks', score: 420 }, { in: 'arcade' })
  await ui.advance(100)
  expect(world.store.get('best')).toEqual({ bricks: 420 })
  expect(await shows(ui, /Best 420/)).toBeDefined()

  await ui.post({ type: 'score', game: 'bricks', score: 50 }, { in: 'arcade' })
  await ui.post({ type: 'score', game: 'worm', score: 70 }, { in: 'arcade' })
  await ui.advance(100)
  expect(world.store.get('best')).toEqual({ bricks: 420, worm: 70 })
  expect(await shows(ui, /Best 420/)).toBeDefined()
  expect(await shows(ui, /Best 70/)).toBeDefined()

  // Anything else the pane might post leaves the scores alone.
  for (const junk of [null, 'score', { type: 'score', game: 'bricks' }, { type: 'score', game: 7, score: 9999 }, { type: 'other', game: 'bricks', score: 9999 }]) {
    await ui.post(junk as never, { in: 'arcade' })
  }
  await ui.advance(100)
  expect(world.store.get('best')).toEqual({ bricks: 420, worm: 70 })
  await ui.unmount()
})

test('a record is stored while the game still runs, so closing the pane keeps it', async ($, on) => {
  const world = engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  // Mines: the first field opened is always safe and counts at once.
  for (let i = 0; i < 3; i++) await ui.key({ key: 'down', in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  await ui.key({ key: ' ', in: 'arcade' })
  expect(world.store.get('best')).toBeUndefined()

  await ui.advance(6000)
  const stored = world.store.get('best') as { mines?: number } | undefined
  expect(stored?.mines).toBeGreaterThan(0)
  // Closed in the middle of the game: nothing more is posted, nothing is lost.
  await ui.unmount()
  expect(world.store.get('best')).toEqual(stored)
})

test('leaving a game with Q stores what was scored', async ($, on) => {
  const world = engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  for (let i = 0; i < 3; i++) await ui.key({ key: 'down', in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  await ui.key({ key: ' ', in: 'arcade' })
  await ui.key({ key: 'q', in: 'arcade' })
  await ui.advance(100)
  expect((world.store.get('best') as { mines?: number } | undefined)?.mines).toBeGreaterThan(0)
  // Back in the menu, the record stands beside the game.
  expect(await shows(ui, /Best \d+/)).toBeDefined()
  await ui.unmount()
})

test('a record another session stored in the meantime is kept', async ($, on) => {
  const world = engine(on)
  world.store.set('best', { bricks: 300 })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })

  // A second Claude Code session writes to the same store.
  world.store.set('best', { bricks: 900, worm: 50 })
  await ui.post({ type: 'score', game: 'mines', score: 12 }, { in: 'arcade' })
  await ui.advance(100)
  expect(world.store.get('best')).toEqual({ bricks: 900, worm: 50, mines: 12 })
  expect(await shows(ui, /Best 900/)).toBeDefined()
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
  await $.tool.call(QUESTION)
  expect(seen).toBeDefined()
  await ui.advance(100)
  expect(await shows(ui, /eine Frage/)).toBeUndefined()
  await ui.unmount()
})

test('a permission dialog freezes the game until the tool it is for has run', async ($, on) => {
  engine(on, { language: 'german' })
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()

  await $.classic.PermissionRequest(BASH)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()

  // Another tool finishing in between, here a subagent's, is not the answer.
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a', agentId: 'a1' } as never)
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a' } as never)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()

  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()
  await ui.unmount()
})

test('a dialog answered while Claude is idle leaves the game frozen', async ($, on) => {
  engine(on, { language: 'german' })
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...DONE, turnId: 't1' })

  // A background subagent asks for a permission after the main turn ended.
  await $.classic.PermissionRequest({ ...(BASH as object), agent_id: 'a1' } as never)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' } as never)
  await ui.advance(100)
  expect(await shows(ui, /Claude ist fertig – du bist dran/)).toBeDefined()

  // The same for a question.
  await $.tool.call(QUESTION)
  await ui.advance(100)
  expect(await shows(ui, /Claude ist fertig – du bist dran/)).toBeDefined()
  await ui.unmount()
})

test('what the games wait for: a dialog before the turn, each on its own', () => {
  expect(pauseOf({ turn: '', asking: [], permission: [] })).toEqual({ isPaused: false, reason: '' })
  expect(pauseOf({ turn: 'idle', asking: [], permission: [] })).toEqual({ isPaused: true, reason: 'idle' })
  expect(pauseOf({ turn: '', asking: [':1'], permission: [] })).toEqual({ isPaused: true, reason: 'asking' })
  expect(pauseOf({ turn: 'done', asking: [':1'], permission: [':Bash'] })).toEqual({ isPaused: true, reason: 'permission' })
  // Two dialogs for the same tool are two entries; one answer ends one.
  expect(without([':Bash', 'a1:Bash', ':Bash'], ':Bash')).toEqual(['a1:Bash', ':Bash'])
  expect(without([':Bash'], ':Read')).toEqual([':Bash'])
})

test('score tables merge to the higher score per game', () => {
  expect(scores({ bricks: 300, worm: '70', mines: null })).toEqual({ bricks: 300 })
  expect(scores(undefined)).toEqual({})
  expect(scores('bricks')).toEqual({})
  expect(highest({ bricks: 300, worm: 70 }, { bricks: 120, mines: 9 })).toEqual({ bricks: 300, worm: 70, mines: 9 })
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

test('with sound on, a question and a permission dialog chime too', { options: { sound: true } }, async ($, on) => {
  const world = engine(on)
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call(QUESTION)
  expect(world.sounds).toHaveLength(1)
  await $.classic.PermissionRequest(BASH)
  expect(world.sounds).toHaveLength(2)
  // Already frozen: a second dialog on top does not chime again.
  await $.classic.PermissionRequest(BASH)
  expect(world.sounds).toHaveLength(2)
})

test('with sound on but the arcade closed, nothing chimes', { options: { sound: true } }, async ($, on) => {
  const world = engine(on)
  world.panes = []
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call(QUESTION)
  await $.classic.PermissionRequest(BASH)
  await $.turn.complete({ ...DONE, turnId: 't1' })
  expect(world.sounds).toEqual([])
})
