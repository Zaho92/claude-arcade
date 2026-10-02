// Every game in the menu, in menu order.

import { bricks } from './bricks'
import { merge } from './merge'
import { worm } from './worm'
import type { GameDef } from './types'

export const GAMES: readonly GameDef[] = [bricks, worm, merge]
