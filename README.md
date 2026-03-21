# entity-resolve

Deduplicate and merge entity mentions across documents using multiple similarity algorithms.

## Install

```bash
npm install entity-resolve
```

Zero runtime dependencies.

## Quick start

```typescript
import { resolve } from 'entity-resolve'

const mentions = [
  { name: 'IBM', type: 'organization' },
  { name: 'International Business Machines', type: 'organization' },
  { name: 'Google', type: 'organization' },
  { name: 'Google Inc', type: 'organization' },
]

const result = resolve(mentions)
// result.entities → 2 canonical entities
// result.stats.mentionsMerged → 2
```

## API

### `resolve(entities, options?)`

Batch-resolve a list of entity mentions. Returns a `ResolutionResult` with:

- `entities` — deduplicated `CanonicalEntity[]`
- `matches` — all scored `MatchPair[]`
- `mergeMap` — `Record<string, string>` mapping mention name → canonical name
- `stats` — `ResolutionStats` (counts, timings)

### `similarity(a, b, options?)`

Score a single pair of entity mentions. Returns a `SimilarityResult`:

```typescript
const result = similarity(
  { name: 'Dr. Jane Smith', type: 'person' },
  { name: 'Jane Smith', type: 'person' }
)
// result.score → 1.0 (after honorific normalization)
// result.methodScores → { exactMatch, jaroWinkler, levenshtein, dice, soundex, metaphone }
```

### `createResolver(config?)`

Stateful resolver for incremental entity accumulation:

```typescript
const resolver = createResolver({ autoMergeThreshold: 0.85 })

for (const mention of stream) {
  const { action, canonicalEntity } = resolver.addEntity(mention)
  // action: 'merged' | 'added'
}

const allEntities = resolver.getEntities()
resolver.reset()
```

## Similarity methods

| Method | Description |
|---|---|
| `exactMatch` | 1.0 if normalized names are identical |
| `jaroWinkler` | Jaro-Winkler distance with prefix bonus |
| `levenshtein` | Edit distance normalized to [0, 1] |
| `dice` | Bigram Dice coefficient |
| `soundex` | American Soundex phonetic matching |
| `metaphone` | Simplified Metaphone phonetic matching |

All methods are combined via weighted average (configurable via `options.methods`).

## Options

```typescript
interface ResolverOptions {
  autoMergeThreshold?: number       // default 0.90 — merge as 'same'
  reviewThreshold?: number          // default 0.70 — flag as 'possible'
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
```

### Blocking strategies

Reduce O(n²) comparisons for large entity sets:

- `prefix` — compare only entities sharing the first 3 characters
- `phonetic` — compare only entities with the same Soundex code
- `type` — compare only entities of the same type

### Name strategy

Controls which name becomes the canonical name when merging:

- `firstSeen` (default) — keep the first encountered name
- `longest` — keep the longest name
- `mostFrequent` — keep the most frequently mentioned name

## License

MIT
