# entity-resolve — Task Breakdown

All tasks derived from SPEC.md. Organized by implementation phase matching the spec's roadmap (Section 18).

---

## Phase 0: Project Scaffolding & Dev Environment

- [ ] **Install dev dependencies** — Add `typescript` (>=5.0), `vitest`, and `eslint` as devDependencies in `package.json`. Run `npm install` to generate `node_modules` and `package-lock.json`. | Status: not_done
- [ ] **Configure Vitest** — Create `vitest.config.ts` at the project root with appropriate settings (e.g., `include: ['src/__tests__/**/*.test.ts']`, TypeScript support). Ensure `npm run test` works with an empty test suite. | Status: not_done
- [ ] **Configure ESLint** — Create `.eslintrc` or `eslint.config.js` with TypeScript-aware rules. Ensure `npm run lint` runs cleanly against the empty `src/` directory. | Status: not_done
- [ ] **Add .gitignore** — Ensure `node_modules/`, `dist/`, and any other generated artifacts are gitignored. | Status: not_done
- [ ] **Create directory structure** — Create all subdirectories specified in the file structure (Section 17): `src/similarity/`, `src/blocking/`, `src/pipeline/`, `src/merge/`, `src/__tests__/similarity/`, `src/__tests__/blocking/`, `src/__tests__/pipeline/`, `src/__tests__/merge/`, `src/__tests__/incremental/`, `src/__tests__/fixtures/`. | Status: not_done
- [ ] **Verify build pipeline** — Run `npm run build` (tsc) and confirm it compiles without errors and produces output in `dist/`. | Status: not_done

---

## Phase 1: Type Definitions & Error Classes

- [ ] **Define EntityMention interface** — Create `src/types.ts`. Define `EntityMention` with fields: `name: string`, `type: string`, `aliases?: string[]`, `properties?: Record<string, unknown>`, `source?: string`. | Status: not_done
- [ ] **Define CanonicalEntity interface** — In `src/types.ts`, define `CanonicalEntity` with fields: `name: string`, `type: string`, `aliases: string[]`, `properties: Record<string, unknown>`, `mentions: EntityMention[]`, `mentionCount: number`. | Status: not_done
- [ ] **Define MatchPair interface** — In `src/types.ts`, define `MatchPair` with fields: `entityA: string`, `entityB: string`, `similarity: number`, `classification: 'same' | 'possible' | 'different'`, `methodScores: Record<string, number>`. | Status: not_done
- [ ] **Define ResolutionResult interface** — In `src/types.ts`, define `ResolutionResult` with fields: `entities: CanonicalEntity[]`, `matches: MatchPair[]`, `unresolved: EntityMention[]`, `mergeMap: Record<string, string>`, `stats: ResolutionStats`. | Status: not_done
- [ ] **Define ResolutionStats interface** — In `src/types.ts`, define `ResolutionStats` with fields: `totalMentions: number`, `canonicalEntities: number`, `mentionsMerged: number`, `candidatePairs: number`, `sameCount: number`, `possibleCount: number`, `durationMs: number`. | Status: not_done
- [ ] **Define IncrementalResult interface** — In `src/types.ts`, define `IncrementalResult` with fields: `match: { name: string; similarity: number; classification: 'same' | 'possible' } | null`, `entity: EntityMention`. | Status: not_done
- [ ] **Define AddEntityResult interface** — In `src/types.ts`, define `AddEntityResult` with fields: `action: 'merged' | 'added'`, `canonicalEntity: CanonicalEntity`, `similarity: number`. | Status: not_done
- [ ] **Define SimilarityResult interface** — In `src/types.ts`, define `SimilarityResult` with fields: `score: number`, `methodScores: Record<string, number>`, `typesCompatible: boolean`. | Status: not_done
- [ ] **Define ResolverOptions interface** — In `src/types.ts`, define `ResolverOptions` with all configurable fields: `autoMergeThreshold`, `reviewThreshold`, `methods`, `blocking`, `prefixLength`, `nameStrategy`, `propertyMerge`, `aliases`, `typeHierarchy`, `transitiveReview`, `embedder`. All fields optional with documented defaults. | Status: not_done
- [ ] **Define MethodOptions and MethodConfig interfaces** — In `src/types.ts`, define `MethodOptions` (`weight?: number`, `enabled?: boolean`) and `MethodConfig` with keys for each method (`exactMatch`, `jaroWinkler`, `levenshtein`, `dice`, `soundex`, `metaphone`, `abbreviation`, `embedding`). The `embedding` key extends `MethodOptions` with an optional `embedder` field. | Status: not_done
- [ ] **Define BlockingStrategyName, BlockingFunction, NameStrategyFunction, PropertyMergeFunction types** — In `src/types.ts`, define: `BlockingStrategyName = 'prefix' | 'phonetic' | 'ngram' | 'type'`, `BlockingFunction = (entity: EntityMention) => string[]`, `NameStrategyFunction = (names: string[]) => string`, `PropertyMergeFunction = (propertiesArray: Array<Record<string, unknown>>) => Record<string, unknown>`. | Status: not_done
- [ ] **Define ResolverConfig interface** — In `src/types.ts`, define `ResolverConfig extends ResolverOptions` (currently identical per spec). | Status: not_done
- [ ] **Define EntityResolver interface** — In `src/types.ts`, define the `EntityResolver` interface with methods: `resolve(entities: EntityMention[]): ResolutionResult`, `addEntity(entity: EntityMention): AddEntityResult`, `similarity(entityA: EntityMention, entityB: EntityMention): SimilarityResult`, `getEntities(): CanonicalEntity[]`, `getEntity(name: string): CanonicalEntity | undefined`, `readonly size: number`, `reset(): void`. | Status: not_done
- [ ] **Implement ResolveError base class** — Create `src/errors.ts`. Implement `ResolveError extends Error` with a `readonly code: string` property. | Status: not_done
- [ ] **Implement ResolveConfigError class** — In `src/errors.ts`, implement `ResolveConfigError extends ResolveError` with `code = 'RESOLVE_CONFIG_ERROR'`. | Status: not_done
- [ ] **Implement ResolveEmbeddingError class** — In `src/errors.ts`, implement `ResolveEmbeddingError extends ResolveError` with `code = 'RESOLVE_EMBEDDING_ERROR'`. | Status: not_done
- [ ] **Export all types from src/index.ts** — Update `src/index.ts` to re-export all public types and error classes from `types.ts` and `errors.ts`. | Status: not_done

