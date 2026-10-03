import type { On } from 'claude-code'
import { expect, test } from 'claude-code/testing'

import { textWidth } from '../hooks/glyphs'

type World = {
  store: Map<string, unknown>
  sounds: string[]
  commands: { name: string; description?: string }[]
  /** The panes the engine says are open. */
  panes: { id: string; title: string; isShown: boolean; isFocused: boolean; isPlaced: boolean }[]
  /** What `ui.open` was asked for, and what it answers. */
  opened: unknown[]
  open: { isPlaced: true } | { isPlaced: false; reason: string }
  /** What a settings hook beneath the plugin answers to a permission request, if it does. */
  decision?: { behavior: 'allow' }
  /** What happens while that hook is still thinking about a request for `slowFor`. */
  slowFor?: string
  meanwhile?: () => Promise<unknown>
  /** Set, a clip keeps playing until the test ends it with `endSounds`. */
  isSoundHeld: boolean
  endSounds: (() => void)[]
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
    isSoundHeld: false,
    endSounds: [],
  }
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('classic.PermissionRequest', async (_$, e) => {
    if (e.tool_name !== world.slowFor) return (world.decision ? { decision: world.decision } : {}) as never
    await world.meanwhile?.()
    return { decision: { behavior: 'allow' } } as never
  })
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
    if (!world.isSoundHeld) return { value: undefined } as never
    return new Promise(resolve => world.endSounds.push(() => resolve({ value: undefined }))) as never
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
    await ui.advance(2000)
    expect(await shows(ui, /Claude ist fertig – du bist dran/)).toBeDefined()

    await $.turn.start({ text: 'more', turnId: `${surface}-2` })
    await ui.advance(100)
    expect(await shows(ui, /Claude ist fertig/)).toBeUndefined()

    // The ball was in the air: it waits for P, the keys may still be at the prompt.
    expect(await shows(ui, /Pause – P zum Weiterspielen/)).toBeDefined()
    await ui.key({ key: 'p', in: 'arcade' })
    await ui.advance(100)
    expect(await shows(ui, /⏸/)).toBeUndefined()

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

type Drawn = { type: string; props?: Record<string, unknown>; children?: (Drawn | string)[] }

function textOf(el: Drawn | string): string {
  return typeof el === 'string' ? el : (el.children ?? []).map(textOf).join('')
}

/** The menu as drawn: the title's lines, the width of the list's box and its games as plain text. */
async function menu(ui: { drawn: (scope: { in: string }) => Promise<unknown> }): Promise<{ title: string[]; width: unknown; rows: string[] }> {
  const root = (await ui.drawn({ in: 'arcade' })) as Drawn
  const list = (root.children ?? []).find((el): el is Drawn => typeof el !== 'string' && el.props?.borderStyle !== undefined)
  const all = (root.children ?? []).filter((el): el is Drawn => typeof el !== 'string')
  const title = all.slice(0, list ? all.indexOf(list) : 0).map(textOf)
  // Between two games stands a line of air.
  const rows = (list?.children ?? []).map(textOf).filter(row => row.trim() !== '')
  return { title, width: list?.props?.width, rows }
}

test('the menu: the title, the games in a frame, and under it what the chosen game is about', async ($, on) => {
  engine(on, { language: 'german' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)

  expect((await menu(ui)).title).toEqual(['▄▀█ █▀█ █▀▀ ▄▀█ █▀▄ █▀▀', '█▀█ █▀▄ █▄▄ █▀█ █▄▀ ██▄'])
  expect((await menu(ui)).rows.map(row => row.trim())).toEqual(['▶ ██ Mauerbrecher', '██ Wurm', 'Verschmelzen', '✱  Minen', '●○ Bullen & Kühe', '♥★ Paare'])
  expect(await shows(ui, /Räum die Mauer ab/)).toBeDefined()
  expect(await shows(ui, /Fressen, wachsen/)).toBeUndefined()

  await ui.key({ key: 'down', in: 'arcade' })
  await ui.advance(100)
  expect(await shows(ui, /Räum die Mauer ab/)).toBeUndefined()
  expect(await shows(ui, /Fressen, wachsen/)).toBeDefined()
  expect((await menu(ui)).rows[1]).toMatch(/^▶ ██ Wurm/)
  await ui.unmount()
})

for (const language of ['en', 'de', 'ja', 'zh', 'ru'] as const) {
  test(`the menu's rows are all as wide as their frame, records at the right edge (${language})`, { options: { language } }, async ($, on) => {
    const world = engine(on)
    world.store.set('best', { bricks: 300, mines: 12345 })
    await $.session.start(SESSION)
    const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
    await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
    await ui.advance(100)
    const { width, rows } = await menu(ui)
    expect(rows).toHaveLength(6)
    // The frame's border and padding take two cells on either side.
    for (const row of rows) expect([row, textWidth(row) + 4]).toEqual([row, width])
    expect(rows[0]).toMatch(/ 300$/)
    expect(rows[3]).toMatch(/ 12345$/)
    await ui.unmount()
  })
}

test('a pane narrower than the menu cuts the frame to the pane', async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 18, rows: 24, in: 'arcade' })
  await ui.advance(100)
  expect((await menu(ui)).width).toBe(18)
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
  expect(await ui.find({ type: 'Text', text: /^Arcade needs the terminal\.$/ })).toBeDefined()
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

  // Another tool finishing in between is not the answer, nor is the same
  // tool finishing in a subagent.
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a' } as never)
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' } as never)
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

