function jaro(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const matchDistance = Math.floor(Math.max(a.length, b.length) / 2) - 1
  const matchDistanceSafe = Math.max(1, matchDistance)

  const aMatches = new Array<boolean>(a.length).fill(false)
  const bMatches = new Array<boolean>(b.length).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchDistanceSafe)
    const end = Math.min(i + matchDistanceSafe + 1, b.length)
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue
      aMatches[i] = true
      bMatches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  let k = 0
  for (let i = 0; i < a.length; i++) {
    if (!aMatches[i]) continue
    while (!bMatches[k]) k++
    if (a[i] !== b[k]) transpositions++
    k++
  }

  return (matches / a.length + matches / b.length + (matches - transpositions / 2) / matches) / 3
}

export function jaroWinkler(a: string, b: string): number {
  const jaroScore = jaro(a, b)
  const prefixLen = Math.min(
    4,
    [...Array(Math.min(a.length, b.length))].findIndex((_, i) => a[i] !== b[i]) === -1
      ? Math.min(a.length, b.length)
      : [...Array(Math.min(a.length, b.length))].findIndex((_, i) => a[i] !== b[i])
  )
  return jaroScore + prefixLen * 0.1 * (1 - jaroScore)
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length === 0 || b.length === 0) return 0.0

  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (__, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return 1 - dp[m][n] / Math.max(m, n)
}

function getBigrams(s: string): Map<string, number> {
  const bigrams = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s.slice(i, i + 2)
    bigrams.set(bg, (bigrams.get(bg) ?? 0) + 1)
  }
  return bigrams
}

export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1.0
  if (a.length < 2 || b.length < 2) return 0.0

  const bigramsA = getBigrams(a)
  const bigramsB = getBigrams(b)

  let intersection = 0
  for (const [bg, countA] of bigramsA) {
    const countB = bigramsB.get(bg) ?? 0
    intersection += Math.min(countA, countB)
  }

  const totalA = a.length - 1
  const totalB = b.length - 1

  return (2 * intersection) / (totalA + totalB)
}

const SOUNDEX_TABLE: Record<string, string> = {
  b: '1', f: '1', p: '1', v: '1',
  c: '2', g: '2', j: '2', k: '2', q: '2', s: '2', x: '2', z: '2',
  d: '3', t: '3',
  l: '4',
  m: '5', n: '5',
  r: '6',
}

export function soundex(word: string): string {
  if (!word) return '0000'
  const upper = word.toUpperCase().replace(/[^A-Z]/g, '')
  if (!upper) return '0000'

  const first = upper[0]
  let code = first
  let prev = SOUNDEX_TABLE[first.toLowerCase()] ?? '0'

  for (let i = 1; i < upper.length && code.length < 4; i++) {
    const ch = upper[i].toLowerCase()
    const digit = SOUNDEX_TABLE[ch] ?? '0'
    if (digit !== '0' && digit !== prev) {
      code += digit
    }
    prev = digit
  }

  return code.padEnd(4, '0')
}

export function metaphone(word: string): string {
  if (!word) return ''
  let s = word.toUpperCase().replace(/[^A-Z]/g, '')
  if (!s) return ''

  // Apply transformations
  s = s.replace(/^AE/, 'E')
  s = s.replace(/^GN/, 'N')
  s = s.replace(/^KN/, 'N')
  s = s.replace(/^PN/, 'N')
  s = s.replace(/^WR/, 'R')

  let result = ''
  const vowels = new Set(['A', 'E', 'I', 'O', 'U'])

  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    const prev = i > 0 ? s[i - 1] : ''
    const next = i + 1 < s.length ? s[i + 1] : ''
    const next2 = i + 2 < s.length ? s[i + 2] : ''

    // Skip duplicate adjacent consonants (not C)
    if (ch !== 'C' && ch === prev) continue

    if (vowels.has(ch)) {
      // Only include vowels at the start
      if (i === 0) result += ch
      continue
    }

    switch (ch) {
      case 'B':
        // Drop B after M at end
        if (!(prev === 'M' && i === s.length - 1)) result += 'B'
        break
      case 'C':
        if (next === 'I' || next === 'E' || next === 'Y') {
          result += 'S'
        } else if (next === 'H') {
          result += 'X'
          i++
        } else if (next === 'K') {
          // CK → K
          result += 'K'
          i++
        } else {
          result += 'K'
        }
        break
      case 'D':
        if (next === 'G' && (next2 === 'E' || next2 === 'I' || next2 === 'Y')) {
          result += 'J'
          i++
        } else {
          result += 'T'
        }
        break
      case 'F':
        result += 'F'
        break
      case 'G':
        if (next === 'H') {
          // GH after vowel → drop
          if (i > 0 && vowels.has(prev)) {
            i++
            break
          }
          result += 'K'
          i++
        } else if (next === 'N') {
          // GN at end or GNE at end → drop G
          if (i === s.length - 2 || (next2 === 'E' && i === s.length - 3)) break
          result += 'K'
        } else if (next === 'E' || next === 'I' || next === 'Y') {
          result += 'J'
        } else {
          result += 'K'
        }
        break
      case 'H':
        // Drop H before/after vowels
        if (vowels.has(next) && !vowels.has(prev)) result += 'H'
        break
      case 'J':
        result += 'J'
        break
      case 'K':
        if (prev !== 'C') result += 'K'
        break
      case 'L':
        result += 'L'
        break
      case 'M':
        result += 'M'
        break
      case 'N':
        result += 'N'
        break
      case 'P':
        if (next === 'H') {
          result += 'F'
          i++
        } else {
          result += 'P'
        }
        break
      case 'Q':
        result += 'K'
        break
      case 'R':
        result += 'R'
        break
      case 'S':
        if (next === 'H' || (next === 'I' && (next2 === 'O' || next2 === 'A'))) {
          result += 'X'
          i++
        } else if (next === 'C' && next2 === 'H') {
          result += 'SK'
          i += 2
        } else {
          result += 'S'
        }
        break
      case 'T':
        if (next === 'H') {
          result += '0'
          i++
        } else if (next === 'I' && (next2 === 'A' || next2 === 'O')) {
          result += 'X'
        } else {
          result += 'T'
        }
        break
      case 'V':
        result += 'F'
        break
      case 'W':
        // W only at start or before vowel
        if (vowels.has(next)) result += 'W'
        break
      case 'X':
        result += 'KS'
        break
      case 'Y':
        if (vowels.has(next)) result += 'Y'
        break
      case 'Z':
        result += 'S'
        break
    }
  }

  return result
}

export function exactMatch(a: string, b: string): number {
  return a === b ? 1.0 : 0.0
}

const STOP_WORDS = new Set([
  'of', 'and', 'the', 'for', 'in', 'on', 'at', 'to', 'a', 'an',
])

export function abbreviationMatch(a: string, b: string): number {
  const isAbbrev = (abbr: string, full: string): boolean => {
    const abbrevUpper = abbr.toUpperCase()
    // abbr should be all single-word (no spaces) and shorter than full
    if (abbr.includes(' ') || abbr.length >= full.length) return false
    const words = full.split(/\s+/).filter(w => !STOP_WORDS.has(w.toLowerCase()))
    if (abbrevUpper.length !== words.length) return false
    return [...abbrevUpper].every((ch, i) => words[i] && words[i][0].toUpperCase() === ch)
  }

  if (isAbbrev(a, b) || isAbbrev(b, a)) return 0.9
  return 0.0
}
