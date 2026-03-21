import {
  CanonicalEntity,
  EntityMention,
  EntityResolver,
  MatchPair,
  ResolutionResult,
  ResolverOptions,
  SimilarityResult,
} from './types.js'
import { normalizeName } from './normalize.js'
import { generateCandidatePairs } from './blocking.js'
import { scorePair } from './scorer.js'
import { buildCanonical, mergeEntities, transitiveClose } from './merge.js'

const DEFAULT_AUTO_MERGE = 0.90
const DEFAULT_REVIEW = 0.70

export function resolve(
  entities: EntityMention[],
  options: ResolverOptions = {}
): ResolutionResult {
  const start = Date.now()
  const autoMerge = options.autoMergeThreshold ?? DEFAULT_AUTO_MERGE
  const review = options.reviewThreshold ?? DEFAULT_REVIEW
  const blockingStrategies = options.blocking ?? []

  // 1. Normalize all names
  const normalized = entities.map((e) => normalizeName(e.name))

  // 2. Generate candidate pairs
  const candidatePairs = generateCandidatePairs(entities, blockingStrategies, normalized)

  // 3. Score all candidate pairs
  const matches: MatchPair[] = []
  // Track which index pairs are 'same' for union-find (avoids name-based ambiguity)
  const samePairs: Array<[number, number]> = []

  for (const pairKey of candidatePairs) {
    const [iStr, jStr] = pairKey.split(':')
    const i = parseInt(iStr, 10)
    const j = parseInt(jStr, 10)
    const a = entities[i]
    const b = entities[j]

    const result = scorePair(a, b, normalized[i], normalized[j], options)

    let classification: 'same' | 'possible' | 'different'
    if (!result.typesCompatible || result.score < review) {
      classification = 'different'
    } else if (result.score >= autoMerge) {
      classification = 'same'
      samePairs.push([i, j])
    } else {
      classification = 'possible'
    }

    matches.push({
      entityA: a.name,
      entityB: b.name,
      similarity: result.score,
      classification,
      methodScores: result.methodScores,
    })
  }

  // 4. Build canonical groups using index-based union-find
  // This avoids name-collision issues (two distinct entities sharing the same string name)
  const ufParent: number[] = entities.map((_, i) => i)

  function ufFind(x: number): number {
    if (ufParent[x] !== x) ufParent[x] = ufFind(ufParent[x])
    return ufParent[x]
  }

  function ufUnion(x: number, y: number): void {
    const px = ufFind(x)
    const py = ufFind(y)
    if (px !== py) ufParent[px] = py
  }

  for (const [i, j] of samePairs) {
    ufUnion(i, j)
  }

  // Build mergeMap for external consumers (name → canonical name)
  const mergeMap = transitiveClose(matches)

  // 5. Build canonical entities using index-based groups
  const groups = new Map<number, number[]>()
  for (let i = 0; i < entities.length; i++) {
    const root = ufFind(i)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(i)
  }

  const canonicalEntities: CanonicalEntity[] = []
  let mentionsMerged = 0

  for (const [, memberIndices] of groups) {
    if (memberIndices.length === 0) continue
    let canonical = buildCanonical(entities[memberIndices[0]])
    for (let k = 1; k < memberIndices.length; k++) {
      canonical = mergeEntities(canonical, entities[memberIndices[k]], options)
      mentionsMerged++
    }
    canonicalEntities.push(canonical)
  }

  // Build final mergeMap (name → canonical name)
  const finalMergeMap: Record<string, string> = {}
  for (const [name, rep] of mergeMap) {
    // Find the canonical entity that has this representative
    const entity = canonicalEntities.find(
      (ce) => ce.name === rep || ce.aliases.includes(rep) || ce.mentions.some((m) => m.name === rep)
    )
    finalMergeMap[name] = entity?.name ?? rep
  }

  const sameCount = matches.filter((m) => m.classification === 'same').length
  const possibleCount = matches.filter((m) => m.classification === 'possible').length

  return {
    entities: canonicalEntities,
    matches,
    unresolved: [],
    mergeMap: finalMergeMap,
    stats: {
      totalMentions: entities.length,
      canonicalEntities: canonicalEntities.length,
      mentionsMerged,
      candidatePairs: candidatePairs.size,
      sameCount,
      possibleCount,
      durationMs: Date.now() - start,
    },
  }
}

export function similarity(
  a: EntityMention,
  b: EntityMention,
  options: ResolverOptions = {}
): SimilarityResult {
  const normalA = normalizeName(a.name)
  const normalB = normalizeName(b.name)
  return scorePair(a, b, normalA, normalB, options)
}

export function createResolver(config: ResolverOptions = {}): EntityResolver {
  let canonicals: CanonicalEntity[] = []

  const autoMerge = config.autoMergeThreshold ?? DEFAULT_AUTO_MERGE

  return {
    get size() {
      return canonicals.length
    },

    resolve(entities: EntityMention[]): ResolutionResult {
      canonicals = []
      return resolve(entities, config)
    },

    addEntity(mention: EntityMention): {
      action: 'merged' | 'added'
      canonicalEntity: CanonicalEntity
      similarity: number
    } {
      const normalMention = normalizeName(mention.name)

      let bestScore = 0
      let bestIdx = -1

      for (let i = 0; i < canonicals.length; i++) {
        const c = canonicals[i]
        const normalC = normalizeName(c.name)
        const result = scorePair(
          mention,
          { name: c.name, type: c.type, aliases: c.aliases },
          normalMention,
          normalC,
          config
        )
        if (result.score > bestScore) {
          bestScore = result.score
          bestIdx = i
        }
      }

      if (bestIdx >= 0 && bestScore >= autoMerge) {
        canonicals[bestIdx] = mergeEntities(canonicals[bestIdx], mention, config)
        return { action: 'merged', canonicalEntity: canonicals[bestIdx], similarity: bestScore }
      }

      const newCanonical = buildCanonical(mention)
      canonicals.push(newCanonical)
      return { action: 'added', canonicalEntity: newCanonical, similarity: bestScore }
    },

    similarity(a: EntityMention, b: EntityMention): SimilarityResult {
      return similarity(a, b, config)
    },

    getEntities(): CanonicalEntity[] {
      return [...canonicals]
    },

    getEntity(name: string): CanonicalEntity | undefined {
      return canonicals.find(
        (c) => c.name === name || c.aliases.includes(name)
      )
    },

    reset(): void {
      canonicals = []
    },
  }
}