---

## Phase 2: Text Normalization (Pipeline Stage 1)

- [ ] **Implement Unicode NFC normalization** — In `src/pipeline/normalize.ts`, implement a `normalize(name: string): string` function. First step: apply `String.prototype.normalize('NFC')` to handle composed vs decomposed characters. | Status: not_done
- [ ] **Implement whitespace trimming and collapsing** — In the normalize function, strip leading/trailing whitespace and replace all sequences of whitespace (spaces, tabs, newlines) with a single space. | Status: not_done
- [ ] **Implement honorific and title stripping** — In the normalize function, remove common prefixes from the beginning of names: "Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Professor", "Sir", "Lady", "Rev.", "Reverend", "Hon.", "Honorable". Preserve the original form in aliases. Case-insensitive matching. | Status: not_done
- [ ] **Implement corporate suffix stripping** — In the normalize function, remove common organizational suffixes from the end of names: "Inc.", "Inc", "Corp.", "Corp", "Ltd.", "Ltd", "LLC", "L.L.C.", "Co.", "Company", "& Co.", "PLC", "GmbH", "AG", "S.A.", "N.V.". Preserve the original form in aliases. | Status: not_done
- [ ] **Implement punctuation normalization** — In the normalize function, remove periods from abbreviations ("U.S." -> "US"), normalize hyphens and dashes to standard hyphen, remove possessive suffixes ("Einstein's" -> "Einstein"). | Status: not_done
- [ ] **Implement case normalization** — In the normalize function, produce a lowercased comparison form while preserving the original casing as the display form. Return both forms (e.g., as a `NormalizedEntity` internal type with `original`, `normalized`, and `display` fields). | Status: not_done
- [ ] **Implement normalizeEntity function** — Create a higher-level `normalizeEntity(entity: EntityMention)` function that normalizes the entity's name and all aliases, producing internal normalized forms used throughout the pipeline. The original `EntityMention` is never mutated. | Status: not_done
- [ ] **Write normalization unit tests** — Create `src/__tests__/pipeline/normalize.test.ts`. Test cases from spec: mixed case, extra whitespace, honorific stripping ("Dr. John Smith" -> "John Smith"), corporate suffix stripping ("Apple Inc." -> "Apple"), punctuation normalization ("U.S.A." -> "USA"), possessive stripping ("Einstein's" -> "Einstein"), Unicode normalization. Verify idempotence (normalizing an already-normalized string produces the same result). | Status: not_done

---

## Phase 3: Similarity Methods

### 3a: Exact Match

- [ ] **Implement exact match similarity** — In `src/similarity/` (either in `index.ts` or a dedicated file), implement exact match after normalization. Compare normalized (lowercased, trimmed) names. Also check all aliases: if any alias of entity A matches the name or any alias of entity B (after normalization), score is 1.0. Otherwise 0.0. | Status: not_done

### 3b: Jaro-Winkler Distance

- [ ] **Implement Jaro similarity** — In `src/similarity/jaro-winkler.ts`, implement the Jaro similarity formula: `jaro(s1, s2) = (matches/len1 + matches/len2 + (matches - transpositions/2)/matches) / 3`. Matching window is `floor(max(len1, len2) / 2) - 1`. | Status: not_done
- [ ] **Implement Winkler prefix bonus** — In `src/similarity/jaro-winkler.ts`, apply the Winkler enhancement: `winkler = jaro + prefixLength * 0.1 * (1 - jaro)` where `prefixLength` is the common prefix length (max 4). | Status: not_done
- [ ] **Handle Jaro-Winkler edge cases** — Handle empty strings (return 0.0 or 1.0 for two empty strings), identical strings (return 1.0), single-character strings. | Status: not_done
- [ ] **Write Jaro-Winkler unit tests** — Create `src/__tests__/similarity/jaro-winkler.test.ts`. Test cases from spec: "MARTHA" vs "MARHTA" (~0.944), "DWAYNE" vs "DUANE" (~0.840). Identical strings produce 1.0. Completely different strings produce low score. Empty strings handled gracefully. | Status: not_done

