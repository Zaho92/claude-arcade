// Every game in the menu, in menu order.

import { breakout } from './breakout'
import { snake } from './snake'
import type { GameDef } from './types'

export const GAMES: readonly GameDef[] = [breakout, snake]
