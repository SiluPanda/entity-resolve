import { EntityMention, ResolverOptions, SimilarityResult } from './types.js'
import {
  exactMatch,
  jaroWinkler,
  levenshteinSimilarity,
  diceSimilarity,
  soundex,
  metaphone,
  abbreviationMatch,
} from './algorithms.js'
import { normalizeName } from './normalize.js'

const DEFAULT_WEIGHTS: Record<string, number> = {
  exactMatch: 2.0,
  jaroWinkler: 1.5,
  levenshtein: 1.0,
  dice: 1.0,
  soundex: 0.5,
  metaphone: 0.5,
}

function typesCompatible(
  typeA: string,
  typeB: string,
  hierarchy?: Record<string, string>
): boolean {
  if (typeA === typeB) return true
  if (!hierarchy) return false
  // Check if one is parent of the other in hierarchy
  return hierarchy[typeA] === typeB || hierarchy[typeB] === typeA
}

function scoreNames(
  a: string,
  b: string,
  weights: Record<string, number>
): Record<string, number> {
  const scores: Record<string, number> = {}

  if ('exactMatch' in weights) scores.exactMatch = exactMatch(a, b)
  if ('jaroWinkler' in weights) scores.jaroWinkler = jaroWinkler(a, b)
  if ('levenshtein' in weights) scores.levenshtein = levenshteinSimilarity(a, b)
  if ('dice' in weights) scores.dice = diceSimilarity(a, b)
  if ('soundex' in weights) {
    scores.soundex = soundex(a.split(' ')[0]) === soundex(b.split(' ')[0]) ? 1.0 : 0.0
  }
  if ('metaphone' in weights) {
    scores.metaphone = metaphone(a.split(' ')[0]) === metaphone(b.split(' ')[0]) ? 1.0 : 0.0
  }

  return scores
}

function weightedAverage(scores: Record<string, number>, weights: Record<string, number>): number {
  let weightedSum = 0
  let totalWeight = 0
  for (const [method, score] of Object.entries(scores)) {
    const w = weights[method] ?? 0
    weightedSum += w * score
    totalWeight += w
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

export function scorePair(
  a: EntityMention,
  b: EntityMention,
  normalA: string,
  normalB: string,
  options: ResolverOptions
): SimilarityResult {
  const compatible = typesCompatible(a.type, b.type, options.typeHierarchy)

  // Build active weights
  const weights: Record<string, number> = {}
  const methodCfg = options.methods ?? {}

  const methodKeys: Array<keyof typeof DEFAULT_WEIGHTS> = [
    'exactMatch', 'jaroWinkler', 'levenshtein', 'dice', 'soundex', 'metaphone',
  ]
  for (const key of methodKeys) {
    const cfg = methodCfg[key as keyof typeof methodCfg] as { weight?: number } | undefined
    if (cfg === null) continue  // explicitly disabled
    weights[key] = cfg?.weight ?? DEFAULT_WEIGHTS[key]
  }

  if (!compatible) {
    return { score: 0, methodScores: {}, typesCompatible: false }
  }

  // Score primary names
  let bestScores = scoreNames(normalA, normalB, weights)
  let bestScore = weightedAverage(bestScores, weights)

  // Check abbreviation
  const abbrScore = abbreviationMatch(normalA, normalB)
  if (abbrScore > bestScore) {
    bestScore = abbrScore
    bestScores = { ...bestScores, abbreviation: abbrScore }
  }

  // Check aliases
  const aliasesA = [normalA, ...(a.aliases ?? []).map(normalizeName)]
  const aliasesB = [normalB, ...(b.aliases ?? []).map(normalizeName)]

  for (const na of aliasesA) {
    for (const nb of aliasesB) {
      if (na === normalA && nb === normalB) continue  // already done
      const s = scoreNames(na, nb, weights)
      const score = weightedAverage(s, weights)
      if (score > bestScore) {
        bestScore = score
        bestScores = s
      }
      const abbrS = abbreviationMatch(na, nb)
      if (abbrS > bestScore) {
        bestScore = abbrS
        bestScores = { ...s, abbreviation: abbrS }
      }
    }
  }

  return {
    score: bestScore,
    methodScores: bestScores,
    typesCompatible: true,
  }
}