### 3c: Levenshtein Edit Distance

- [ ] **Implement Levenshtein edit distance** — In `src/similarity/levenshtein.ts`, implement the edit distance using row-optimized dynamic programming (two-row approach for O(min(m,n)) space). Compute minimum edits (insert, delete, substitute). | Status: not_done
- [ ] **Convert edit distance to similarity score** — Normalize: `similarity = 1 - (editDistance / max(len1, len2))`. Handle edge case where both strings are empty (similarity = 1.0). | Status: not_done
- [ ] **Write Levenshtein unit tests** — Create `src/__tests__/similarity/levenshtein.test.ts`. Test cases from spec: "kitten" vs "sitting" (distance 3, similarity ~0.571). Identical strings produce distance 0 (similarity 1.0). Empty vs non-empty string. | Status: not_done

### 3d: Sorensen-Dice Coefficient

- [ ] **Implement bigram extraction** — In `src/similarity/dice.ts`, implement a function to extract the multiset of consecutive character pairs (bigrams) from a lowercased string. | Status: not_done
- [ ] **Implement Dice coefficient computation** — Compute `dice = 2 * |intersection of bigrams| / (|bigrams(s1)| + |bigrams(s2)|)`. Handle single-character or empty strings (return 0.0). | Status: not_done
- [ ] **Write Dice coefficient unit tests** — Create `src/__tests__/similarity/dice.test.ts`. Test cases from spec: "night" vs "nacht" (~0.25). Identical strings produce 1.0. Single-character strings (no bigrams). | Status: not_done

### 3e: Soundex Phonetic Matching

- [ ] **Implement Soundex encoding** — In `src/similarity/soundex.ts`, implement Soundex: retain first letter, map consonants to digits (B/F/P/V->1, C/G/J/K/Q/S/X/Z->2, D/T->3, L->4, M/N->5, R->6), drop vowels and H/W/Y (except initial letter), remove consecutive duplicate digits, pad/truncate to 4 characters. | Status: not_done
- [ ] **Implement Soundex similarity scoring** — Score is 1.0 if Soundex codes match, 0.0 otherwise. | Status: not_done
- [ ] **Write Soundex unit tests** — Create `src/__tests__/similarity/soundex.test.ts`. Test cases from spec: "Robert" -> R163, "Rupert" -> R163 (match). "Smith" -> S530, "Smyth" -> S530 (match). "Ashcraft" -> A261. "Pfister" -> P236. | Status: not_done

### 3f: Metaphone Phonetic Matching

- [ ] **Implement Metaphone encoding** — In `src/similarity/metaphone.ts`, implement Metaphone algorithm handling: silent letters, digraphs (CH, SH, TH, PH), vowel pronunciation rules, and English pronunciation patterns. Produces variable-length phonetic codes. | Status: not_done
- [ ] **Implement Metaphone similarity scoring** — Compare two Metaphone codes using Jaro-Winkler similarity (not binary match) for a more nuanced phonetic similarity measure. | Status: not_done
- [ ] **Write Metaphone unit tests** — Create `src/__tests__/similarity/metaphone.test.ts`. Verify encoding for known names. Verify that Metaphone distinguishes names that Soundex conflates (e.g., "Smith" vs "Schmidt"). Verify matching cases (e.g., "Steven" and "Stephen"). | Status: not_done

### 3g: Abbreviation Matching

- [ ] **Implement initials acronym detection** — In `src/similarity/abbreviation.ts`, detect if an all-uppercase name (e.g., "IBM") matches the initial letters of a multi-word name (e.g., "International Business Machines"). Ignore stop words ("of", "the", "and", "for", "in") when computing initials. Score 1.0 if match, 0.0 otherwise. | Status: not_done
- [ ] **Implement dotted initials detection** — Detect if a name like "J.F.K." or "J. F. Kennedy" matches "John Fitzgerald Kennedy". Strip dots and spaces from the short form, compare resulting characters against initials of the long form. | Status: not_done
- [ ] **Implement alias dictionary lookup for abbreviations** — Check if two names appear as a known pair in the configured alias dictionary. Score 1.0 if found, 0.0 otherwise. | Status: not_done
- [ ] **Implement abbreviation applicability check** — Determine whether abbreviation matching is "applicable" for a given pair (one name is all uppercase, or significantly shorter than the other). When not applicable, the method should be excluded from composite scoring rather than contributing 0.0. | Status: not_done
- [ ] **Write abbreviation matching unit tests** — Create `src/__tests__/similarity/abbreviation.test.ts`. Test cases from spec: "IBM" vs "International Business Machines" (match), "NASA" vs "National Aeronautics and Space Administration" (match), "J.F.K." vs "John Fitzgerald Kennedy" (match), "UN" vs "United Nations" (match), "ABC" vs "Already Been Chewed" (match), "ABC" vs "Alphabet" (no match). Test false positive avoidance. | Status: not_done

