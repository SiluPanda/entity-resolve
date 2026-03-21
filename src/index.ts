// entity-resolve - Deduplicate and merge entity mentions across documents
export { resolve, similarity, createResolver } from './resolver.js'
export type {
  EntityMention,
  CanonicalEntity,
  MatchPair,
  ResolutionResult,
  ResolutionStats,
  SimilarityResult,
  ResolverOptions,
  EntityResolver,
} from './types.js'
