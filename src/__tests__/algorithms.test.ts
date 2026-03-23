import { describe, it, expect } from 'vitest'
import {
  jaroWinkler,
  levenshteinSimilarity,
  diceSimilarity,
  soundex,
  metaphone,
  exactMatch,
  abbreviationMatch,
} from '../algorithms.js'

describe('jaroWinkler', () => {
  it('returns 0 for empty string vs non-empty', () => {
    expect(jaroWinkler('', 'a')).toBe(0)
  })

  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('hello', 'hello')).toBe(1)
  })

  it('scores similar names higher than dissimilar', () => {
    const close = jaroWinkler('martha', 'marhta')
    const far = jaroWinkler('martha', 'xyz')
    expect(close).toBeGreaterThan(far)
  })

  it('gives prefix bonus for common prefix', () => {
    const withPrefix = jaroWinkler('johnathan', 'john')
    const noPrefix = jaroWinkler('ohnathan', 'john')
    expect(withPrefix).toBeGreaterThan(noPrefix)
  })
})

describe('levenshteinSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(levenshteinSimilarity('abc', 'abc')).toBe(1)
  })

  it('returns 0 for empty vs non-empty', () => {
    expect(levenshteinSimilarity('', 'abc')).toBe(0)
  })

  it('returns partial score for similar strings', () => {
    const score = levenshteinSimilarity('kitten', 'sitting')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  it('returns lower score for very different strings', () => {
    const close = levenshteinSimilarity('abc', 'abd')
    const far = levenshteinSimilarity('abc', 'xyz')
    expect(close).toBeGreaterThan(far)
  })
})

describe('diceSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(diceSimilarity('hello', 'hello')).toBe(1)
  })

  it('returns 0 for strings shorter than 2 chars', () => {
    expect(diceSimilarity('a', 'b')).toBe(0)
  })

  it('returns 0 for completely different bigrams', () => {
    expect(diceSimilarity('ab', 'cd')).toBe(0)
  })

  it('scores partially similar strings', () => {
    const score = diceSimilarity('night', 'nighty')
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })
})

describe('soundex', () => {
  it('Robert and Rupert have same soundex', () => {
    expect(soundex('Robert')).toBe(soundex('Rupert'))
  })

  it('returns 4-char code', () => {
    expect(soundex('Smith').length).toBe(4)
  })

  it('starts with first letter uppercase', () => {
    expect(soundex('washington')[0]).toBe('W')
  })

  it('pads with zeros', () => {
    expect(soundex('Lee')).toBe('L000')
  })

  it('different names have different codes', () => {
    expect(soundex('Smith')).not.toBe(soundex('Jones'))
  })
})

describe('metaphone', () => {
  it('returns non-empty string for normal words', () => {
    expect(metaphone('smith').length).toBeGreaterThan(0)
  })

  it('handles PH → F', () => {
    const ph = metaphone('phone')
    const f = metaphone('fone')
    expect(ph).toBe(f)
  })

  it('handles empty string', () => {
    expect(metaphone('')).toBe('')
  })
})

describe('exactMatch', () => {
  it('returns 1.0 for identical strings', () => {
    expect(exactMatch('ibm', 'ibm')).toBe(1.0)
  })

  it('returns 0.0 for different strings', () => {
    expect(exactMatch('ibm', 'ibm corp')).toBe(0.0)
  })
})

describe('abbreviationMatch', () => {
  it('matches acronym to full name', () => {
    expect(abbreviationMatch('IBM', 'International Business Machines')).toBe(0.9)
  })

  it('matches in reverse order', () => {
    expect(abbreviationMatch('International Business Machines', 'IBM')).toBe(0.9)
  })

  it('returns 0 for non-matching pairs', () => {
    expect(abbreviationMatch('IBM', 'Apple Inc')).toBe(0.0)
  })

  it('returns 0 for same-length strings', () => {
    expect(abbreviationMatch('abc', 'def')).toBe(0.0)
  })

  it('handles stop words in full name (FBI)', () => {
    expect(abbreviationMatch('FBI', 'Federal Bureau of Investigation')).toBe(0.9)
  })

  it('handles stop words in full name (USA)', () => {
    expect(abbreviationMatch('USA', 'United States of America')).toBe(0.9)
  })

  it('handles stop words in full name (NASA)', () => {
    expect(abbreviationMatch('NASA', 'National Aeronautics and Space Administration')).toBe(0.9)
  })
})

describe('jaroWinkler short strings', () => {
  it('returns non-zero for transposed 2-char strings', () => {
    expect(jaroWinkler('ab', 'ba')).toBeGreaterThan(0)
  })

  it('returns non-zero for transposed 3-char strings', () => {
    expect(jaroWinkler('abc', 'bac')).toBeGreaterThan(0)
  })
})