### 3h: Embedding Similarity

- [ ] **Implement cosine similarity** — In `src/similarity/cosine.ts`, implement cosine similarity: `dot(a,b) / (||a|| * ||b||)`. For L2-normalized vectors, this reduces to the dot product. Handle zero-vector edge case. | Status: not_done
- [ ] **Implement embedding similarity wrapper** — In `src/similarity/embedding.ts`, implement a function that calls the caller-provided `embedder` function for both entity names and computes cosine similarity on the resulting vectors. Handle embedder errors by throwing `ResolveEmbeddingError`. | Status: not_done
- [ ] **Write cosine similarity unit tests** — Create test for cosine similarity with known vectors: identical vectors (1.0), orthogonal vectors (0.0), opposite vectors (-1.0). | Status: not_done
- [ ] **Write embedding similarity unit tests** — Create `src/__tests__/similarity/embedding.test.ts`. Use a mock embedder. Test normal operation, embedder that throws, embedder that returns wrong dimensions. | Status: not_done

### 3i: Composite Scoring

- [ ] **Implement composite similarity scorer** — In `src/similarity/index.ts`, implement the composite scoring function: `compositeScore = sum(weight_i * score_i) / sum(weight_i)` for all applicable methods. Methods that are not applicable are excluded from both numerator and denominator. | Status: not_done
- [ ] **Implement method applicability logic** — Determine which methods are applicable for a given pair. Abbreviation matching only when one name is a potential abbreviation. Embedding only when embedder is configured. Exact match, Jaro-Winkler, Levenshtein, Dice, Soundex, Metaphone are always applicable. | Status: not_done
- [ ] **Apply default weights** — Implement default weights per spec: exactMatch=1.0, jaroWinkler=0.30, abbreviation=0.20, levenshtein=0.15, dice=0.15, embedding=0.10, soundex=0.05, metaphone=0.05. Allow caller overrides. Setting weight to 0 disables the method. | Status: not_done
- [ ] **Implement the public similarity() function** — Create the top-level `similarity(entityA, entityB, options?)` function that computes composite similarity between two entity mentions. Returns `SimilarityResult` with `score`, `methodScores`, and `typesCompatible`. | Status: not_done
- [ ] **Write composite scoring unit tests** — Create `src/__tests__/similarity/composite.test.ts`. Test correct weighting of individual method scores. Test that inapplicable methods are excluded from the average. Test with all methods enabled, with only some methods enabled, and with custom weights. | Status: not_done

---

## Phase 4: Entity Type System

- [ ] **Implement default type hierarchy** — Create type hierarchy data structure (in `src/blocking/type.ts` or a shared location). Default hierarchy per spec: Organization > Company/Government/Non-Profit/Institution; Location > City/Country/Region/Landmark; Person (no subtypes). | Status: not_done
- [ ] **Implement type compatibility check** — Implement `areTypesCompatible(typeA: string, typeB: string, hierarchy?)` function. Two types are compatible if: same type, one is subtype of the other, or either is "Concept" or "Unknown" (catch-all). | Status: not_done
- [ ] **Support custom type hierarchies** — Allow callers to provide a custom `typeHierarchy: Record<string, string[]>` that overrides or extends the default hierarchy. | Status: not_done
- [ ] **Write type system unit tests** — Test same type (compatible), parent-child types (compatible), unrelated types (incompatible), Concept/Unknown catch-all types, custom hierarchies. | Status: not_done

---

## Phase 5: Blocking Strategies (Pipeline Stage 2)

### 5a: Prefix Blocking

- [ ] **Implement prefix blocking** — In `src/blocking/prefix.ts`, compute blocking key from the first N characters (default N=3) of the normalized, lowercased name. Also compute keys from each alias's prefix. Return all blocking keys for an entity. | Status: not_done
- [ ] **Support configurable prefix length** — Accept `prefixLength` option (default 3). Must be a positive integer. | Status: not_done
- [ ] **Write prefix blocking unit tests** — Create `src/__tests__/blocking/prefix.test.ts`. Verify correct block keys. Verify that entities sharing a prefix are in the same block. Verify that entities differing in prefix are not. Test alias-based prefix blocking. | Status: not_done

### 5b: Type Blocking

- [ ] **Implement type blocking** — In `src/blocking/type.ts`, block entities by type. Only entities of compatible types (per the type hierarchy) share a block. Intersection with other blocking strategies: final candidate set = type block intersection with other blocks. | Status: not_done
- [ ] **Write type blocking unit tests** — Create `src/__tests__/blocking/type.test.ts`. Test same type (same block), parent-child types (same block), unrelated types (different blocks), Concept/Unknown catch-all. | Status: not_done