test('a permission a settings hook answers by itself does not leave the game frozen', async ($, on) => {
  const world = engine(on, { language: 'german' })
  world.decision = { behavior: 'allow' }
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })

  // No dialog opens, and the tool may run for minutes.
  await $.classic.PermissionRequest(BASH)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeUndefined()
  expect(await shows(ui, /Leertaste: Start/)).toBeDefined()
  await ui.unmount()
})

test('a hook that answers one permission does not take another, open dialog with it', async ($, on) => {
  const world = engine(on, { language: 'german' })
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })

  // While a slow settings hook decides about Bash, a dialog opens for Read.
  world.slowFor = 'Bash'
  world.meanwhile = () => $.classic.PermissionRequest({ tool_name: 'Read', tool_input: { file_path: '/tmp/a' } } as never)
  await $.classic.PermissionRequest(BASH)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()

  // Bash runs, allowed by the hook; the dialog for Read is still open.
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()
  await $.tool.call({ tool: 'Read', file_path: '/tmp/a' } as never)
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()
  await ui.unmount()
})

test('with sound on, a permission a settings hook answers by itself does not chime', { options: { sound: true } }, async ($, on) => {
  const world = engine(on)
  world.decision = { behavior: 'allow' }
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.classic.PermissionRequest(BASH)
  expect(world.sounds).toEqual([])
})

test('a subagent that ends takes its open dialog with it', async ($, on) => {
  engine(on, { language: 'german' })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })

  // The subagent is stopped at its dialog: its tool never runs.
  await $.classic.PermissionRequest({ ...(BASH as object), agent_id: 'a1' } as never)
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()
  await $.turn.complete({ ...DONE, turnId: 't9', agentId: 'a2' })
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()
  await $.turn.complete({ ...DONE, turnId: 't8', agentId: 'a1' })
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()
  await ui.unmount()
})

test('the end of the main turn takes its dialog with it, and a new turn leaves a dialog of a subagent open', async ($, on) => {
  engine(on, { language: 'german' })
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.key({ key: 'return', in: 'arcade' })

  // Interrupted at its own permission dialog: the turn is over, so is the dialog.
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.classic.PermissionRequest(BASH)
  await $.turn.complete({ ...DONE, turnId: 't1' })
  await ui.advance(100)
  expect(await shows(ui, /Claude ist fertig – du bist dran/)).toBeDefined()
  await $.turn.start({ text: 'again', turnId: 't2' })
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()

  // A background subagent's dialog is still open when the next turn starts.
  await $.turn.complete({ ...DONE, turnId: 't2' })
  await $.classic.PermissionRequest({ ...(BASH as object), agent_id: 'a1' } as never)
  await $.turn.start({ text: 'next', turnId: 't3' })
  await ui.advance(100)
  expect(await shows(ui, /Claude wartet auf deine Freigabe/)).toBeDefined()
  await $.tool.call({ tool: 'Bash', command: 'ls', agentId: 'a1' } as never)
  await ui.advance(100)
  expect(await shows(ui, /⏸/)).toBeUndefined()
  await ui.unmount()
})

test('a ball in the air does not fly on behind the note that the pane is too narrow', async ($, on) => {
  engine(on)
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  await ui.key({ key: ' ', in: 'arcade' })
  await ui.advance(100)

  // Long enough to lose every ball, were the clock still running.
  await ui.resize({ columns: 30, rows: 24, in: 'arcade' })
  await ui.advance(60000)
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(33)
  expect(await shows(ui, /Game over/)).toBeUndefined()
  expect(await shows(ui, /Space: continue/)).toBeUndefined()
  expect(await shows(ui, /♥♥♥/)).toBeDefined()
  await ui.unmount()
})

test('the ascii glyphs reach the marks between the parts of a line', { options: { language: 'ja' } }, async ($, on) => {
  const world = engine(on)
  world.store.set('best', { bricks: 300 })
  await $.session.start(SESSION)
  const ui = await $.ui.mount({ surface: 'terminal', ...PANE })
  await ui.resize({ columns: 70, rows: 24, in: 'arcade' })
  await ui.advance(100)
  // The menu: the hint under the list.
  expect(await shows(ui, /·/)).toBeUndefined()
  expect(await shows(ui, / \| Enter /)).toBeDefined()

  // A game: the help line under the field.
  await ui.key({ key: 'return', in: 'arcade' })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await ui.advance(100)
  expect(await shows(ui, /·/)).toBeUndefined()
  expect(await shows(ui, / \| P /)).toBeDefined()
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
  // Claude going back to work is no reason to chime.
  await $.turn.start({ text: 'more', turnId: 't2' })
  await $.turn.start({ text: 'and more', turnId: 't3' })
  expect(world.sounds).toEqual(['sounds/pause.wav'])
})

test('with sound on, nothing waits for the chime to finish', { options: { sound: true } }, async ($, on) => {
  const world = engine(on)
  world.isSoundHeld = true
  on('tool.call', () => ({ result: { text: 'ok' } }) as never)
  await $.session.start(SESSION)
  await $.turn.start({ text: 'go', turnId: 't1' })

  // The clip is still playing when the dialog is due: these must come back.
  await $.classic.PermissionRequest(BASH)
  expect(world.sounds).toHaveLength(1)
  expect(world.endSounds).toHaveLength(1)
  await $.tool.call({ tool: 'Bash', command: 'ls' } as never)
  await $.turn.complete({ ...DONE, turnId: 't1' })
  expect(world.sounds).toHaveLength(2)
  for (const end of world.endSounds) end()
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
