import { CanonicalEntity, EntityMention, MatchPair, ResolverOptions } from './types.js'

export function buildCanonical(mention: EntityMention): CanonicalEntity {
  return {
    name: mention.name,
    type: mention.type,
    aliases: mention.aliases ? [...mention.aliases] : [],
    properties: mention.properties ? { ...mention.properties } : {},
    mentions: [mention],
    mentionCount: 1,
  }
}

export function mergeEntities(
  canonical: CanonicalEntity,
  mention: EntityMention,
  options: ResolverOptions
): CanonicalEntity {
  const nameStrategy = options.nameStrategy ?? 'firstSeen'
  const propertyMerge = options.propertyMerge ?? 'union'

  // Add mention
  const mentions = [...canonical.mentions, mention]
  const mentionCount = canonical.mentionCount + 1

  // Merge aliases (deduplicated)
  const aliasSet = new Set<string>([...canonical.aliases])
  aliasSet.add(mention.name)
  if (mention.aliases) {
    for (const a of mention.aliases) aliasSet.add(a)
  }
  // Remove canonical name from aliases
  const newName = pickName(canonical, mention, mentions, nameStrategy)
  aliasSet.delete(newName)
  // Keep old canonical name in aliases if it changed
  if (newName !== canonical.name) aliasSet.add(canonical.name)
  const aliases = [...aliasSet]

  // Merge properties
  let properties: Record<string, unknown>
  if (propertyMerge === 'firstWins') {
    // firstWins: only keep canonical's existing properties, ignore new properties from mentions
    properties = { ...canonical.properties }
  } else {
    // union: merge all properties, canonical wins on key conflict
    properties = { ...(mention.properties ?? {}), ...canonical.properties }
  }

  return {
    name: newName,
    type: canonical.type,
    aliases,
    properties,
    mentions,
    mentionCount,
  }
}

function pickName(
  canonical: CanonicalEntity,
  mention: EntityMention,
  mentions: EntityMention[],
  strategy: 'longest' | 'mostFrequent' | 'firstSeen'
): string {
  switch (strategy) {
    case 'longest': {
      const allNames = [canonical.name, mention.name]
      return allNames.reduce((a, b) => (b.length > a.length ? b : a))
    }
    case 'mostFrequent': {
      const freq = new Map<string, number>()
      for (const m of mentions) {
        freq.set(m.name, (freq.get(m.name) ?? 0) + 1)
      }
      let best = canonical.name
      let bestCount = 0
      for (const [name, count] of freq) {
        if (count > bestCount) {
          best = name
          bestCount = count
        }
      }
      return best
    }
    case 'firstSeen':
    default:
      return canonical.name
  }
}

// Union-Find implementation for transitive closure
class UnionFind {
  private parent: Map<string, string> = new Map()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    const p = this.parent.get(x)!
    if (p !== x) {
      this.parent.set(x, this.find(p))
    }
    return this.parent.get(x)!
  }

  union(x: string, y: string): void {
    const px = this.find(x)
    const py = this.find(y)
    if (px !== py) this.parent.set(px, py)
  }
}

export function transitiveClose(
  matches: MatchPair[]
): Map<string, string> {
  const uf = new UnionFind()

  for (const match of matches) {
    if (match.classification === 'same') {
      uf.union(match.entityA, match.entityB)
    }
  }

  // Collect all entity names involved
  const allNames = new Set<string>()
  for (const match of matches) {
    allNames.add(match.entityA)
    allNames.add(match.entityB)
  }

  const result = new Map<string, string>()
  for (const name of allNames) {
    result.set(name, uf.find(name))
  }

  return result
}