### 5c: Phonetic Blocking

- [ ] **Implement phonetic blocking** — In `src/blocking/phonetic.ts`, compute Soundex or Metaphone code for the first word of the entity name. Use the code as the blocking key. | Status: not_done
- [ ] **Write phonetic blocking unit tests** — Create `src/__tests__/blocking/phonetic.test.ts`. Test phonetic variants in the same block (e.g., "Catherine" and "Katherine"). | Status: not_done

### 5d: N-gram Blocking

- [ ] **Implement n-gram blocking** — In `src/blocking/ngram.ts`, extract all character n-grams (default: trigrams) from the normalized name. Use each n-gram as a blocking key. Two entities sharing any n-gram are candidates. | Status: not_done
- [ ] **Implement n-gram frequency filtering** — Exclude n-grams that appear in more than a threshold fraction (default 10%) of all entity names to prevent overly large blocks. | Status: not_done
- [ ] **Write n-gram blocking unit tests** — Create `src/__tests__/blocking/ngram.test.ts`. Verify correct n-gram extraction. Test frequency filtering. Test that entities sharing n-grams are in the same block. | Status: not_done

### 5e: Blocking Orchestrator

- [ ] **Implement blocking orchestrator** — In `src/blocking/index.ts`, apply all configured blocking strategies and generate the union of candidate pairs. Accept an array of strategy names and/or custom blocking functions. Apply alias overlap as an additional candidate source (if any alias of entity A exactly matches a name/alias of entity B, they are candidates regardless of other blocking). | Status: not_done
- [ ] **Support custom blocking functions** — Accept `BlockingFunction = (entity: EntityMention) => string[]` in the blocking configuration. Custom functions produce additional blocking keys alongside built-in strategies. | Status: not_done
- [ ] **Generate deduplicated candidate pairs** — Ensure the output set of candidate pairs `(mentionA, mentionB)` is deduplicated (no duplicate pairs in either order). | Status: not_done

---

## Phase 6: Match Classification (Pipeline Stage 4)

- [ ] **Implement match classification** — In `src/pipeline/classify.ts`, classify each scored pair based on composite score and thresholds: "same" (>= autoMergeThreshold, default 0.85), "possible" (>= reviewThreshold, default 0.65, and < autoMergeThreshold), "different" (< reviewThreshold). | Status: not_done
- [ ] **Write classification unit tests** — Create `src/__tests__/pipeline/classify.test.ts`. Test boundary cases at exactly the threshold values. Test with custom thresholds. Test the default thresholds. | Status: not_done

---

## Phase 7: Transitive Closure (Pipeline Stage 5)

- [ ] **Implement Union-Find data structure** — In `src/pipeline/transitive.ts`, implement Union-Find (disjoint set) with path compression and union by rank. Operations: `makeSet(element)`, `find(element)`, `union(a, b)`, `getComponents()`. | Status: not_done
- [ ] **Implement transitive closure for "same" pairs** — Apply union on all "same" classified pairs. After processing, each connected component represents one real-world entity. | Status: not_done
- [ ] **Support transitiveReview option** — When `transitiveReview: true`, also apply transitive closure to "possible" pairs (in addition to "same" pairs). Default is false. | Status: not_done
- [ ] **Write transitive closure unit tests** — Create `src/__tests__/pipeline/transitive.test.ts`. Test cases from spec: A=B, B=C -> {A,B,C}. A=B, C=D -> {A,B}, {C,D}. A=B, B=C, C=D -> {A,B,C,D}. Single element -> {A}. Verify "possible" pairs are not closed by default. Verify "possible" pairs are closed when transitiveReview=true. | Status: not_done

---

## Phase 8: Merge Strategies (Pipeline Stage 6)

### 8a: Canonical Name Selection

- [ ] **Implement "longest" name strategy** — In `src/merge/name-selection.ts`, select the longest name among the group members as the canonical name. This is the default. | Status: not_done
- [ ] **Implement "most-frequent" name strategy** — Select the name that appears most often across mentions in the group. | Status: not_done
- [ ] **Implement "first-seen" name strategy** — Select the name from the first mention in source order (array index order). | Status: not_done
- [ ] **Support custom name strategy function** — Accept a `NameStrategyFunction = (names: string[]) => string` for domain-specific logic. | Status: not_done
- [ ] **Write name selection unit tests** — Create `src/__tests__/merge/name-selection.test.ts`. Test each strategy with various name groups. | Status: not_done

### 8b: Alias Collection

- [ ] **Implement alias consolidation** — In `src/merge/alias-collection.ts`, gather all names and aliases from all mentions in a group into a single deduplicated set. Remove the canonical name from the alias set. Deduplicate after normalization (case-insensitive comparison) but preserve original casing. Sort aliases alphabetically. | Status: not_done
- [ ] **Write alias collection unit tests** — Create `src/__tests__/merge/alias-collection.test.ts`. Test with the spec example: mentions "Albert Einstein" (aliases: ["Einstein"]), "A. Einstein" (no aliases), "Professor Einstein" (aliases: ["Einstein"]). Verify canonical name excluded, aliases deduplicated, sorted. | Status: not_done

