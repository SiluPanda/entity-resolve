export interface EntityMention {
  name: string
  type: string
  aliases?: string[]
  properties?: Record<string, unknown>
  source?: string
}

export interface CanonicalEntity {
  name: string
  type: string
  aliases: string[]
  properties: Record<string, unknown>
  mentions: EntityMention[]
  mentionCount: number
}

export interface MatchPair {
  entityA: string
  entityB: string
  similarity: number
  classification: 'same' | 'possible' | 'different'
  methodScores: Record<string, number>
}

export interface ResolutionResult {
  entities: CanonicalEntity[]
  matches: MatchPair[]
  unresolved: EntityMention[]
  mergeMap: Record<string, string>
  stats: ResolutionStats
}

export interface ResolutionStats {
  totalMentions: number
  canonicalEntities: number
  mentionsMerged: number
  candidatePairs: number
  sameCount: number
  possibleCount: number
  durationMs: number
}

export interface SimilarityResult {
  score: number
  methodScores: Record<string, number>
  typesCompatible: boolean
}

export interface ResolverOptions {
  autoMergeThreshold?: number   // default 0.90
  reviewThreshold?: number      // default 0.70
  methods?: {
    exactMatch?: { weight?: number }
    jaroWinkler?: { weight?: number }
    levenshtein?: { weight?: number }
    dice?: { weight?: number }
    soundex?: { weight?: number }
    metaphone?: { weight?: number }
  }
  blocking?: ('prefix' | 'phonetic' | 'type')[]
  nameStrategy?: 'longest' | 'mostFrequent' | 'firstSeen'
  propertyMerge?: 'union' | 'firstWins'
  typeHierarchy?: Record<string, string>
}

export interface EntityResolver {
  resolve(entities: EntityMention[]): ResolutionResult
  addEntity(entity: EntityMention): { action: 'merged' | 'added'; canonicalEntity: CanonicalEntity; similarity: number }
  similarity(a: EntityMention, b: EntityMention): SimilarityResult
  getEntities(): CanonicalEntity[]
  getEntity(name: string): CanonicalEntity | undefined
  readonly size: number
  reset(): void
}
