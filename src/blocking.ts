import { EntityMention } from './types.js'
import { soundex } from './algorithms.js'

export function generateCandidatePairs(
  entities: EntityMention[],
  strategies: ('prefix' | 'phonetic' | 'type')[],
  normalized: string[]
): Set<string> {
  const pairs = new Set<string>()
  const n = entities.length

  if (strategies.length === 0) {
    // All pairs (O(n^2))
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        pairs.add(`${i}:${j}`)
      }
    }
    return pairs
  }

  const addGroupPairs = (groups: Map<string, number[]>) => {
    for (const members of groups.values()) {
      for (let a = 0; a < members.length; a++) {
        for (let b = a + 1; b < members.length; b++) {
          const i = Math.min(members[a], members[b])
          const j = Math.max(members[a], members[b])
          pairs.add(`${i}:${j}`)
        }
      }
    }
  }

  for (const strategy of strategies) {
    if (strategy === 'prefix') {
      const groups = new Map<string, number[]>()
      for (let i = 0; i < n; i++) {
        const key = normalized[i].slice(0, 3)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(i)
      }
      addGroupPairs(groups)
    } else if (strategy === 'phonetic') {
      const groups = new Map<string, number[]>()
      for (let i = 0; i < n; i++) {
        const firstWord = normalized[i].split(' ')[0]
        const key = soundex(firstWord)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(i)
      }
      addGroupPairs(groups)
    } else if (strategy === 'type') {
      const groups = new Map<string, number[]>()
      for (let i = 0; i < n; i++) {
        const key = entities[i].type
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(i)
      }
      addGroupPairs(groups)
    }
  }

  return pairs
}