### 8c: Property Merging

- [ ] **Implement "union" property merge strategy** — In `src/merge/property-merge.ts`, combine all properties. Conflicts resolved by keeping the value from the mention with the longest name. This is the default. | Status: not_done
- [ ] **Implement "first-wins" property merge strategy** — For each key, the first mention's value wins. | Status: not_done
- [ ] **Implement "most-recent" property merge strategy** — For each key, the value from the most recently sourced mention wins. Requires `source` metadata with ordering (fall back to array order if no source). | Status: not_done
- [ ] **Support custom property merge function** — Accept a `PropertyMergeFunction = (propertiesArray: Array<Record<string, unknown>>) => Record<string, unknown>`. | Status: not_done
- [ ] **Write property merge unit tests** — Create `src/__tests__/merge/property-merge.test.ts`. Test each strategy. Test conflict resolution. Test with empty properties. | Status: not_done

### 8d: Entity Merge Orchestrator

- [ ] **Implement merge orchestrator** — In `src/merge/index.ts`, for each connected component from transitive closure: select canonical name, collect aliases, merge properties, record original mentions, set mention count. Produce `CanonicalEntity` objects. | Status: not_done
- [ ] **Build mergeMap** — Construct `Record<string, string>` mapping each original mention name to its canonical entity name. Include alias-to-canonical mappings. This map is used by callers (e.g., kg-extract) to update relationship references. | Status: not_done

---

## Phase 9: Batch Resolution Pipeline (resolve function)

- [ ] **Implement resolve() function** — In `src/resolve.ts`, orchestrate all six pipeline stages in sequence: (1) normalize, (2) block/generate candidates, (3) score pairwise similarity, (4) classify matches, (5) transitive closure, (6) merge. Return `ResolutionResult`. | Status: not_done
- [ ] **Compute and return ResolutionStats** — Populate stats: `totalMentions`, `canonicalEntities`, `mentionsMerged`, `candidatePairs`, `sameCount`, `possibleCount`, `durationMs` (wall-clock time). | Status: not_done
- [ ] **Populate unresolved field** — Identify entity mentions that were not matched to any other mention (singletons). Include them in `ResolutionResult.unresolved` and also as single-mention `CanonicalEntity` objects in `entities`. | Status: not_done
- [ ] **Populate matches field** — Include all match pairs with scores above the review threshold in `ResolutionResult.matches`. Pairs below the review threshold are classified as "different" and discarded (not included in the result). | Status: not_done
- [ ] **Export resolve() from src/index.ts** — Wire up the public API export. | Status: not_done
- [ ] **Write full pipeline integration tests** — Create `src/__tests__/resolve.test.ts`. Test with person names, organization names, mixed types. Test with abbreviations, phonetic variants, and typos. Verify correct canonical entities, correct alias sets, correct merge map, correct match pairs, correct stats. | Status: not_done

---

## Phase 10: Incremental Resolution

- [ ] **Implement resolveIncremental() function** — In `src/resolve-incremental.ts`, match a single new entity mention against an existing set of canonical entities. Use blocking to generate candidates from existing entities, score each, classify, and return the best match (or null if no match). Return `IncrementalResult`. | Status: not_done
- [ ] **Export resolveIncremental() from src/index.ts** — Wire up the public API export. | Status: not_done
- [ ] **Write incremental resolution unit tests** — Test matching a known entity (returns match), a new entity (returns null). Test with various similarity levels. Test that type blocking prevents cross-type matches. | Status: not_done

---

## Phase 11: Stateful Resolver (EntityResolver class)

- [ ] **Implement createResolver() factory function** — In `src/resolver.ts`, implement `createResolver(config: ResolverConfig): EntityResolver`. Parse and validate config at creation time. Store config for reuse. | Status: not_done
- [ ] **Implement EntityResolver.resolve()** — Delegate to the batch `resolve()` function with the resolver's stored config. Store resulting canonical entities internally for incremental use. Support per-call overrides merged with factory-level config. | Status: not_done
- [ ] **Implement EntityResolver.addEntity()** — Match the new entity against the resolver's internal canonical entities. If matched, merge into the existing canonical entity. If not, add as a new canonical entity. Return `AddEntityResult`. | Status: not_done
- [ ] **Implement EntityResolver.similarity()** — Compute pairwise similarity using the resolver's stored config. | Status: not_done
- [ ] **Implement EntityResolver.getEntities()** — Return all canonical entities currently stored in the resolver. | Status: not_done
- [ ] **Implement EntityResolver.getEntity(name)** — Look up a single canonical entity by name. Return undefined if not found. | Status: not_done
- [ ] **Implement EntityResolver.size** — Readonly property returning the number of canonical entities. | Status: not_done
- [ ] **Implement EntityResolver.reset()** — Clear all stored canonical entities. | Status: not_done
- [ ] **Export createResolver() from src/index.ts** — Wire up the public API export. | Status: not_done
- [ ] **Write stateful resolver unit tests** — Test batch resolution, incremental addition, similarity, getEntities, getEntity, size, reset. Test config precedence (per-call > factory > defaults). | Status: not_done
- [ ] **Write incremental addEntity tests** — Create `src/__tests__/incremental/add-entity.test.ts`. Test entity being merged into existing, test new entity being added, test sequence of additions. | Status: not_done

