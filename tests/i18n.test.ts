import { describe, expect, test } from 'claude-code/testing'

import { GLYPHS, padTo, textWidth } from '../hooks/glyphs'
import { LOCALES, TEXTS, matchLocale, prefersAscii, resolveLocale, t } from '../hooks/i18n'
import type { TextKey } from '../hooks/i18n'

describe('choosing the language', () => {
  test("Claude Code's free-text language setting is understood", () => {
    expect(matchLocale('german')).toBe('de')
    expect(matchLocale('Deutsch')).toBe('de')
    expect(matchLocale('日本語')).toBe('ja')
    expect(matchLocale('Brazilian Portuguese')).toBe('pt')
    expect(matchLocale('español')).toBe('es')
    expect(matchLocale('Simplified Chinese')).toBe('zh')
  })

  test('system locales are understood', () => {
    expect(matchLocale('de_DE.UTF-8')).toBe('de')
    expect(matchLocale('fr_CA')).toBe('fr')
    expect(matchLocale('C.UTF-8')).toBeUndefined()
    expect(matchLocale('POSIX')).toBeUndefined()
  })

  test('the first source that names a known language wins, English last', () => {
    expect(resolveLocale(['auto', 'korean', 'de_DE.UTF-8'])).toBe('ko')
    expect(resolveLocale([undefined, 'klingon', 'it_IT.UTF-8'])).toBe('it')
    expect(resolveLocale([undefined, undefined, 'C'])).toBe('en')
  })

  test('CJK languages default to ascii glyphs', () => {
    expect(prefersAscii('ja')).toBe(true)
    expect(prefersAscii('de')).toBe(false)
  })
})

describe('texts', () => {
  const keys = Object.keys(TEXTS.en) as TextKey[]

  test('every language has every text, and no other', () => {
    expect(Object.keys(TEXTS).sort()).toEqual([...LOCALES].sort())
    for (const loc of LOCALES) {
      const table: Record<string, string | undefined> = TEXTS[loc]
      for (const key of keys) expect([loc, key, Boolean(table[key])]).toEqual([loc, key, true])
      expect([loc, Object.keys(table).filter(key => !(key in TEXTS.en))]).toEqual([loc, []])
    }
  })

  test('every language keeps the placeholders of the English text', () => {
    for (const loc of LOCALES) {
      for (const key of keys) {
        const wanted = (TEXTS.en[key].match(/\{\w+\}/g) ?? []).sort()
        expect([loc, key, (TEXTS[loc][key].match(/\{\w+\}/g) ?? []).sort()]).toEqual([loc, key, wanted])
      }
    }
  })

  // Merge's goal is a number that is also another game's name: the texts
  // speak of the gold tile instead.
  test('no text spells out the goal of Merge as a number', () => {
    for (const loc of LOCALES) for (const key of keys) expect([loc, key, /2048/.test(TEXTS[loc][key])]).toEqual([loc, key, false])
  })

  test('placeholders are filled; one the caller does not fill stays as it is', () => {
    expect(t('de', 'hud.score', { n: 42 })).toBe('Punkte 42')
    expect(t('en', 'cmd.waiting', { reason: 'no pane here' })).toBe('Arcade is open but cannot be shown here yet: no pane here')
    expect(t('en', 'hud.score', {})).toBe('Score {n}')
  })

  test('a help line can name the glyphs it explains', () => {
    const help = t('en', 'cows.help', GLYPHS.ascii as unknown as Record<string, string>)
    expect(help).toContain(`${GLYPHS.ascii.bull} right place`)
    expect(help).not.toMatch(/\{\w+\}/)
  })
})

describe('text width', () => {
  test('CJK characters take two cells', () => {
    expect(textWidth('abc')).toBe(3)
    expect(textWidth('得分')).toBe(4)
    expect(textWidth('スコア 10')).toBe(9)
  })

  test('padding counts cells, not characters', () => {
    expect(padTo('得分', 6)).toBe('得分  ')
    expect(textWidth(padTo('得分', 6))).toBe(6)
    expect(padTo('too long', 3)).toBe('too long')
  })
})
