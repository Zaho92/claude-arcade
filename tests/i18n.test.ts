import { describe, expect, test } from 'claude-code/testing'

import { center, clip, textWidth } from '../hooks/glyphs'
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

  test('English has every text', () => {
    for (const key of keys) expect(TEXTS.en[key]).toBeTruthy()
  })

  test('every language keeps the placeholders of the English text', () => {
    for (const loc of LOCALES) {
      for (const key of keys) {
        const text = TEXTS[loc][key]
        if (text === undefined) continue
        const wanted = (TEXTS.en[key]?.match(/\{\w+\}/g) ?? []).sort()
        expect([loc, key, (text.match(/\{\w+\}/g) ?? []).sort()]).toEqual([loc, key, wanted])
      }
    }
  })

  test('every language has a text for every pause reason', () => {
    for (const loc of LOCALES) {
      for (const key of ['pause.idle', 'pause.done', 'pause.asking', 'pause.permission'] as const) {
        expect(loc === 'en' || TEXTS[loc][key] !== undefined).toBe(true)
      }
    }
  })

  test('placeholders are filled and a missing text falls back to English', () => {
    expect(t('de', 'hud.score', { n: 42 })).toBe('Punkte 42')
    expect(t('de', 'title')).toBe('Arcade')
  })
})

describe('text width', () => {
  test('CJK characters take two cells', () => {
    expect(textWidth('abc')).toBe(3)
    expect(textWidth('得分')).toBe(4)
    expect(textWidth('スコア 10')).toBe(9)
  })

  test('center and clip count cells, not characters', () => {
    expect(textWidth(center('得分', 10))).toBe(10)
    expect(clip('得分得分', 5)).toBe('得分')
  })
})