---

## Phase 12: Configuration Validation

- [ ] **Validate autoMergeThreshold** — Must be a number between 0.0 and 1.0. Throw `ResolveConfigError` if not. | Status: not_done
- [ ] **Validate reviewThreshold** — Must be a number between 0.0 and 1.0. Must satisfy `reviewThreshold <= autoMergeThreshold`. Throw `ResolveConfigError` if not. | Status: not_done
- [ ] **Validate method weights** — Must be non-negative numbers. Throw `ResolveConfigError` if negative. | Status: not_done
- [ ] **Validate blocking config** — Must be an array of valid strategy names (`'prefix' | 'phonetic' | 'ngram' | 'type'`) or functions. Throw `ResolveConfigError` for invalid entries. | Status: not_done
- [ ] **Validate prefixLength** — Must be a positive integer. Throw `ResolveConfigError` if not. | Status: not_done
- [ ] **Validate nameStrategy** — Must be a valid strategy name (`'longest' | 'most-frequent' | 'first-seen'`) or a function. Throw `ResolveConfigError` if not. | Status: not_done
- [ ] **Validate aliases dictionary** — If provided, must be an object with string keys and string values. Throw `ResolveConfigError` if malformed. | Status: not_done
- [ ] **Validate embedder** — If provided, must be a function. Throw `ResolveConfigError` if not. | Status: not_done
- [ ] **Write configuration validation tests** — Test each validation rule. Test valid configs pass. Test each invalid case throws `ResolveConfigError` with the correct code. | Status: not_done

---

## Phase 13: Alias Dictionaries

- [ ] **Implement alias dictionary integration** — When an alias dictionary is provided via `options.aliases`, use it in abbreviation matching (known alias lookup) and in blocking (alias overlap). A pair is treated as a known match if one name maps to the other via the dictionary. Bidirectional: if "Bob" -> "Robert" is in the dictionary, "Robert" -> "Bob" should also match. | Status: not_done
- [ ] **Write alias dictionary tests** — Test that known aliases produce high similarity. Test bidirectional lookup. Test with the spec examples: "Bob"/"Robert", "NYC"/"New York City", "US"/"United States". | Status: not_done

---

## Phase 14: Test Fixtures

- [ ] **Create test entity fixtures** — Create `src/__tests__/fixtures/entities.ts`. Define a comprehensive set of test `EntityMention` objects with known duplicate and unique relationships. Include person names, organization names with abbreviations, location names, mixed types, phonetic variants, typos, and aliases. | Status: not_done
- [ ] **Create mock embedder** — Create `src/__tests__/fixtures/mock-embedder.ts`. Implement a mock embedder returning predetermined vectors from a lookup table keyed by entity name. For names not in the lookup table, generate a random vector with a fixed seed derived from a content hash for reproducibility. | Status: not_done

---

## Phase 15: Edge Case Handling & Hardening

- [ ] **Handle empty entity list** — `resolve([])` should return an empty `ResolutionResult` with zero entities, zero matches, zero unresolved, empty mergeMap, and stats reflecting zero input. | Status: not_done
- [ ] **Handle single entity** — `resolve([singleEntity])` should return that entity as a single canonical entity with no matches and no unresolved. | Status: not_done
- [ ] **Handle all entities identical** — All mentions with the same normalized name should merge into one canonical entity. | Status: not_done
- [ ] **Handle all entities different** — All mentions with distinct names and no similarity should each become a separate canonical entity. | Status: not_done
- [ ] **Handle entity with empty name** — Decide behavior (reject with error, or handle gracefully). Document and test. | Status: not_done
- [ ] **Handle entity with very long name** — Test with 1000+ character names. Ensure no performance degradation or crashes. | Status: not_done
- [ ] **Handle entity with no type** — Define default behavior when `type` is empty or missing. Test. | Status: not_done
- [ ] **Handle entities with conflicting types but same name** — Type blocking should keep them separate (e.g., "Apple" Organization vs "Apple" Food). Verify. | Status: not_done
- [ ] **Handle embedder that throws an error** — Wrap embedder calls in try/catch. Throw `ResolveEmbeddingError` with context. Test that the error propagates correctly. | Status: not_done
- [ ] **Handle embedder that returns wrong dimensions** — If vector A and vector B have different lengths, handle gracefully (throw `ResolveEmbeddingError` or skip embedding method for that pair). Test. | Status: not_done
- [ ] **Write edge case test suite** — Consolidate all edge case tests. Ensure each scenario is covered. | Status: not_done

