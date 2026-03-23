# entity-resolve

Deduplicate and merge entity mentions across documents using multi-method similarity scoring.

[![npm version](https://img.shields.io/npm/v/entity-resolve.svg)](https://www.npmjs.com/package/entity-resolve)
[![npm downloads](https://img.shields.io/npm/dt/entity-resolve.svg)](https://www.npmjs.com/package/entity-resolve)
[![license](https://img.shields.io/npm/l/entity-resolve.svg)](https://github.com/SiluPanda/entity-resolve/blob/master/LICENSE)
[![node](https://img.shields.io/node/v/entity-resolve.svg)](https://www.npmjs.com/package/entity-resolve)

---

## Description

`entity-resolve` is a zero-dependency entity resolution library for TypeScript and JavaScript. It takes a set of entity mentions -- names with types, aliases, and metadata extracted from one or more documents -- identifies which mentions refer to the same real-world entity, and merges them into canonical entities with consolidated aliases, properties, and provenance.

The resolution pipeline consists of six stages: name normalization, blocking/candidate generation, pairwise multi-method similarity scoring, confidence-based match classification, transitive closure, and entity merging. All similarity algorithms (Jaro-Winkler, Levenshtein, Dice coefficient, Soundex, Metaphone, exact match, abbreviation detection) are implemented in pure TypeScript with no runtime dependencies.

**Use cases:**

- Knowledge graph construction -- deduplicate entities extracted from multiple documents before building graph nodes
- CRM data cleanup -- identify and merge duplicate company or contact records
- Cross-document coreference -- consolidate "Walt Disney", "Disney", and "The Walt Disney Company" into a single entity
- Agent memory deduplication -- prevent AI agents from storing redundant entity records across conversations
- Document processing pipelines -- match incoming entity mentions against a canonical registry

---

## Installation

```bash
npm install entity-resolve
```

Requires Node.js 18 or later. Zero runtime dependencies.

---

## Quick Start

```typescript
import { resolve } from 'entity-resolve';

const mentions = [
  { name: 'IBM', type: 'organization' },
  { name: 'International Business Machines', type: 'organization' },
  { name: 'Google', type: 'organization' },
  { name: 'Dr. Jane Smith', type: 'person' },
  { name: 'Jane Smith', type: 'person' },
];

const result = resolve(mentions);

console.log(result.entities.length);
// 3 -- IBM + International Business Machines merged, Jane Smith merged, Google standalone

console.log(result.stats);
// { totalMentions: 5, canonicalEntities: 3, mentionsMerged: 2, ... }

console.log(result.mergeMap);
// { "IBM": "IBM", "International Business Machines": "IBM", ... }
```

---

## Features

- **Multi-method similarity scoring** -- Combines six string similarity algorithms plus abbreviation detection into a single weighted score per entity pair.
- **Configurable thresholds** -- Separate thresholds for auto-merge (high confidence) and review (medium confidence) classifications.
- **Blocking strategies** -- Reduce O(n^2) comparisons using prefix, phonetic, or type-based blocking.
- **Type-aware resolution** -- Entities of incompatible types are never merged, even if names are identical. Supports type hierarchies.
- **Name normalization** -- Strips honorifics (Dr., Mr., Prof.), suffixes (Jr, Sr, Inc, Corp, LLC), collapses whitespace, and applies Unicode NFC normalization before comparison.
- **Alias matching** -- Each entity can carry aliases that participate in pairwise comparison, enabling matches like "USA" against "United States".
- **Abbreviation detection** -- Automatically detects acronyms ("IBM" matches "International Business Machines").
- **Transitive closure** -- If A matches B and B matches C, all three are merged into a single canonical entity.
- **Configurable merge strategies** -- Control canonical name selection (longest, most frequent, first seen) and property merging (union, first-wins).
- **Stateful resolver** -- The `createResolver` factory returns a persistent resolver that supports incremental `addEntity()` calls alongside batch resolution.
- **Zero runtime dependencies** -- All algorithms are self-contained TypeScript. No native modules, no external services.
- **Full TypeScript support** -- Ships with declaration files and source maps.

---

## API Reference

### `resolve(entities, options?)`

Perform batch entity resolution on an array of entity mentions.

```typescript
function resolve(
  entities: EntityMention[],
  options?: ResolverOptions
): ResolutionResult;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `entities` | `EntityMention[]` | Array of entity mentions to resolve |
| `options` | `ResolverOptions` | Optional configuration (see [Configuration](#configuration)) |

**Returns:** `ResolutionResult`

```typescript
const result = resolve([
  { name: 'Barack Obama', type: 'person' },
  { name: 'Barack Obama', type: 'person' },
  { name: 'Google', type: 'organization' },
]);

result.entities;       // CanonicalEntity[] -- deduplicated entities
result.matches;        // MatchPair[] -- all evaluated pairs with scores
result.unresolved;     // EntityMention[] -- mentions that could not be resolved
result.mergeMap;       // Record<string, string> -- mention name -> canonical name
result.stats;          // ResolutionStats -- timing and counts
```

---

### `similarity(a, b, options?)`

Compute the composite similarity score between two entity mentions without performing full resolution.

```typescript
function similarity(
  a: EntityMention,
  b: EntityMention,
  options?: ResolverOptions
): SimilarityResult;
```

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `a` | `EntityMention` | First entity mention |
| `b` | `EntityMention` | Second entity mention |
| `options` | `ResolverOptions` | Optional configuration |

**Returns:** `SimilarityResult`

```typescript
const result = similarity(
  { name: 'Amazon', type: 'organization' },
  { name: 'Amazone', type: 'organization' }
);

result.score;            // number between 0.0 and 1.0
result.methodScores;     // { jaroWinkler: 0.96, levenshtein: 0.83, ... }
result.typesCompatible;  // true
```

If the two entities have incompatible types, `typesCompatible` is `false` and `score` is `0`.

---

### `createResolver(config?)`

Create a stateful resolver instance with pre-configured options. Supports both batch resolution and incremental entity addition.

```typescript
function createResolver(config?: ResolverOptions): EntityResolver;
```

**Returns:** `EntityResolver`

```typescript
const resolver = createResolver({ autoMergeThreshold: 0.85 });

// Incremental addition
const r1 = resolver.addEntity({ name: 'Tesla', type: 'organization' });
// { action: 'added', canonicalEntity: {...}, similarity: 0 }

const r2 = resolver.addEntity({ name: 'Tesla Inc', type: 'organization' });
// { action: 'merged', canonicalEntity: {...}, similarity: 0.92 }

// Query state
resolver.size;                    // 1
resolver.getEntities();           // CanonicalEntity[]
resolver.getEntity('Tesla');      // CanonicalEntity | undefined

// Pairwise similarity
resolver.similarity(entityA, entityB);  // SimilarityResult

// Batch resolution (resets internal state)
const result = resolver.resolve(mentions);

// Reset
resolver.reset();
```

---

### Types

#### `EntityMention`

Input type representing a single entity reference from a document or data source.

```typescript
interface EntityMention {
  name: string;                          // Entity name as it appears in the source
  type: string;                          // Entity type (e.g., "person", "organization", "location")
  aliases?: string[];                    // Known alternative names
  properties?: Record<string, unknown>;  // Arbitrary metadata
  source?: string;                       // Provenance identifier
}
```

#### `CanonicalEntity`

Output type representing a resolved, deduplicated entity produced by merging one or more mentions.

```typescript
interface CanonicalEntity {
  name: string;                          // Canonical name (selected by nameStrategy)
  type: string;                          // Entity type
  aliases: string[];                     // All merged surface forms
  properties: Record<string, unknown>;   // Merged metadata
  mentions: EntityMention[];             // Original mentions that were merged
  mentionCount: number;                  // Total number of merged mentions
}
```

#### `MatchPair`

Describes an evaluated pair of entities with their similarity score and classification.

```typescript
interface MatchPair {
  entityA: string;                          // Name of first entity
  entityB: string;                          // Name of second entity
  similarity: number;                       // Composite similarity score (0.0 to 1.0)
  classification: 'same' | 'possible' | 'different';  // Match verdict
  methodScores: Record<string, number>;     // Per-method scores
}
```

Classifications:
- `'same'` -- score >= `autoMergeThreshold` (default 0.90). Entities are automatically merged.
- `'possible'` -- score >= `reviewThreshold` (default 0.70) but below auto-merge. Flagged for review.
- `'different'` -- score below review threshold or types are incompatible.

#### `ResolutionResult`

The complete output of a `resolve()` call.

```typescript
interface ResolutionResult {
  entities: CanonicalEntity[];           // Deduplicated canonical entities
  matches: MatchPair[];                  // All evaluated pairs
  unresolved: EntityMention[];           // Mentions that could not be resolved
  mergeMap: Record<string, string>;      // mention name -> canonical entity name
  stats: ResolutionStats;               // Performance and summary statistics
}
```

#### `ResolutionStats`

Summary statistics from a resolution run.

```typescript
interface ResolutionStats {
  totalMentions: number;     // Number of input mentions
  canonicalEntities: number; // Number of output canonical entities
  mentionsMerged: number;    // Number of mentions merged into existing entities
  candidatePairs: number;    // Number of candidate pairs evaluated
  sameCount: number;         // Number of pairs classified as 'same'
  possibleCount: number;     // Number of pairs classified as 'possible'
  durationMs: number;        // Wall-clock time in milliseconds
}
```

#### `SimilarityResult`

Output of a pairwise similarity computation.

```typescript
interface SimilarityResult {
  score: number;                         // Weighted composite score (0.0 to 1.0)
  methodScores: Record<string, number>;  // Individual method scores
  typesCompatible: boolean;              // Whether entity types are compatible
}
```

#### `ResolverOptions`

Configuration object accepted by `resolve()`, `similarity()`, and `createResolver()`.

```typescript
interface ResolverOptions {
  autoMergeThreshold?: number;   // Minimum score for automatic merge (default: 0.90)
  reviewThreshold?: number;      // Minimum score for 'possible' classification (default: 0.70)
  methods?: {
    exactMatch?: { weight?: number };     // default weight: 2.0
    jaroWinkler?: { weight?: number };    // default weight: 1.5
    levenshtein?: { weight?: number };    // default weight: 1.0
    dice?: { weight?: number };           // default weight: 1.0
    soundex?: { weight?: number };        // default weight: 0.5
    metaphone?: { weight?: number };      // default weight: 0.5
  };
  blocking?: ('prefix' | 'phonetic' | 'type')[];  // Blocking strategies
  nameStrategy?: 'longest' | 'mostFrequent' | 'firstSeen';  // Canonical name selection (default: 'firstSeen')
  propertyMerge?: 'union' | 'firstWins';  // Property merge strategy (default: 'union')
  typeHierarchy?: Record<string, string>; // Type parent mapping (e.g., { company: 'organization' })
}
```

#### `EntityResolver`

Interface returned by `createResolver()`.

```typescript
interface EntityResolver {
  resolve(entities: EntityMention[]): ResolutionResult;
  addEntity(entity: EntityMention): {
    action: 'merged' | 'added';
    canonicalEntity: CanonicalEntity;
    similarity: number;
  };
  similarity(a: EntityMention, b: EntityMention): SimilarityResult;
  getEntities(): CanonicalEntity[];
  getEntity(name: string): CanonicalEntity | undefined;
  readonly size: number;
  reset(): void;
}
```

---

## Configuration

### Thresholds

Control how match pairs are classified:

```typescript
resolve(entities, {
  autoMergeThreshold: 0.85,  // Lower threshold = more aggressive merging
  reviewThreshold: 0.60,     // Lower threshold = fewer 'different' classifications
});
```

### Method Weights

Adjust the contribution of each similarity method to the composite score. Set weight to `0` to effectively disable a method:

```typescript
resolve(entities, {
  methods: {
    exactMatch: { weight: 3.0 },     // Heavily favor exact matches
    jaroWinkler: { weight: 1.5 },
    levenshtein: { weight: 1.0 },
    dice: { weight: 1.0 },
    soundex: { weight: 0.0 },        // Disable soundex
    metaphone: { weight: 0.0 },      // Disable metaphone
  },
});
```

Default weights:

| Method | Default Weight |
|--------|---------------|
| `exactMatch` | 2.0 |
| `jaroWinkler` | 1.5 |
| `levenshtein` | 1.0 |
| `dice` | 1.0 |
| `soundex` | 0.5 |
| `metaphone` | 0.5 |

### Blocking Strategies

Blocking reduces the number of pairwise comparisons from O(n^2) by grouping entities into blocks and only comparing within blocks. When no blocking strategies are specified, all pairs are compared.

```typescript
resolve(entities, {
  blocking: ['prefix', 'type'],
});
```

| Strategy | Grouping Key | Description |
|----------|-------------|-------------|
| `'prefix'` | First 3 characters of normalized name | Groups entities sharing a name prefix |
| `'phonetic'` | Soundex code of first word | Groups entities that sound alike |
| `'type'` | Entity type string | Only compares entities of the same type |

Multiple strategies can be combined. A pair is evaluated if it appears in any block (union of all strategies).

### Type Hierarchy

Define parent-child relationships between entity types. By default, entities of different types are never merged:

```typescript
resolve(entities, {
  typeHierarchy: {
    company: 'organization',
    startup: 'company',
    university: 'organization',
  },
});
// Now "company" and "organization" types are considered compatible
```

### Merge Strategies

Control how canonical entities are constructed when mentions are merged:

```typescript
resolve(entities, {
  nameStrategy: 'longest',      // Pick the longest name as canonical
  propertyMerge: 'firstWins',   // Earlier entity's properties take precedence
});
```

**Name strategies:**

| Strategy | Behavior |
|----------|----------|
| `'firstSeen'` | Keep the name of the first mention encountered (default) |
| `'longest'` | Pick the longest name among all merged mentions |
| `'mostFrequent'` | Pick the name that appears most often across mentions |

**Property merge strategies:**

| Strategy | Behavior |
|----------|----------|
| `'union'` | Merge all properties from all mentions; canonical entity's values win on key conflict (default) |
| `'firstWins'` | Only keep the canonical (first-seen) entity's properties; new properties from later mentions are ignored |

---

## Error Handling

`entity-resolve` is designed to handle edge cases gracefully without throwing:

- **Empty input** -- `resolve([])` returns a valid `ResolutionResult` with empty arrays and zero-valued stats.
- **Single entity** -- `resolve([entity])` returns one canonical entity with no merges.
- **Incompatible types** -- Entities with different types (and no type hierarchy mapping) receive a similarity score of `0` and are classified as `'different'`.
- **Empty names** -- Similarity algorithms return `0.0` for empty string inputs.
- **Missing optional fields** -- All optional fields on `EntityMention` (`aliases`, `properties`, `source`) default to safe empty values internally.

---

## Advanced Usage

### Incremental Resolution

Use `createResolver()` to build a canonical entity set incrementally as new mentions arrive:

```typescript
import { createResolver } from 'entity-resolve';

const resolver = createResolver({
  autoMergeThreshold: 0.90,
  nameStrategy: 'longest',
});

// Process mentions one at a time
const mentions = [
  { name: 'Dr. Albert Einstein', type: 'person' },
  { name: 'Einstein', type: 'person' },
  { name: 'A. Einstein', type: 'person', properties: { field: 'physics' } },
  { name: 'Google', type: 'organization' },
];

for (const mention of mentions) {
  const { action, canonicalEntity } = resolver.addEntity(mention);
  console.log(`${mention.name}: ${action} -> ${canonicalEntity.name}`);
}

console.log(resolver.size); // 2 (Einstein group + Google)
```

### Custom Scoring Profiles

Tune weights for domain-specific resolution. For person names, phonetic matching is more useful; for organizations, exact match and abbreviation detection matter more:

```typescript
// Person-optimized profile
const personResult = resolve(personMentions, {
  methods: {
    exactMatch: { weight: 1.0 },
    jaroWinkler: { weight: 2.0 },
    levenshtein: { weight: 1.5 },
    dice: { weight: 1.0 },
    soundex: { weight: 1.5 },
    metaphone: { weight: 1.5 },
  },
});

// Organization-optimized profile
const orgResult = resolve(orgMentions, {
  methods: {
    exactMatch: { weight: 3.0 },
    jaroWinkler: { weight: 1.0 },
    levenshtein: { weight: 0.5 },
    dice: { weight: 0.5 },
    soundex: { weight: 0.0 },
    metaphone: { weight: 0.0 },
  },
});
```

### Alias-Driven Resolution

Provide aliases on entity mentions to improve matching for known equivalences:

```typescript
const result = resolve([
  { name: 'United States', type: 'location', aliases: ['USA', 'US', 'United States of America'] },
  { name: 'USA', type: 'location' },
  { name: 'U.S.', type: 'location' },
]);

console.log(result.entities.length); // 1
```

### Inspecting Match Details

The `matches` array in the resolution result provides full transparency into every evaluated pair:

```typescript
const result = resolve(entities);

for (const match of result.matches) {
  if (match.classification === 'possible') {
    console.log(
      `Review: "${match.entityA}" vs "${match.entityB}" ` +
      `(score: ${match.similarity.toFixed(3)})`,
      match.methodScores
    );
  }
}
```

### Scaling with Blocking

For large entity sets, blocking is essential. Without it, every pair is compared (O(n^2)). With blocking, only entities in the same block are compared:

```typescript
// 10,000 entities -- use blocking to avoid 50M comparisons
const result = resolve(largeEntitySet, {
  blocking: ['prefix', 'phonetic', 'type'],
});

console.log(result.stats.candidatePairs); // Much less than n*(n-1)/2
```

---

## TypeScript

`entity-resolve` is written in TypeScript and ships with declaration files and source maps. All types are exported from the package entry point:

```typescript
import { resolve, similarity, createResolver } from 'entity-resolve';
import type {
  EntityMention,
  CanonicalEntity,
  MatchPair,
  ResolutionResult,
  ResolutionStats,
  SimilarityResult,
  ResolverOptions,
  EntityResolver,
} from 'entity-resolve';
```

The package targets ES2022 and uses CommonJS module output.

---

## License

MIT
