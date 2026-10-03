// Every game in the menu, in menu order.

import { bricks } from './bricks'
import { cows } from './cows'
import { fifteen } from './fifteen'
import { merge } from './merge'
import { mines } from './mines'
import { worm } from './worm'
import type { GameDef } from './types'

export const GAMES: readonly GameDef[] = [bricks, worm, merge, mines, cows, fifteen]