---

## Phase 16: Integration Testing

- [ ] **Write kg-extract compatibility integration test** — Create entity lists in the format `kg-extract` produces. Run through `entity-resolve`. Verify that `mergeMap` and `entities` fields conform to `kg-extract`'s `EntityResolutionResult` interface. Verify relationship reference updating via mergeMap. | Status: not_done
- [ ] **Write full lifecycle integration test: person names** — Test with a realistic set of person name variations: "Albert Einstein", "Einstein", "A. Einstein", "Professor Einstein", "Prof. Einstein". Verify single canonical entity with correct aliases. | Status: not_done
- [ ] **Write full lifecycle integration test: organization names** — Test with organization variations: "International Business Machines", "IBM", "IBM Corp.", "IBM Corporation". Verify abbreviation matching triggers. | Status: not_done
- [ ] **Write full lifecycle integration test: mixed types** — Test with entities of different types sharing names (e.g., "Apple" Org vs "Apple" Food, "Paris" Location vs "Paris" Person). Verify type blocking prevents cross-type merges. | Status: not_done
- [ ] **Write incremental resolution integration test** — Build a set of canonical entities via `resolve()`. Then add new mentions one at a time via `resolveIncremental()`. Verify matches found when expected, new entities created when expected. | Status: not_done
- [ ] **Write stateful resolver integration test** — Use `createResolver()`. Call `resolve()` for a batch. Then call `addEntity()` multiple times. Verify `getEntities()`, `getEntity()`, `size` reflect the correct state throughout. | Status: not_done

---

## Phase 17: Performance & Benchmarking

- [ ] **Benchmark blocking effectiveness** — Measure candidate pair reduction for entity sets of 100, 1000, and 10000 entities with prefix+type blocking. Compare against no-blocking (all pairs). Verify blocking reduces pairs by 90%+. | Status: not_done
- [ ] **Benchmark end-to-end resolution time** — Measure wall-clock time for resolution of 100, 1000, and 10000 entities with string-only methods. Verify times are within the spec targets (< 60ms for 100, < 600ms for 1000, < 6s for 10000). | Status: not_done
- [ ] **Benchmark individual similarity methods** — Measure per-pair cost for each similarity method. Verify sub-millisecond for all string methods. | Status: not_done
- [ ] **Document performance benchmarks** — Record benchmark results for inclusion in README. | Status: not_done

---

## Phase 18: Documentation

- [ ] **Create README.md** — Write comprehensive README with: package description, installation, quick start example, API reference for `resolve()`, `resolveIncremental()`, `similarity()`, and `createResolver()`. Include all type definitions. Include integration examples with kg-extract, memory-dedup, and embed-cache. | Status: not_done
- [ ] **Document all configuration options** — In README, create a table of all options with types, defaults, and descriptions (mirroring spec Section 12). | Status: not_done
- [ ] **Document similarity methods** — In README, describe each of the 8 similarity methods with their strengths, weaknesses, and default weights. | Status: not_done
- [ ] **Document blocking strategies** — In README, describe each of the 4+custom blocking strategies with guidance on when to use each. | Status: not_done
- [ ] **Document merge strategies** — In README, describe canonical name selection, alias collection, and property merging strategies. | Status: not_done
- [ ] **Document confidence thresholds** — In README, include the recommended thresholds table from the spec for different use cases (conservative, standard, aggressive, fully automatic). | Status: not_done
- [ ] **Add JSDoc comments to all public APIs** — Ensure `resolve()`, `resolveIncremental()`, `similarity()`, `createResolver()`, and all exported types/interfaces have JSDoc comments. | Status: not_done
- [ ] **Add inline code comments** — Add explanatory comments in complex algorithm implementations (Jaro-Winkler, Metaphone, Union-Find). | Status: not_done

---

## Phase 19: CI/CD & Publishing

- [ ] **Verify build succeeds** — Run `npm run build` and confirm TypeScript compilation produces correct output in `dist/` with declaration files. | Status: not_done
- [ ] **Verify all tests pass** — Run `npm run test` and confirm all unit, integration, and edge case tests pass. | Status: not_done
- [ ] **Verify lint passes** — Run `npm run lint` and confirm no lint errors. | Status: not_done
- [ ] **Verify package.json metadata** — Confirm `name`, `version`, `description`, `main`, `types`, `files`, `engines`, `license`, `publishConfig` are correct. | Status: not_done
- [ ] **Verify TypeScript declarations** — Confirm that `dist/index.d.ts` exports all public types correctly. Consumers should get full type information via `import { resolve, EntityMention, ... } from 'entity-resolve'`. | Status: not_done
- [ ] **Bump version for release** — Update version in `package.json` per semver (patch/minor/major as appropriate for the changes). | Status: not_done
- [ ] **Publish to npm** — Follow the monorepo workflow: merge PR, checkout master, pull, `npm publish`. | Status: not_done
