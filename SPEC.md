# entity-resolve -- Specification

## 1. Overview

`entity-resolve` is a multi-method entity resolution library that deduplicates and merges entity mentions across documents using string similarity, alias matching, and optional embedding-based semantic distance. It accepts a list of entity mentions -- names with types, aliases, and metadata extracted from one or more documents -- identifies which mentions refer to the same real-world entity, and merges them into canonical entities with consolidated aliases, properties, and relationships. The result is a deduplicated entity set where each real-world entity appears exactly once, regardless of how many surface forms it was mentioned under.

The gap this package fills is specific and well-defined. Entity resolution (also called entity matching, record linkage, or entity disambiguation) is a foundational problem in knowledge graph construction, data integration, and information extraction. The same real-world entity is routinely referred to by different names across documents: "Walt Disney", "Walter Elias Disney", "Disney", and "W. Disney" all denote the same person. "Apple" could be Apple Inc. or the fruit -- context and type information disambiguate. "Dr. Smith", "Doctor Smith", and "John Smith, MD" are the same individual. "IBM", "International Business Machines", and "Big Blue" are the same organization. Without entity resolution, a knowledge graph built from multiple documents contains fragmented nodes -- "Einstein" has the birth relationships while "Albert Einstein" has the Nobel Prize relationships, and no path connects birthplace to awards because they are attached to different nodes.

The existing ecosystem addresses adjacent problems but not this one. In Python, `dedupe` provides record linkage with active learning, `recordlinkage` provides probabilistic matching, spaCy offers entity linking to knowledge bases, and `thefuzz` (formerly `fuzzywuzzy`) provides fuzzy string matching. On npm, `string-similarity` computes Dice coefficient between strings, `fastest-levenshtein` computes edit distance, and `fuse.js` provides fuzzy search over collections. None of these packages perform full entity resolution: taking a set of entity mentions, computing multi-method similarity, applying blocking for scalability, classifying matches with confidence, performing transitive closure, and merging matched entities into canonical forms with consolidated aliases and properties. Each library provides one piece -- a similarity metric or a search algorithm -- but the orchestration of these pieces into an entity resolution pipeline is left to the developer. `entity-resolve` fills this gap by providing the complete pipeline.

`entity-resolve` provides a TypeScript/JavaScript API for programmatic use. The API centers on two patterns: a stateless `resolve(entities, options?)` function that takes a batch of entity mentions and returns a `ResolutionResult` containing canonical entities, match pairs, and unresolved mentions; and a stateful `createResolver(config)` factory that returns an `EntityResolver` instance supporting both batch resolution and incremental `addEntity()` calls. The resolver is designed to integrate directly with `kg-extract` as its `entityResolver` hook, with `memory-dedup` for entity-level deduplication in agent memory systems, and with `embed-cache` for caching entity name embeddings.

The package has zero mandatory runtime dependencies. All similarity algorithms (Jaro-Winkler, Levenshtein, Dice coefficient, Soundex, Metaphone), blocking strategies, transitive closure, merge logic, and composite scoring are implemented in pure TypeScript. Embedding-based similarity is optional and pluggable: callers provide an `(text: string) => Promise<number[]>` function that wraps any embedding API. When no embedder is provided, resolution uses string similarity methods only.

---

## 2. Goals and Non-Goals

### Goals

- Provide a `resolve(entities, options?)` function that takes an array of `EntityMention` objects, identifies which mentions refer to the same real-world entity using multi-method similarity scoring, and returns a `ResolutionResult` containing deduplicated canonical entities, match pairs with confidence scores, and unresolved mentions.
- Provide a `resolveIncremental(newEntity, existingEntities, options?)` function that matches a single new entity mention against an existing set of canonical entities, returning either a match (with the canonical entity to merge into) or a classification as a new entity.
- Provide a `similarity(entityA, entityB, options?)` function that computes a composite similarity score (0.0 to 1.0) between two entity mentions using configurable methods, for callers who need pairwise scoring without full resolution.
- Provide a `createResolver(config)` factory function that returns an `EntityResolver` instance pre-configured with similarity methods, blocking strategies, thresholds, and merge policies, avoiding repeated option parsing.
- Implement a six-stage resolution pipeline: normalization, blocking/candidate generation, pairwise similarity scoring, match classification, transitive closure, and entity merging.
- Implement eight similarity methods: exact match (after normalization), Jaro-Winkler distance, Levenshtein edit distance, Sorensen-Dice coefficient, Soundex phonetic matching, Metaphone phonetic matching, abbreviation matching, and embedding-based cosine similarity (pluggable).
- Support composite scoring: combine multiple similarity methods with configurable weights into a single score per entity pair. Default weights are tuned for general-purpose entity resolution; callers can override for domain-specific tuning.
- Implement four blocking strategies to reduce O(n^2) pairwise comparisons: prefix blocking, phonetic blocking, n-gram blocking, and type blocking. Custom blocking functions are also supported.
- Support type-aware resolution: entities of incompatible types (e.g., Person and Organization) are never matched, even if their names are similar. Type hierarchy is supported ("Company" is a subtype of "Organization").
- Support configurable alias dictionaries for known equivalences ("Bob" maps to "Robert", "NYC" maps to "New York City", "Dr." maps to "Doctor").
- Implement confidence-based match classification: high confidence (auto-merge), medium confidence (suggested match, flag for review), low confidence (keep separate), with configurable thresholds.
- Implement transitive closure: if entity A matches entity B and entity B matches entity C, then A, B, and C are all the same entity, even if A and C have low direct similarity.
- Implement configurable merge strategies: canonical name selection (longest name, most frequent, first seen, custom), alias consolidation, property merging (union, first-wins, most-recent), and relationship merging.
- Integrate with `kg-extract` as its `entityResolver` hook, with `memory-dedup` for entity-level deduplication, and with `embed-cache` for caching entity name embeddings.
- Zero mandatory runtime dependencies. All algorithms are self-contained TypeScript.
- Target Node.js 18 and above.

### Non-Goals

- **Not a named entity recognition (NER) system.** This package does not extract entity mentions from text. It operates on entity mentions that have already been extracted -- by an LLM via `kg-extract`, by a traditional NER model, or by manual annotation. For entity extraction from unstructured text, use `kg-extract`.
- **Not an entity linking system.** This package does not link entity mentions to entries in an external knowledge base (Wikipedia, Wikidata, DBpedia). Entity linking requires access to a reference knowledge base and disambiguation against it. `entity-resolve` resolves entities against each other within a provided set, not against an external authority. For knowledge base linking, use dedicated tools like spaCy's entity linker or DBpedia Spotlight.
- **Not an embedding generator.** This package does not generate embeddings. It accepts a caller-provided embedding function and calls it to obtain vectors for entity names. It does not bundle OpenAI, Cohere, or any model. For embedding generation and caching, use `embed-cache`.
- **Not a record linkage system for tabular data.** While entity resolution and record linkage are related problems, this package is specialized for entity mentions (name + type + aliases), not for multi-field records (name + address + phone + email). For tabular record linkage with multiple fields, Python's `dedupe` or `recordlinkage` are more appropriate.
- **Not a persistent store.** This package performs resolution in memory and returns results. It does not persist entity mappings, resolution history, or canonical entity databases. The caller manages persistence.
- **Not a real-time streaming resolver.** Resolution operates on batches of entities (or incremental single-entity additions). It does not process a continuous stream of entity mentions with windowed resolution.

---

## 3. Target Users and Use Cases

### Knowledge Graph Builders

Developers constructing knowledge graphs from multiple documents using `kg-extract`. Each document produces its own set of entity mentions, and the same real-world entity often appears under different names across documents. "Albert Einstein" in document 1, "Einstein" in document 3, and "A. Einstein" in document 7 need to be merged into a single graph node. The developer configures `entity-resolve` as the `entityResolver` hook in `kg-extract`'s `buildGraph()` call, and all extracted entities are automatically deduplicated before graph construction.

### CRM Data Cleanup

Teams maintaining customer relationship management databases where the same company or contact appears under multiple entries due to data entry inconsistencies. "International Business Machines" and "IBM" are separate records. "Dr. Jane Smith" and "Jane Smith, PhD" are duplicates. The team exports entity records, runs them through `resolve()` with abbreviation matching and alias dictionaries enabled, and uses the match pairs to identify and merge duplicates in the CRM.

### Document Entity Linking

Developers building document processing pipelines that extract entities from incoming documents and need to link them to a canonical entity registry. Each new document produces entity mentions that must be matched against existing canonical entities. The developer uses `resolveIncremental()` to check each new mention against the registry, merging if a match is found or creating a new canonical entity if not.

### Cross-Document Coreference

Researchers and analysts processing large document corpora (news articles, legal filings, intelligence reports, research papers) where the same entities appear across many documents under different surface forms. "The Walt Disney Company", "Disney", "Walt Disney Co.", and "DIS" (stock ticker) all refer to the same organization. `entity-resolve` consolidates these into a single canonical entity, enabling accurate entity frequency counting, relationship mapping, and network analysis across the corpus.

### Agent Memory Entity Dedup

Developers building AI agents with long-term memory that accumulate entity knowledge across conversations. The agent learns about "Dr. Sarah Chen" in one conversation and "Sarah Chen" in another. Without entity resolution, the agent's memory contains two separate entity records for the same person. By running extracted entities through `entity-resolve` before storage (or during periodic cleanup via `memory-dedup`), the agent maintains a clean, non-redundant entity inventory.

### Integration with npm-master Ecosystem

Developers using other packages in the npm-master monorepo: `kg-extract` for entity and relationship extraction (which delegates entity resolution to `entity-resolve`), `memory-dedup` for semantic deduplication of memory entries (which can use `entity-resolve` for entity-level dedup), and `embed-cache` for caching the embedding vectors used in embedding-based entity similarity. `entity-resolve` is the entity disambiguation layer that ensures no real-world entity is represented more than once.

---

## 4. Core Concepts

### Entity Mention

An entity mention is a single reference to an entity as it appears in a document or data source. It consists of a name string, an entity type, optional aliases, and optional metadata. A single real-world entity can have many mentions across documents: "Albert Einstein", "Einstein", "A. Einstein", and "Professor Einstein" are four distinct mentions of the same entity.

An entity mention is the input to the resolution pipeline. It represents what was observed in the data -- a raw surface form that may or may not match other mentions of the same entity.

```typescript
interface EntityMention {
  name: string;           // "Albert Einstein"
  type: string;           // "Person"
  aliases?: string[];     // ["Einstein", "A. Einstein"]
  properties?: Record<string, unknown>;  // { birthYear: 1879 }
  source?: string;        // "document-3" -- provenance
}
```

### Canonical Entity

A canonical entity is the resolved, deduplicated representation of a real-world entity. It is produced by merging one or more entity mentions that the resolution pipeline determined refer to the same real-world thing. A canonical entity has a canonical name (the primary identifier), a type, a consolidated set of aliases (all surface forms that were matched), merged properties, and a list of the original mentions that were merged into it.

A canonical entity is the output of the resolution pipeline. It represents the resolved identity -- a single node in a knowledge graph, a single record in a database.

```typescript
interface CanonicalEntity {
  name: string;              // "Albert Einstein" (canonical name)
  type: string;              // "Person"
  aliases: string[];         // ["Einstein", "A. Einstein", "Professor Einstein"]
  properties: Record<string, unknown>;
  mentions: EntityMention[]; // The original mentions that were merged
  mentionCount: number;      // How many mentions were merged
}
```

### Resolution

Resolution is the process of determining which entity mentions refer to the same real-world entity and merging them. Two mentions "resolve" to the same entity when the resolution pipeline determines they are the same with sufficient confidence. Resolution is the core operation of this package -- everything else (similarity computation, blocking, merging) exists to support it.

### Similarity Score

A similarity score is a number between 0.0 and 1.0 that measures how likely two entity mentions are to refer to the same real-world entity. A score of 1.0 means the mentions are certainly the same entity (e.g., exact name match after normalization). A score of 0.0 means they are certainly different. Scores in between reflect varying degrees of confidence.

Similarity scores can be computed by a single method (e.g., Jaro-Winkler alone) or as a composite of multiple methods with configurable weights. Composite scores are the default and recommended approach because no single method handles all variation patterns.

### Match Pair

A match pair is a record of a pairwise similarity comparison between two entity mentions, including the computed similarity score, the classification (same, possible, different), and the individual method scores that contributed to the composite. Match pairs are included in the `ResolutionResult` for transparency and auditability.

```typescript
interface MatchPair {
  entityA: string;          // Name of first mention
  entityB: string;          // Name of second mention
  similarity: number;       // Composite score (0.0 to 1.0)
  classification: 'same' | 'possible' | 'different';
  methodScores: Record<string, number>; // Per-method scores
}
```

### Blocking

Blocking is a candidate generation strategy that reduces the number of pairwise comparisons from O(n^2) to a manageable number. Instead of comparing every mention against every other mention, blocking groups mentions into "blocks" and only compares mentions within the same block. Two mentions that share no block are never compared. Blocking trades recall (some true matches may be missed if they fall in different blocks) for speed (dramatically fewer comparisons).

For example, prefix blocking groups mentions by their first 3 characters: "Einstein" and "Eisenhower" share the block "Eis" and are compared, while "Einstein" and "Newton" share no block and are skipped. For 10,000 mentions with an average block size of 50, blocking reduces comparisons from ~50 million to ~125,000.

### Transitive Closure

Transitive closure is the process of propagating match relationships. If the pipeline determines that mention A matches mention B, and mention B matches mention C, then A and C are also the same entity -- even if A and C were never directly compared (because blocking put them in different blocks) or even if their direct similarity score is below the threshold. Transitive closure uses union-find to efficiently compute connected components of matched mentions.

### Confidence Threshold

Confidence thresholds are the score boundaries that determine how match pairs are classified. Three thresholds divide the similarity score space into three regions:

- **Auto-merge threshold** (default: 0.85): Scores at or above this level are classified as "same" and automatically merged.
- **Review threshold** (default: 0.65): Scores between the review threshold and the auto-merge threshold are classified as "possible" -- likely the same entity but not certain enough for automatic merging. These are flagged for human review.
- **Rejection threshold**: Scores below the review threshold are classified as "different" and kept separate.

---

## 5. Resolution Pipeline

### Overview

The resolution pipeline transforms a set of raw entity mentions into a set of deduplicated canonical entities through six sequential stages. Each stage builds on the output of the previous stage. The pipeline is designed to be efficient (blocking eliminates most comparisons), accurate (multi-method scoring catches diverse name variations), and transparent (every match pair is recorded with its scores and classification).

### Pipeline Diagram

```
                    ┌────────────────────┐
                    │  Entity Mentions   │
                    │  (raw input)       │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Stage 1: Normalize │
                    │  (case, whitespace, │
                    │   punctuation,      │
                    │   honorifics)       │
                    └─────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │  Stage 2: Block    │
                    │  (candidate pairs) │
                    │  O(n²) → O(n·b)   │
                    └─────────┬──────────┘
                              │
               ┌──────────────▼──────────────┐
               │  Stage 3: Score             │
               │  (multi-method pairwise     │
               │   similarity for each       │
               │   candidate pair)           │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │  Stage 4: Classify          │
               │  (same / possible /         │
               │   different per pair)       │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │  Stage 5: Transitive        │
               │  Closure                    │
               │  (A=B, B=C → A=B=C)        │
               └──────────────┬──────────────┘
                              │
               ┌──────────────▼──────────────┐
               │  Stage 6: Merge             │
               │  (combine matched mentions  │
               │   into canonical entities)  │
               └──────────────┬──────────────┘
                              │
                    ┌─────────▼──────────┐
                    │ ResolutionResult   │
                    │ { entities,        │
                    │   matches,         │
                    │   unresolved }     │
                    └────────────────────┘
```

### Stage 1: Normalize Entity Mentions

**What it does**: Transforms each entity mention's name and aliases into a canonical form by applying text normalization. Normalization ensures that trivial differences in surface form (capitalization, whitespace, punctuation, honorifics) do not prevent matching.

**Normalization steps**, applied in order:

1. **Unicode normalization**: Apply NFC normalization to handle composed vs. decomposed characters.
2. **Trim and collapse whitespace**: Strip leading and trailing whitespace. Replace sequences of whitespace (spaces, tabs, newlines) with a single space.
3. **Strip honorifics and titles**: Remove common prefixes that do not contribute to identity: "Dr.", "Mr.", "Mrs.", "Ms.", "Prof.", "Professor", "Sir", "Lady", "Rev.", "Reverend", "Hon.", "Honorable". These are removed from the beginning of names. The original form is preserved in aliases.
4. **Strip corporate suffixes**: Remove common organizational suffixes: "Inc.", "Inc", "Corp.", "Corp", "Ltd.", "Ltd", "LLC", "L.L.C.", "Co.", "Company", "& Co.", "PLC", "GmbH", "AG", "S.A.", "N.V.". These are removed from the end of names. The original form is preserved in aliases.
5. **Normalize punctuation**: Remove periods from abbreviations ("U.S." becomes "US", "Dr." becomes "Dr"), normalize hyphens and dashes to a standard hyphen, remove possessive suffixes ("Einstein's" becomes "Einstein").
6. **Case normalization**: For internal comparison purposes, a lowercased version of the name is stored alongside the original-cased name. The original casing is preserved as the display form.

**What it preserves**: The original entity mention is never modified. Normalization produces internal canonical forms used for comparison. The original names are used for display and canonical name selection.

**Cost**: Sub-millisecond per entity. String operations only, no API calls.

### Stage 2: Block / Candidate Generation

**What it does**: Groups entity mentions into overlapping blocks and generates candidate pairs -- pairs of mentions that should be compared in Stage 3. Only mentions that share at least one block are compared. Mentions with no shared block are assumed to be different entities and are never scored.

**Why blocking matters**: For n entity mentions, the number of all possible pairs is n*(n-1)/2. For 1,000 mentions, that is 499,500 pairs. For 10,000 mentions, it is ~50 million pairs. Each pair requires multi-method similarity computation. Without blocking, resolution becomes impractical for entity sets larger than a few thousand. Blocking reduces the number of candidate pairs by 90-99%, making resolution feasible for tens of thousands of entities.

**Default blocking strategy**: The default strategy applies multiple blocking keys per entity and takes the union of blocks:

1. **Prefix blocking**: Group by the first 3 characters (after normalization and lowercasing). "Einstein" and "Eisenhower" share block "ein".
2. **Type blocking**: Only compare entities of the same type (or compatible types per the type hierarchy). A Person and an Organization are never compared.
3. **Alias overlap**: If entity A has an alias that exactly matches (after normalization) the name or alias of entity B, they are a candidate pair regardless of other blocking.

The blocking strategy is configurable. See Section 8 for the full catalog of blocking strategies.

**Output**: A set of candidate pairs `(mentionA, mentionB)` to be scored in Stage 3.

### Stage 3: Pairwise Similarity Scoring

**What it does**: For each candidate pair generated by blocking, computes similarity scores using multiple methods and combines them into a composite score.

Each enabled similarity method produces a score between 0.0 and 1.0 for the pair. The composite score is a weighted average of the individual method scores:

```
compositeScore = sum(weight_i * score_i) / sum(weight_i)
```

Where `weight_i` is the configured weight for method `i` and `score_i` is the score from method `i`. Methods that are not applicable to a pair (e.g., abbreviation matching when neither name is an abbreviation) are excluded from the weighted average rather than contributing 0.0, to avoid unfairly penalizing pairs that only match on a subset of methods.

**Details on each similarity method**: See Section 6.

**Output**: For each candidate pair, a `MatchPair` with the composite score and individual method scores.

### Stage 4: Match Classification

**What it does**: Classifies each scored pair into one of three categories based on the composite similarity score and configured thresholds:

- **Same** (composite score >= `autoMergeThreshold`, default 0.85): High confidence that the two mentions refer to the same entity. These pairs are automatically merged in Stage 6.
- **Possible** (composite score >= `reviewThreshold`, default 0.65, and < `autoMergeThreshold`): Medium confidence. Likely the same entity but not certain. These pairs are included in the result as `matches` with `classification: 'possible'` for the caller to review.
- **Different** (composite score < `reviewThreshold`): Low confidence. The mentions are probably different entities. These pairs are discarded (not included in the result).

**Output**: Match pairs annotated with their classification.

### Stage 5: Transitive Closure

**What it does**: Propagates "same" classifications transitively. If mention A is classified as "same" as mention B, and mention B is classified as "same" as mention C, then A, B, and C form a single connected component -- they all refer to the same entity, even if the direct A-C comparison was never performed or produced a lower score.

**Algorithm**: Union-Find (disjoint set) data structure. For each "same" pair, union the two mentions. After processing all "same" pairs, each connected component in the union-find represents one real-world entity. All mentions in the same component are merged together.

**Why transitive closure matters**: Consider three mentions: "Albert Einstein" (A), "A. Einstein" (B), and "Einstein" (C). Blocking may pair (A, B) and (B, C) but not (A, C) because "Albert" and "Einstein" share no prefix block. Pairwise scoring finds A-B similar (0.88) and B-C similar (0.87), both above the auto-merge threshold. Without transitive closure, A and C would remain separate. With transitive closure, all three are merged into one entity because the A-B and B-C links connect them.

**"Possible" pairs**: Transitive closure is applied only to "same" pairs by default. "Possible" pairs are not transitively closed because propagating uncertain matches could chain together entities that are genuinely different. The caller can opt into transitive closure of "possible" pairs via `transitiveReview: true`.

**Output**: Groups of mentions that should be merged together.

### Stage 6: Merge Matched Entities

**What it does**: For each group of mentions identified by transitive closure, produces a single canonical entity by merging the mentions.

**Merge steps**:

1. **Select canonical name**: Choose the primary name for the canonical entity. The default strategy is `longest` -- the longest name among the group members, on the theory that longer names are more specific and informative ("Albert Einstein" is preferred over "Einstein"). Alternative strategies: `most-frequent` (the name that appears most often across mentions), `first-seen` (the first mention encountered, preserving source order), or a custom function.
2. **Collect aliases**: Gather all names and aliases from all mentions in the group into a single deduplicated alias set. Remove the canonical name from the alias set (it is the primary identifier, not an alias). Sort aliases alphabetically for consistency.
3. **Merge properties**: Combine the `properties` objects from all mentions. Default strategy is `union` -- all keys from all mentions, with conflicts resolved by keeping the value from the mention with the longest name (a heuristic for "most complete record"). Alternative strategies: `first-wins` (first mention's values take precedence), `most-recent` (latest source's values), or a custom function.
4. **Record mentions**: Store all original `EntityMention` objects in the canonical entity's `mentions` array for provenance.
5. **Set mention count**: Record the number of mentions merged.

**Output**: An array of `CanonicalEntity` objects -- the deduplicated entity set.

---

## 6. Similarity Methods

### Exact Match (After Normalization)

**Algorithm**: Compare the normalized (lowercased, trimmed, honorifics-stripped) names of two entity mentions. If they are identical, the score is 1.0. Otherwise, the score is 0.0. Also checks all aliases: if any alias of entity A (after normalization) exactly matches the name or any alias of entity B, the score is 1.0.

**When to use**: Always enabled. Catches trivial variations: "Albert Einstein" vs "albert einstein", "Dr. Smith" vs "Smith", "Apple Inc." vs "Apple". The cheapest and most precise method.

**Strengths**: Zero false positives. If normalized names match, they are the same entity.

**Weaknesses**: Catches only trivial variation. Misses "Albert Einstein" vs "A. Einstein", "Bob" vs "Robert", "IBM" vs "International Business Machines".

**Default weight**: 1.0.

### Jaro-Winkler Distance

**Algorithm**: Computes the Jaro similarity between two strings, then applies the Winkler prefix bonus that rewards strings sharing a common prefix. The Jaro similarity is based on the number of matching characters (characters that appear in both strings within a window of `floor(max(len1, len2) / 2) - 1` positions) and the number of transpositions (matched characters in different order). The Winkler bonus adds up to 0.1 * (length of common prefix, max 4) * (1 - Jaro similarity).

**Formula**:

```
jaro(s1, s2) = (matches/len1 + matches/len2 + (matches - transpositions/2)/matches) / 3
winkler(s1, s2) = jaro(s1, s2) + prefixLength * scalingFactor * (1 - jaro(s1, s2))
```

Where `scalingFactor` is 0.1 and `prefixLength` is the length of the common prefix (max 4).

**When to use**: Excellent for person names. The prefix bonus rewards "Smith" matching "Smithson" higher than "Xmith" matching "Smith". Most name misspellings preserve the prefix.

**Strengths**: Fast (O(n) where n is string length). Well-suited for names. High accuracy for typos and minor variations. The prefix bonus captures the fact that name prefixes are more stable than suffixes.

**Weaknesses**: Struggles with reordered components ("John Smith" vs "Smith, John" -- Jaro-Winkler sees these as very different). Insensitive to semantics: "Apple" and "Appleton" score high despite being unrelated.

**Default weight**: 0.30.

### Levenshtein Edit Distance

**Algorithm**: Computes the minimum number of single-character edits (insertions, deletions, substitutions) needed to transform one string into the other. The raw edit distance is converted to a similarity score:

```
similarity = 1 - (editDistance / max(len1, len2))
```

**When to use**: Good for catching typos, minor misspellings, and character-level variations. "Einsten" (typo) vs "Einstein" has edit distance 1, producing a similarity of 1 - 1/8 = 0.875.

**Strengths**: Intuitive metric -- the number of character changes needed. Handles insertions, deletions, and substitutions uniformly. Well-studied algorithm with efficient implementations.

**Weaknesses**: Sensitive to string length: "AI" vs "Artificial Intelligence" has a high edit distance (normalized similarity near 0) despite being the same entity. Does not handle transpositions efficiently (swapping two adjacent characters costs 2 edits, not 1).

**Default weight**: 0.15.

### Sorensen-Dice Coefficient

**Algorithm**: Computes the overlap of character bigrams between two strings. The Dice coefficient is:

```
dice(s1, s2) = 2 * |bigrams(s1) ∩ bigrams(s2)| / (|bigrams(s1)| + |bigrams(s2)|)
```

Where `bigrams(s)` is the multiset of consecutive character pairs in the lowercased string.

**When to use**: Good for partial matches where the strings share substrings but differ in structure. "International Business Machines" and "Business Machines International" share many bigrams despite word reordering. "New York City" and "City of New York" share most bigrams.

**Strengths**: Order-insensitive at the bigram level. Handles word reordering better than Levenshtein. Cheap to compute.

**Weaknesses**: Short strings produce few bigrams, making the coefficient noisy. "Al" and "Al" have 100% overlap despite being potentially different entities (insufficient information). Very different strings can coincidentally share bigrams.

**Default weight**: 0.15.

### Soundex Phonetic Matching

**Algorithm**: Encodes each name into a Soundex code -- a letter followed by three digits that represent the phonetic structure of the name. Names that sound similar produce the same Soundex code. The similarity score is 1.0 if the Soundex codes match, 0.0 otherwise.

**Encoding rules**: Retain the first letter. Replace consonants with digits (B/F/P/V -> 1, C/G/J/K/Q/S/X/Z -> 2, D/T -> 3, L -> 4, M/N -> 5, R -> 6). Drop vowels and H/W/Y (except the initial letter). Remove consecutive duplicate digits. Pad or truncate to exactly 4 characters.

**When to use**: Catches phonetic misspellings: "Smith" and "Smyth" produce the same Soundex code (S530). "Katherine" and "Catherine" produce the same code (C365). Useful for person names where spelling varies by language or transcription conventions.

**Strengths**: Catches misspellings that preserve pronunciation. Fast (O(n) encoding per name).

**Weaknesses**: Coarse -- many different names share the same Soundex code, producing false positives. Only works for Latin-alphabet names. Designed for English phonetics; less effective for other languages.

**Default weight**: 0.05.

### Metaphone Phonetic Matching

**Algorithm**: An improved phonetic encoding that produces a more accurate code than Soundex by applying English pronunciation rules. It handles silent letters, digraphs (CH, SH, TH, PH), and vowel pronunciation more accurately. Two names are compared by their Metaphone codes. The similarity score is the Jaro-Winkler similarity of the two Metaphone codes (rather than binary match/no-match like Soundex), providing a more nuanced phonetic similarity measure.

**When to use**: When phonetic matching is important but Soundex is too coarse. Metaphone distinguishes names that Soundex conflates. "Smith" (SM0) and "Schmidt" (SXMTT) produce different Metaphone codes, correctly identifying them as phonetically different despite looking similar in text. However, "Steven" and "Stephen" produce matching codes.

**Strengths**: More accurate than Soundex. Handles a wider range of English pronunciation patterns. Produces variable-length codes that capture more phonetic detail.

**Weaknesses**: Still English-centric. More complex to implement than Soundex. Variable-length codes require Jaro-Winkler comparison rather than exact matching.

**Default weight**: 0.05.

### Abbreviation Matching

**Algorithm**: Detects whether one entity name is an abbreviation or acronym of the other. Three abbreviation patterns are checked:

1. **Initials acronym**: Check if an all-uppercase name (e.g., "IBM") matches the initial letters of a multi-word name (e.g., "International Business Machines"). For each word in the longer name, take the first letter, ignoring common stop words ("of", "the", "and", "for", "in"). Compare the resulting initials string against the short name. Score is 1.0 if they match, 0.0 otherwise.
2. **Dotted initials**: Check if a name like "J.F.K." or "J. F. Kennedy" matches "John Fitzgerald Kennedy". Strip dots and spaces from the short form and check if the resulting characters match the initials of the long form.
3. **Known alias lookup**: Check if the two names appear as a pair in the configured alias dictionary. Score is 1.0 if found, 0.0 otherwise.

**When to use**: Essential for organization names where abbreviations are pervasive (NASA, UN, WHO, IBM, MIT). Also useful for person names with initials.

**Strengths**: Catches matches that all other string similarity methods miss. "IBM" and "International Business Machines" have near-zero Jaro-Winkler, Levenshtein, and Dice similarity, but abbreviation matching catches them perfectly.

**Weaknesses**: Only catches specific abbreviation patterns. Does not handle non-standard abbreviations or nicknames (those require the alias dictionary). False positives are possible: "MAC" could be an abbreviation of "Mid-Atlantic Conference" or the "Macintosh" brand or an unrelated entity.

**Default weight**: 0.20.

### Embedding Similarity

**Algorithm**: Encode both entity names using an embedding model (provided by the caller as an `embedder` function), then compute cosine similarity between the resulting vectors.

```
similarity(A, B) = cosineSimilarity(embed(A.name), embed(B.name))
```

For L2-normalized embedding vectors, cosine similarity reduces to the dot product.

**When to use**: When the above string-based methods are insufficient -- particularly for semantic equivalences that no string method can catch. "Apple Inc." and "Apple Computer" are semantically identical but have moderate string similarity. "The Big Apple" (nickname for New York City) and "New York City" share no string overlap but may have moderate embedding similarity. Embedding similarity captures meaning, not surface form.

**Strengths**: Catches semantic similarity that string methods miss. Handles paraphrases, synonyms, and contextually equivalent names. The most powerful single method for ambiguous cases.

**Weaknesses**: Requires an embedding API (cost, latency, network dependency). Slower than string methods (30-100ms per embedding call vs. sub-millisecond for string operations). May produce false positives for names that are semantically similar but refer to different entities ("Apple Inc." and "Apple Records" are semantically close but different entities -- type information disambiguates).

**Default weight**: 0.10 (low weight because it is optional and not always available; weight increases to 0.25 when explicitly enabled by the caller).

### Composite Scoring

The composite score for a pair is the weighted average of all applicable method scores:

```
compositeScore = sum(weight_i * score_i) / sum(weight_i)
    for all methods i where the method is applicable to the pair
```

A method is "applicable" if it is enabled in the configuration and produces a meaningful score for the pair. Abbreviation matching is only applicable when one name is a potential abbreviation (all uppercase, or significantly shorter than the other). Embedding similarity is only applicable when an embedder is configured. When a method is not applicable, it is excluded from both the numerator and denominator of the weighted average.

**Default weights** (when all methods are enabled):

| Method | Default Weight | Rationale |
|--------|---------------|-----------|
| Exact match | 1.00 | Binary. When it fires, it is definitive. |
| Jaro-Winkler | 0.30 | Best general-purpose name similarity. |
| Abbreviation | 0.20 | Critical for organization names. |
| Levenshtein | 0.15 | Good for typo detection. |
| Dice coefficient | 0.15 | Good for partial and reordered matches. |
| Embedding similarity | 0.10 | Powerful but optional; higher when enabled. |
| Soundex | 0.05 | Coarse phonetic backup. |
| Metaphone | 0.05 | Finer phonetic backup. |

Callers can override any weight. Setting a weight to 0 effectively disables that method.

---

## 7. Entity Types

### Type-Aware Resolution

Entity types are a powerful disambiguation signal. Two entities with the same name but different types are almost certainly different entities. "Apple" typed as `Organization` and "Apple" typed as `Food` are different entities. "Mercury" typed as `Planet` and "Mercury" typed as `Element` are different. "Paris" typed as `Location` (the city) and "Paris" typed as `Person` (Paris Hilton) are different.

By default, the resolver only compares entities of the same type. This is enforced during blocking (Stage 2): type blocking ensures that entities of incompatible types are never candidate pairs.

### Type Hierarchy

Some types are subtypes of other types. "Company" is a subtype of "Organization". "City" is a subtype of "Location". When a type hierarchy is configured, entities of compatible types (a type and its subtypes) are compared. "Apple" typed as `Company` and "Apple Inc." typed as `Organization` are candidates because `Company` is a subtype of `Organization`.

The default type hierarchy:

```
Organization
├── Company
├── Government
├── Non-Profit
└── Institution

Location
├── City
├── Country
├── Region
└── Landmark

Person
```

Callers can provide custom type hierarchies.

### Cross-Type Blocking

When type blocking is enabled (the default), entities of incompatible types are never compared. This eliminates a large class of false positives at the blocking stage, before any similarity computation occurs. It also reduces the number of candidate pairs, improving performance.

Two types are "compatible" if:
- They are the same type.
- One is a subtype of the other.
- Either is the catch-all type `Concept` or `Unknown` (these match any type, since the type may not have been accurately determined).

---

## 8. Blocking Strategies

### Prefix Blocking

**How it works**: For each entity mention, compute a blocking key from the first N characters of the normalized, lowercased name (default N=3). Entity mentions sharing a blocking key are in the same block and form candidate pairs.

**Example**: N=3. "Einstein" -> "ein", "Eisenhower" -> "eis", "Albert Einstein" -> "alb". "Einstein" and "Eisenhower" do not share a block. "Albert Einstein" and "Eisenhower" do not share a block. But "Einstein" might appear under alias "Einstein, Albert" -> "ein", which shares a block with "Einstein" itself.

**Strengths**: Simple, fast, and effective when entity names share prefixes.

**Weaknesses**: Misses pairs that differ in the prefix. "Einstein" and "Albert Einstein" do not share a prefix block. Mitigated by also blocking on each alias's prefix.

**When to use**: Good default for homogeneous name sets (all person names, all company names). Less effective for heterogeneous names.

### Phonetic Blocking

**How it works**: For each entity mention, compute a Soundex or Metaphone code for the first word of the name. Entity mentions sharing a phonetic code are in the same block.

**Example**: "Smith" (Soundex: S530), "Smyth" (Soundex: S530), "Schmidt" (Soundex: S530 in some implementations). All three are in the same block and compared pairwise.

**Strengths**: Catches phonetic variants that prefix blocking misses. "Catherine" and "Katherine" share a phonetic block but not a prefix block.

**Weaknesses**: Soundex is coarse -- many unrelated names share a code, producing large blocks. Metaphone is more precise but still produces some conflation.

**When to use**: When entity names include phonetic variants from different languages or transcription conventions. Especially useful for person names.

### N-Gram Blocking

**How it works**: For each entity mention, extract all character n-grams (default: trigrams) from the normalized name. Entity mentions sharing any n-gram are in the same block.

**Example**: "Einstein" trigrams: "ein", "ins", "nst", "ste", "tei", "ein". "Einsten" (typo) trigrams: "ein", "ins", "nst", "ste", "ten". They share "ein", "ins", "nst", "ste" -- many shared trigrams -- so they are in the same block.

**Strengths**: Very high recall. Catches pairs that differ anywhere in the string, not just the prefix. Robust to typos, insertions, and deletions.

**Weaknesses**: Produces many candidate pairs because common n-grams (like "the", "ing", "tion") create large blocks. Requires a frequency filter: n-grams that appear in more than a threshold fraction of all names (default: 10%) are excluded from blocking to prevent huge blocks.

**When to use**: When high recall is more important than speed. When entity names vary in structure (different word orders, missing middle names, different suffixes).

### Type Blocking

**How it works**: Entity mentions are blocked by type. Only mentions of compatible types (same type or related types per the type hierarchy) are in the same block. Type blocking is applied in conjunction with other blocking strategies -- the final candidate set is the intersection of type blocks and other blocks.

**Example**: "Apple" (Organization) and "Apple" (Food) are in different type blocks and are never compared. "Apple" (Organization) and "Apple Inc." (Company) are in the same type block because Company is a subtype of Organization.

**Strengths**: Eliminates the largest class of false positives (same name, different type) at zero computational cost.

**Weaknesses**: Requires accurate type information. If the extractor misclassifies an entity's type, type blocking may prevent a correct match.

**When to use**: Always, unless type information is unreliable or absent.

### Custom Blocking Function

For domain-specific blocking logic, callers can provide a custom blocking function:

```typescript
type BlockingFunction = (entity: EntityMention) => string[];
```

The function receives an entity mention and returns an array of blocking keys. Two mentions that share any blocking key are candidates for comparison. The custom function is used in conjunction with (not instead of) the built-in blocking strategies.

---

## 9. Merge Strategies

### Canonical Name Selection

When multiple mentions are merged into a canonical entity, one name must be chosen as the primary identifier. Built-in strategies:

| Strategy | Logic | When to Use |
|----------|-------|-------------|
| `longest` (default) | Choose the longest name among the group. | Most common choice. Longer names are more specific: "Albert Einstein" over "Einstein". |
| `most-frequent` | Choose the name that appears most often across mentions. | When the most common surface form is the standard form. |
| `first-seen` | Choose the name from the first mention in source order. | When document order implies authority (e.g., the first document is the canonical source). |
| `custom` | Caller-provided function `(names: string[]) => string`. | Domain-specific logic (e.g., prefer names in a specific format or from a specific source). |

### Alias Collection

All names and aliases from all mentions in a resolved group are collected into a single deduplicated set. The canonical name is excluded from the alias set. Aliases are deduplicated after normalization (case-insensitive comparison) but preserved in their original casing.

**Example**: Mentions "Albert Einstein" (aliases: ["Einstein"]), "A. Einstein" (no aliases), "Professor Einstein" (aliases: ["Einstein"]). Canonical name: "Albert Einstein". Alias set: ["Einstein", "A. Einstein", "Professor Einstein"].

### Property Merging

When mentions carry properties (e.g., `{ birthYear: 1879, nationality: "German" }`), the merger combines them. Built-in strategies:

| Strategy | Logic |
|----------|-------|
| `union` (default) | All keys from all mentions. Conflicts resolved by keeping the value from the mention with the longest name. |
| `first-wins` | For each key, the first mention's value wins. |
| `most-recent` | For each key, the value from the most recently sourced mention wins (requires `source` metadata with ordering). |
| `custom` | Caller-provided function. |

### Relationship Merging

When `entity-resolve` is used within `kg-extract`, entity resolution must update relationship triples: if mention "Einstein" is merged into canonical entity "Albert Einstein", all triples that reference "Einstein" as subject or object must be updated to reference "Albert Einstein". This is handled by the `ResolutionResult.mergeMap` which maps each original mention name to its canonical entity name. The caller (typically `kg-extract`) applies this map to update triples.

---

## 10. Confidence and Thresholds

### Threshold Configuration

Three thresholds govern match classification:

| Threshold | Default | Purpose |
|-----------|---------|---------|
| `autoMergeThreshold` | 0.85 | Minimum composite score for automatic merging. |
| `reviewThreshold` | 0.65 | Minimum composite score for "possible" classification. |
| Implicit rejection | < 0.65 | Scores below `reviewThreshold` are classified as "different". |

### Recommended Thresholds by Use Case

| Use Case | `autoMergeThreshold` | `reviewThreshold` | Rationale |
|----------|---------------------|--------------------|-----------|
| Conservative (avoid false merges) | 0.92 | 0.75 | Only merge when very confident. More manual review. |
| Standard (balanced) | 0.85 | 0.65 | Good balance of precision and recall. |
| Aggressive (catch more matches) | 0.75 | 0.55 | Merges more aggressively. Review false positives. |
| Fully automatic (no review) | 0.80 | 0.80 | All matches are auto-merged or rejected. No "possible" tier. |

### Tuning Guidance

The optimal thresholds depend on the entity types, the quality of input data, the similarity methods enabled, and the tolerance for false positives vs. false negatives. False merges (merging two different entities) are generally more harmful than missed merges (leaving duplicates), because false merges corrupt relationship data. When in doubt, use higher thresholds and review "possible" matches manually.

The `resolve()` function returns all match pairs with their scores, enabling callers to analyze the score distribution and adjust thresholds empirically.

---

## 11. API Surface

### Installation

```bash
npm install entity-resolve
```

### Primary Function: `resolve`

```typescript
import { resolve } from 'entity-resolve';

const result = resolve(
  [
    { name: 'Albert Einstein', type: 'Person', aliases: ['Einstein'] },
    { name: 'A. Einstein', type: 'Person' },
    { name: 'Einstein', type: 'Person' },
    { name: 'Niels Bohr', type: 'Person' },
    { name: 'N. Bohr', type: 'Person' },
  ],
);

console.log(result.entities);
// [
//   { name: 'Albert Einstein', type: 'Person', aliases: ['Einstein', 'A. Einstein'],
//     mentions: [...], mentionCount: 3 },
//   { name: 'Niels Bohr', type: 'Person', aliases: ['N. Bohr'],
//     mentions: [...], mentionCount: 2 },
// ]

console.log(result.matches);
// [
//   { entityA: 'Albert Einstein', entityB: 'A. Einstein', similarity: 0.88, classification: 'same', ... },
//   { entityA: 'Albert Einstein', entityB: 'Einstein', similarity: 0.91, classification: 'same', ... },
//   { entityA: 'Niels Bohr', entityB: 'N. Bohr', similarity: 0.87, classification: 'same', ... },
// ]
```

**Signature**:

```typescript
function resolve(
  entities: EntityMention[],
  options?: ResolverOptions,
): ResolutionResult;
```

### Incremental Resolution: `resolveIncremental`

```typescript
import { resolveIncremental } from 'entity-resolve';

const existing = [
  { name: 'Albert Einstein', type: 'Person', aliases: ['Einstein', 'A. Einstein'] },
  { name: 'Niels Bohr', type: 'Person', aliases: ['N. Bohr'] },
];

const result = resolveIncremental(
  { name: 'Prof. Einstein', type: 'Person' },
  existing,
);

console.log(result.match);
// { name: 'Albert Einstein', similarity: 0.89, classification: 'same' }

const result2 = resolveIncremental(
  { name: 'Marie Curie', type: 'Person' },
  existing,
);

console.log(result2.match);
// null -- no match, this is a new entity
```

**Signature**:

```typescript
function resolveIncremental(
  newEntity: EntityMention,
  existingEntities: CanonicalEntity[],
  options?: ResolverOptions,
): IncrementalResult;
```

### Pairwise Similarity: `similarity`

```typescript
import { similarity } from 'entity-resolve';

const score = similarity(
  { name: 'Albert Einstein', type: 'Person' },
  { name: 'A. Einstein', type: 'Person' },
);
// 0.88

const score2 = similarity(
  { name: 'IBM', type: 'Organization' },
  { name: 'International Business Machines', type: 'Organization' },
);
// 0.92 (abbreviation matching fires)
```

**Signature**:

```typescript
function similarity(
  entityA: EntityMention,
  entityB: EntityMention,
  options?: SimilarityOptions,
): SimilarityResult;
```

### Factory: `createResolver`

```typescript
import { createResolver } from 'entity-resolve';

const resolver = createResolver({
  autoMergeThreshold: 0.85,
  reviewThreshold: 0.65,
  methods: {
    jaroWinkler: { weight: 0.30 },
    levenshtein: { weight: 0.15 },
    dice: { weight: 0.15 },
    abbreviation: { weight: 0.20 },
    soundex: { weight: 0.05 },
    metaphone: { weight: 0.05 },
    embedding: { weight: 0.10, embedder: myEmbedder },
  },
  blocking: ['prefix', 'type'],
  nameStrategy: 'longest',
  aliases: {
    'Bob': 'Robert',
    'NYC': 'New York City',
    'US': 'United States',
  },
});

// Batch resolution
const result = resolver.resolve(entityMentions);

// Incremental resolution
const match = resolver.addEntity(newMention);
if (match) {
  console.log(`Matched to: ${match.canonicalEntity.name}`);
} else {
  console.log('New entity added');
}
```

**Signature**:

```typescript
function createResolver(config: ResolverConfig): EntityResolver;

interface EntityResolver {
  resolve(entities: EntityMention[]): ResolutionResult;
  addEntity(entity: EntityMention): AddEntityResult;
  similarity(entityA: EntityMention, entityB: EntityMention): SimilarityResult;
  getEntities(): CanonicalEntity[];
  getEntity(name: string): CanonicalEntity | undefined;
  readonly size: number;
  reset(): void;
}
```

### Type Definitions

```typescript
// -- Entity Types --------------------------------------------------------

/** An entity mention -- a single reference to an entity from a source. */
interface EntityMention {
  /** The name as it appears in the source. */
  name: string;

  /** Entity type (Person, Organization, Location, etc.). */
  type: string;

  /** Alternative names or abbreviations from the source. */
  aliases?: string[];

  /** Additional properties associated with this mention. */
  properties?: Record<string, unknown>;

  /** Source identifier (document ID, passage index, etc.). */
  source?: string;
}

/** A resolved, deduplicated entity. */
interface CanonicalEntity {
  /** The canonical (primary) name. */
  name: string;

  /** Entity type. */
  type: string;

  /** All known aliases (deduplicated, excluding the canonical name). */
  aliases: string[];

  /** Merged properties from all contributing mentions. */
  properties: Record<string, unknown>;

  /** The original mentions that were merged into this entity. */
  mentions: EntityMention[];

  /** Number of mentions merged. */
  mentionCount: number;
}

// -- Result Types --------------------------------------------------------

/** The result of a batch resolution. */
interface ResolutionResult {
  /** Deduplicated canonical entities. */
  entities: CanonicalEntity[];

  /** All match pairs with scores and classifications. */
  matches: MatchPair[];

  /** Mentions that were not matched to any other mention (singletons). */
  unresolved: EntityMention[];

  /**
   * Map from original mention name to canonical entity name.
   * Used by callers (e.g., kg-extract) to update references.
   */
  mergeMap: Record<string, string>;

  /** Resolution statistics. */
  stats: ResolutionStats;
}

/** A pairwise match between two entity mentions. */
interface MatchPair {
  /** Name of the first mention. */
  entityA: string;

  /** Name of the second mention. */
  entityB: string;

  /** Composite similarity score (0.0 to 1.0). */
  similarity: number;

  /** Classification based on thresholds. */
  classification: 'same' | 'possible' | 'different';

  /** Individual method scores. */
  methodScores: Record<string, number>;
}

/** The result of an incremental resolution. */
interface IncrementalResult {
  /** The matching canonical entity, or null if no match. */
  match: {
    name: string;
    similarity: number;
    classification: 'same' | 'possible';
  } | null;

  /** The entity as it was classified. */
  entity: EntityMention;
}

/** The result of adding an entity to a stateful resolver. */
interface AddEntityResult {
  /** Whether the entity was merged into an existing canonical entity or added as new. */
  action: 'merged' | 'added';

  /** The canonical entity (existing if merged, new if added). */
  canonicalEntity: CanonicalEntity;

  /** The similarity score with the matched entity, or 0 if added as new. */
  similarity: number;
}

/** The result of a pairwise similarity computation. */
interface SimilarityResult {
  /** Composite similarity score (0.0 to 1.0). */
  score: number;

  /** Individual method scores. */
  methodScores: Record<string, number>;

  /** Whether the types are compatible. */
  typesCompatible: boolean;
}

/** Statistics from a resolution run. */
interface ResolutionStats {
  /** Total entity mentions input. */
  totalMentions: number;

  /** Canonical entities output. */
  canonicalEntities: number;

  /** Mentions merged (totalMentions - canonicalEntities). */
  mentionsMerged: number;

  /** Candidate pairs generated by blocking. */
  candidatePairs: number;

  /** Pairs classified as 'same'. */
  sameCount: number;

  /** Pairs classified as 'possible'. */
  possibleCount: number;

  /** Wall-clock time for the resolution, in milliseconds. */
  durationMs: number;
}

// -- Configuration -------------------------------------------------------

/** Options for the resolve() and resolveIncremental() functions. */
interface ResolverOptions {
  /**
   * Minimum composite score for automatic merging.
   * Default: 0.85.
   */
  autoMergeThreshold?: number;

  /**
   * Minimum composite score for "possible" classification.
   * Default: 0.65.
   */
  reviewThreshold?: number;

  /**
   * Similarity method configuration.
   * Each key is a method name. Each value is { weight, enabled }.
   * Methods not listed use default weights.
   */
  methods?: MethodConfig;

  /**
   * Blocking strategies to use.
   * Default: ['prefix', 'type'].
   */
  blocking?: Array<BlockingStrategyName | BlockingFunction>;

  /**
   * Prefix length for prefix blocking.
   * Default: 3.
   */
  prefixLength?: number;

  /**
   * Canonical name selection strategy.
   * Default: 'longest'.
   */
  nameStrategy?: 'longest' | 'most-frequent' | 'first-seen' | NameStrategyFunction;

  /**
   * Property merge strategy.
   * Default: 'union'.
   */
  propertyMerge?: 'union' | 'first-wins' | 'most-recent' | PropertyMergeFunction;

  /**
   * Alias dictionary mapping known equivalences.
   * Key: alias. Value: canonical form.
   */
  aliases?: Record<string, string>;

  /**
   * Type hierarchy. Keys are parent types, values are arrays of subtypes.
   * Default: built-in hierarchy (Organization > Company/Government/..., etc.).
   */
  typeHierarchy?: Record<string, string[]>;

  /**
   * Whether to apply transitive closure to "possible" matches
   * (in addition to "same" matches).
   * Default: false.
   */
  transitiveReview?: boolean;

  /**
   * Embedding function for embedding-based similarity.
   * When provided, the embedding method is enabled.
   * Default: undefined (embedding method disabled).
   */
  embedder?: (text: string) => Promise<number[]>;
}

/** Configuration for a single similarity method. */
interface MethodOptions {
  /** Weight in composite score. Set to 0 to disable. */
  weight?: number;

  /** Whether the method is enabled. Default: true. */
  enabled?: boolean;
}

/** Configuration for all similarity methods. */
interface MethodConfig {
  exactMatch?: MethodOptions;
  jaroWinkler?: MethodOptions;
  levenshtein?: MethodOptions;
  dice?: MethodOptions;
  soundex?: MethodOptions;
  metaphone?: MethodOptions;
  abbreviation?: MethodOptions;
  embedding?: MethodOptions & {
    /** Embedding function. Required if embedding method is enabled. */
    embedder?: (text: string) => Promise<number[]>;
  };
}

/** Blocking strategy names. */
type BlockingStrategyName = 'prefix' | 'phonetic' | 'ngram' | 'type';

/** Custom blocking function. */
type BlockingFunction = (entity: EntityMention) => string[];

/** Custom name selection function. */
type NameStrategyFunction = (names: string[]) => string;

/** Custom property merge function. */
type PropertyMergeFunction = (
  propertiesArray: Array<Record<string, unknown>>,
) => Record<string, unknown>;

/** Configuration for createResolver(). */
interface ResolverConfig extends ResolverOptions {
  // All fields from ResolverOptions, plus any resolver-specific config.
  // Currently identical to ResolverOptions.
}

// -- Error Classes -------------------------------------------------------

/** Base error for all entity-resolve errors. */
class ResolveError extends Error {
  readonly code: string;
}

/** Thrown when configuration is invalid. */
class ResolveConfigError extends ResolveError {
  readonly code = 'RESOLVE_CONFIG_ERROR';
}

/** Thrown when the embedder function fails. */
class ResolveEmbeddingError extends ResolveError {
  readonly code = 'RESOLVE_EMBEDDING_ERROR';
}
```

---

## 12. Configuration

### All Options with Defaults

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `autoMergeThreshold` | `number` | `0.85` | Minimum composite score for automatic merging. |
| `reviewThreshold` | `number` | `0.65` | Minimum composite score for "possible" classification. |
| `methods.exactMatch.weight` | `number` | `1.0` | Weight for exact match (after normalization). |
| `methods.jaroWinkler.weight` | `number` | `0.30` | Weight for Jaro-Winkler similarity. |
| `methods.levenshtein.weight` | `number` | `0.15` | Weight for Levenshtein similarity. |
| `methods.dice.weight` | `number` | `0.15` | Weight for Sorensen-Dice coefficient. |
| `methods.soundex.weight` | `number` | `0.05` | Weight for Soundex phonetic matching. |
| `methods.metaphone.weight` | `number` | `0.05` | Weight for Metaphone phonetic matching. |
| `methods.abbreviation.weight` | `number` | `0.20` | Weight for abbreviation matching. |
| `methods.embedding.weight` | `number` | `0.10` | Weight for embedding cosine similarity. |
| `blocking` | `Array` | `['prefix', 'type']` | Active blocking strategies. |
| `prefixLength` | `number` | `3` | Prefix length for prefix blocking. |
| `nameStrategy` | `string` | `'longest'` | Canonical name selection strategy. |
| `propertyMerge` | `string` | `'union'` | Property merge strategy. |
| `aliases` | `Record` | `{}` | Alias dictionary. |
| `typeHierarchy` | `Record` | built-in | Type hierarchy for type compatibility. |
| `transitiveReview` | `boolean` | `false` | Whether to transitively close "possible" matches. |
| `embedder` | `Function` | `undefined` | Embedding function (enables embedding method). |

### Configuration Validation

All configuration values are validated at call time:

- `autoMergeThreshold` and `reviewThreshold` must be numbers between 0.0 and 1.0. Must satisfy `reviewThreshold` <= `autoMergeThreshold`. Throws `ResolveConfigError` if violated.
- Method weights must be non-negative numbers.
- `blocking` must be an array of valid strategy names or functions.
- `prefixLength` must be a positive integer.
- `nameStrategy` must be a valid strategy name or a function.
- `aliases`, if provided, must be an object with string keys and string values.
- `embedder`, if provided, must be a function.

### Configuration Precedence

When using `createResolver`, options are merged with the following precedence (highest first):

1. Per-call overrides passed to `resolver.resolve(entities, overrides)` or `resolver.addEntity(entity, overrides)`.
2. Factory-level options passed to `createResolver(config)`.
3. Built-in defaults.

---

## 13. Integration

### With `kg-extract`

`kg-extract` provides an `entityResolver` hook that accepts a function conforming to `(entities: Entity[]) => Promise<EntityResolutionResult>`. `entity-resolve` implements this interface directly.

```typescript
import { buildGraph } from 'kg-extract';
import { createResolver } from 'entity-resolve';

const resolver = createResolver({
  autoMergeThreshold: 0.85,
  methods: {
    jaroWinkler: { weight: 0.30 },
    abbreviation: { weight: 0.20 },
    levenshtein: { weight: 0.15 },
    dice: { weight: 0.15 },
  },
});

const graph = await buildGraph(documents, {
  llm,
  entityResolver: async (entities) => {
    const result = resolver.resolve(entities);
    return {
      mergeMap: result.mergeMap,
      entities: result.entities,
    };
  },
});
```

`kg-extract` extracts entities from text; `entity-resolve` deduplicates them. The built-in resolution in `kg-extract` handles simple cases (exact alias match, case-insensitive, substring containment, abbreviation). `entity-resolve` handles the harder cases: fuzzy string matching across all surface forms, phonetic matching for misspellings, embedding-based similarity for semantic equivalence, and composite scoring with configurable weights.

### With `memory-dedup`

`memory-dedup` deduplicates memory entries using embedding-based semantic similarity. For agent memory systems that store entity records, `entity-resolve` can deduplicate the entity dimension while `memory-dedup` deduplicates the fact dimension:

```typescript
import { createDeduplicator } from 'memory-dedup';
import { createResolver } from 'entity-resolve';

const factDedup = createDeduplicator({
  embedder: openaiEmbed,
  threshold: 0.90,
});

const entityResolver = createResolver({
  autoMergeThreshold: 0.85,
  embedder: openaiEmbed,
});

async function storeEntityFact(entityMention: EntityMention, fact: string) {
  // Step 1: Resolve entity to canonical form
  const match = entityResolver.addEntity(entityMention);
  const canonicalName = match.canonicalEntity.name;

  // Step 2: Deduplicate the fact under the canonical entity
  const dedupResult = await factDedup.add({
    id: `${canonicalName}-${Date.now()}`,
    content: `${canonicalName}: ${fact}`,
    metadata: { entity: canonicalName },
  });

  return { entity: canonicalName, factAction: dedupResult.action };
}
```

### With `embed-cache`

`embed-cache` caches embedding vectors to avoid redundant API calls. When `entity-resolve` uses embedding-based similarity, wrapping the embedder with `embed-cache` ensures that repeated entity names are not re-embedded:

```typescript
import { createResolver } from 'entity-resolve';
import { createEmbedCache } from 'embed-cache';

const cache = createEmbedCache({ maxSize: 10_000 });

const rawEmbedder = async (text: string) => {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });
  return response.data[0].embedding;
};

const resolver = createResolver({
  embedder: async (text) => {
    const cached = cache.get(text);
    if (cached) return cached;
    const embedding = await rawEmbedder(text);
    cache.set(text, embedding);
    return embedding;
  },
  methods: {
    embedding: { weight: 0.25 },
  },
});
```

This is especially valuable for incremental resolution where the same canonical entity names are repeatedly compared against new mentions.

---

## 14. Testing Strategy

### Test Categories

**Unit tests: Text normalization** -- Verify that normalization produces expected canonical forms. Test cases: mixed case ("ALBERT EINSTEIN" -> "Albert Einstein" preserved, normalized lowercase form "albert einstein"), extra whitespace, honorific stripping ("Dr. John Smith" -> "John Smith"), corporate suffix stripping ("Apple Inc." -> "Apple"), punctuation normalization ("U.S.A." -> "USA"), possessive stripping ("Einstein's" -> "Einstein"), Unicode normalization. Verify idempotence.

**Unit tests: Jaro-Winkler** -- Test with known string pairs and expected scores. "MARTHA" vs "MARHTA" (classic Jaro example, expected ~0.944). "DWAYNE" vs "DUANE" (expected ~0.840). Identical strings produce 1.0. Completely different strings produce a low score. Empty strings handled gracefully.

**Unit tests: Levenshtein** -- Test edit distance computation and normalization to similarity score. "kitten" vs "sitting" (distance 3, similarity 1-3/7 = 0.571). Identical strings produce 0 distance (similarity 1.0). Empty vs non-empty string.

**Unit tests: Dice coefficient** -- Test bigram overlap computation. "night" vs "nacht" (shared bigrams: "ht", expected ~0.25). Identical strings produce 1.0. Single-character strings (no bigrams).

**Unit tests: Soundex** -- Verify encoding for known names. "Robert" -> R163, "Rupert" -> R163 (match). "Smith" -> S530, "Smyth" -> S530 (match). "Ashcraft" -> A261. "Pfister" -> P236.

**Unit tests: Metaphone** -- Verify encoding for known names. Verify that Metaphone distinguishes names that Soundex conflates and catches names that Soundex misses.

**Unit tests: Abbreviation matching** -- "IBM" vs "International Business Machines" (match). "NASA" vs "National Aeronautics and Space Administration" (match). "J.F.K." vs "John Fitzgerald Kennedy" (match). "UN" vs "United Nations" (match). "ABC" vs "Already Been Chewed" (match, abbreviation is valid). "ABC" vs "Alphabet" (no match, not an abbreviation). False positive avoidance: "MAC" should not match "Machine" (not an initials match).

**Unit tests: Composite scoring** -- Test that composite scores correctly weight individual method scores. Test that inapplicable methods are excluded from the average. Test with all methods enabled, with only some methods enabled, and with custom weights.

**Unit tests: Blocking** -- Verify that prefix blocking produces correct block keys. Verify that type blocking excludes incompatible types. Verify that n-gram blocking produces correct n-grams and applies frequency filtering. Verify that multiple blocking strategies produce the union of their candidate pairs.

**Unit tests: Transitive closure** -- Test union-find with known connected components. A=B, B=C -> {A,B,C}. A=B, C=D -> {A,B}, {C,D}. A=B, B=C, C=D -> {A,B,C,D}. Single element -> {A}. Verify that "possible" pairs are not transitively closed by default.

**Unit tests: Merge** -- Test canonical name selection (longest, most-frequent, first-seen). Test alias collection and deduplication. Test property merging (union, first-wins). Verify that the canonical name is excluded from the alias set.

**Integration tests: Full pipeline** -- Create a set of entity mentions with known duplicates. Run `resolve()` and verify that the output matches expectations: correct canonical entities, correct alias sets, correct merge map, correct match pairs. Test with person names, organization names, mixed types. Test with abbreviations, phonetic variants, and typos.

**Integration tests: Incremental resolution** -- Build a set of canonical entities. Add new mentions one at a time via `resolveIncremental()`. Verify that matches are found when expected and new entities are created when expected.

**Integration tests: kg-extract compatibility** -- Create an entity list in the format `kg-extract` produces. Run through `entity-resolve` and verify the `mergeMap` and `entities` fields conform to `kg-extract`'s `EntityResolutionResult` interface.

**Edge case tests** -- Empty entity list. Single entity (nothing to resolve). All entities identical. All entities different. Entity with empty name (should be handled gracefully or rejected). Entity with very long name (1000+ characters). Entity with no type (default behavior). Entities with conflicting types but same name. Embedder that throws an error. Embedder that returns wrong dimensions.

### Test Organization

```
src/__tests__/
  resolve.test.ts                    Full lifecycle integration tests
  similarity/
    jaro-winkler.test.ts             Jaro-Winkler algorithm
    levenshtein.test.ts              Levenshtein edit distance
    dice.test.ts                     Sorensen-Dice coefficient
    soundex.test.ts                  Soundex encoding
    metaphone.test.ts                Metaphone encoding
    abbreviation.test.ts             Abbreviation matching
    embedding.test.ts                Embedding cosine similarity (mock)
    composite.test.ts                Composite scoring
  blocking/
    prefix.test.ts                   Prefix blocking
    phonetic.test.ts                 Phonetic blocking
    ngram.test.ts                    N-gram blocking
    type.test.ts                     Type blocking
  pipeline/
    normalize.test.ts                Text normalization
    classify.test.ts                 Match classification
    transitive.test.ts               Transitive closure (union-find)
  merge/
    name-selection.test.ts           Canonical name selection
    alias-collection.test.ts         Alias consolidation
    property-merge.test.ts           Property merging
  incremental/
    add-entity.test.ts               Incremental entity addition
  fixtures/
    entities.ts                      Test entity mentions with known matches
    mock-embedder.ts                 Mock embedder for testing
```

### Test Framework

Tests use Vitest, matching the project's existing `package.json` configuration. The mock embedder returns predetermined vectors from a lookup table keyed by entity name, enabling deterministic testing without API calls. For entity names not in the lookup table, the mock embedder generates a random vector with a fixed seed derived from a content hash, ensuring reproducibility.

---

## 15. Performance

### Comparison Costs

| Similarity Method | Time per Pair | Notes |
|-------------------|--------------|-------|
| Exact match | < 0.001ms | String comparison after normalization |
| Jaro-Winkler | < 0.01ms | O(n) where n = string length |
| Levenshtein | < 0.05ms | O(n*m) with row-optimized DP |
| Dice coefficient | < 0.01ms | Bigram set intersection |
| Soundex | < 0.01ms | O(n) encoding + code comparison |
| Metaphone | < 0.01ms | O(n) encoding + Jaro-Winkler on codes |
| Abbreviation | < 0.01ms | Initials extraction + comparison |
| Embedding similarity | 30-100ms | Dominated by embedding API call |
| All string methods | < 0.1ms | Total for one pair without embedding |

### Blocking Effectiveness

| Entity Count | All Pairs (no blocking) | With Prefix + Type Blocking | Reduction |
|-------------|------------------------|----------------------------|-----------|
| 100 | 4,950 | ~500 | 90% |
| 1,000 | 499,500 | ~5,000 | 99% |
| 10,000 | ~50,000,000 | ~50,000 | 99.9% |
| 50,000 | ~1,250,000,000 | ~250,000 | 99.98% |

### End-to-End Resolution Time

Assuming string-only methods (no embedding), prefix + type blocking:

| Entity Count | Candidate Pairs | Scoring Time | Total Time |
|-------------|----------------|-------------|------------|
| 100 | ~500 | < 50ms | < 60ms |
| 1,000 | ~5,000 | < 500ms | < 600ms |
| 10,000 | ~50,000 | < 5s | < 6s |
| 50,000 | ~250,000 | < 25s | < 30s |

With embedding-based similarity enabled, add ~100ms per pair that requires embedding computation. With `embed-cache`, repeated entity names are cached and the cost drops to a dot-product computation (~0.005ms per pair).

### Memory Usage

The resolver stores normalized entity mentions and blocking indexes in memory. Memory usage scales linearly with the number of entities:

| Entity Count | Approximate Memory |
|-------------|-------------------|
| 1,000 | ~2 MB |
| 10,000 | ~20 MB |
| 50,000 | ~100 MB |
| 100,000 | ~200 MB |

If embedding vectors are cached in memory (1536 dimensions per entity), add ~12 KB per entity.

---

## 16. Dependencies

### Runtime Dependencies

**Zero mandatory runtime dependencies.** All similarity algorithms, blocking strategies, transitive closure, merge logic, normalization, and composite scoring are implemented in pure TypeScript.

| Feature | Implementation | Why No Dependency |
|---------|---------------|------------------|
| Jaro-Winkler | ~40 lines of TypeScript | Standard algorithm, no need for `jaro-winkler` npm package |
| Levenshtein | ~30 lines with row optimization | Standard DP algorithm, no need for `fastest-levenshtein` |
| Dice coefficient | ~20 lines (bigram extraction + set intersection) | Trivial algorithm |
| Soundex | ~30 lines | Fixed encoding rules, well-documented |
| Metaphone | ~100 lines | Deterministic rule-based encoding |
| Cosine similarity | ~10 lines (dot product for normalized vectors) | Single loop |
| Union-Find | ~30 lines | Standard data structure |
| Text normalization | ~50 lines | String operations with built-in APIs |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | TypeScript compiler (>= 5.0) |
| `vitest` | Test runner |
| `eslint` | Linter |

### Optional Integration Dependencies

| Package | Purpose |
|---------|---------|
| `embed-cache` | Caching embedding vectors for embedding-based similarity |
| `kg-extract` | Knowledge graph extraction (delegates entity resolution to this package) |
| `memory-dedup` | Semantic deduplication of memory entries |
| `openai` | OpenAI SDK for embedding API calls (caller provides) |
| `cohere-ai` | Cohere SDK for embedding API calls (caller provides) |
| `@xenova/transformers` | Local embedding models (caller provides) |

These are not dependencies of `entity-resolve`. The caller imports them separately and uses them to construct the embedder function.

### Why Zero Dependencies

Entity resolution is an algorithmic problem. Every component -- string similarity metrics, phonetic encodings, blocking strategies, union-find, weighted scoring -- is a well-understood algorithm that can be implemented in 20-100 lines of TypeScript. Adding npm dependencies for these algorithms would increase install size, introduce supply chain risk, add transitive dependency overhead, and constrain compatibility -- all for functionality that is straightforward to implement and test.

The only external computation that `entity-resolve` cannot self-implement is embedding generation. This is deliberately externalized via the `embedder` function interface, keeping the package's dependency footprint at zero while allowing callers to use any embedding source.

---

## 17. File Structure

```
entity-resolve/
  package.json
  tsconfig.json
  SPEC.md
  README.md
  src/
    index.ts                        Public API exports: resolve, resolveIncremental,
                                    similarity, createResolver, types.
    types.ts                        All TypeScript type definitions: EntityMention,
                                    CanonicalEntity, ResolutionResult, MatchPair,
                                    ResolverOptions, ResolverConfig, error classes.
    resolve.ts                      resolve() function: batch resolution pipeline
                                    orchestration (stages 1-6).
    resolve-incremental.ts          resolveIncremental() function: single-entity
                                    matching against an existing entity set.
    resolver.ts                     EntityResolver class: stateful resolver with
                                    addEntity(), resolve(), similarity(), getEntities().
    similarity/
      index.ts                      Composite similarity scorer: orchestrates all
                                    methods, computes weighted average.
      jaro-winkler.ts               Jaro-Winkler distance implementation.
      levenshtein.ts                Levenshtein edit distance with row-optimized DP.
      dice.ts                       Sorensen-Dice coefficient (bigram overlap).
      soundex.ts                    Soundex encoding.
      metaphone.ts                  Metaphone encoding.
      abbreviation.ts               Abbreviation and acronym detection and matching.
      embedding.ts                  Embedding-based cosine similarity (calls embedder).
      cosine.ts                     Cosine similarity computation (dot product for
                                    normalized vectors, full formula otherwise).
    blocking/
      index.ts                      Blocking orchestrator: applies configured strategies,
                                    generates candidate pairs.
      prefix.ts                     Prefix blocking strategy.
      phonetic.ts                   Phonetic blocking (Soundex/Metaphone codes).
      ngram.ts                      N-gram blocking with frequency filtering.
      type.ts                       Type blocking with type hierarchy support.
    pipeline/
      normalize.ts                  Stage 1: entity mention normalization (case,
                                    whitespace, honorifics, corporate suffixes).
      classify.ts                   Stage 4: match classification by threshold.
      transitive.ts                 Stage 5: union-find transitive closure.
    merge/
      index.ts                      Stage 6: entity merging orchestrator.
      name-selection.ts             Canonical name selection strategies
                                    (longest, most-frequent, first-seen, custom).
      alias-collection.ts           Alias consolidation and deduplication.
      property-merge.ts             Property merge strategies
                                    (union, first-wins, most-recent, custom).
    errors.ts                       Error classes: ResolveError, ResolveConfigError,
                                    ResolveEmbeddingError.
  src/__tests__/
    resolve.test.ts                 Full lifecycle integration tests
    similarity/
      jaro-winkler.test.ts
      levenshtein.test.ts
      dice.test.ts
      soundex.test.ts
      metaphone.test.ts
      abbreviation.test.ts
      embedding.test.ts
      composite.test.ts
    blocking/
      prefix.test.ts
      phonetic.test.ts
      ngram.test.ts
      type.test.ts
    pipeline/
      normalize.test.ts
      classify.test.ts
      transitive.test.ts
    merge/
      name-selection.test.ts
      alias-collection.test.ts
      property-merge.test.ts
    incremental/
      add-entity.test.ts
    fixtures/
      entities.ts                   Test entity mentions with known duplicate
                                    and unique relationships.
      mock-embedder.ts              Mock embedder returning predetermined vectors.
  dist/                             Compiled output (generated by tsc, gitignored).
```

---

## 18. Implementation Roadmap

### Phase 1: Core Similarity Methods and Types (v0.1.0)

Implement the type definitions, text normalization, and the primary string similarity methods.

**Deliverables:**
- Type definitions in `types.ts`: `EntityMention`, `CanonicalEntity`, `ResolutionResult`, `MatchPair`, `ResolverOptions`, error classes.
- Text normalization (Stage 1): Unicode NFC, whitespace collapsing, honorific stripping, corporate suffix stripping, punctuation normalization.
- Jaro-Winkler distance implementation.
- Levenshtein edit distance with similarity normalization.
- Sorensen-Dice coefficient.
- Exact match (after normalization).
- `similarity()` function with composite scoring.
- Unit tests for normalization and each similarity method.

### Phase 2: Blocking and Pipeline (v0.2.0)

Add blocking strategies and the full resolution pipeline.

**Deliverables:**
- Prefix blocking strategy.
- Type blocking with built-in type hierarchy.
- Blocking orchestrator producing candidate pairs.
- Soundex and Metaphone encoding.
- Abbreviation matching.
- Match classification (Stage 4) with configurable thresholds.
- Transitive closure (Stage 5) with union-find.
- Entity merging (Stage 6) with longest-name strategy and alias collection.
- `resolve()` function orchestrating all six stages.
- Property merging (union strategy).
- Unit tests for blocking, classification, transitive closure, and merge.
- Integration tests for full pipeline.

### Phase 3: Stateful Resolver and Incremental Resolution (v0.3.0)

Add the factory function, stateful resolver, and incremental entity addition.

**Deliverables:**
- `createResolver()` factory function.
- `EntityResolver` class with `resolve()`, `addEntity()`, `similarity()`, `getEntities()`.
- `resolveIncremental()` function.
- Configuration validation.
- Phonetic blocking and n-gram blocking strategies.
- Additional merge strategies: `most-frequent`, `first-seen`, `first-wins`, `most-recent`.
- Custom blocking function support.
- Unit and integration tests for stateful resolver and incremental resolution.

### Phase 4: Embedding Similarity and Polish (v0.4.0)

Add embedding-based similarity, alias dictionaries, and production hardening.

**Deliverables:**
- Embedding-based cosine similarity method.
- Integration with `embed-cache` (documented, tested).
- Configurable alias dictionaries.
- Custom name selection and property merge functions.
- `transitiveReview` option.
- Edge case hardening: empty inputs, single entity, embedder failures.
- Performance benchmarks.
- Integration tests with `kg-extract` `entityResolver` hook.

### Phase 5: Release (v1.0.0)

Production-ready release with complete documentation and ecosystem integration.

**Deliverables:**
- Complete README with installation, quick start, API reference, and integration examples.
- All configuration options documented with defaults and examples.
- Full test suite passing (unit, integration, edge case).
- Performance benchmarks documented.
- Published npm package with TypeScript declarations.

---

## 19. Example Use Cases

### 19.1 Knowledge Graph Entity Deduplication

A developer builds a knowledge graph from 50 Wikipedia articles about physics using `kg-extract`. The extraction produces 200 entity mentions, many of which are duplicates: "Albert Einstein" (12 mentions), "Einstein" (8 mentions), "A. Einstein" (2 mentions), "Professor Einstein" (1 mention). Without resolution, the graph has 23 separate Einstein nodes with fragmented relationships. With `entity-resolve`, all 23 mentions merge into one canonical "Albert Einstein" entity with a complete set of relationships.

```typescript
import { buildGraph } from 'kg-extract';
import { createResolver } from 'entity-resolve';

const resolver = createResolver({
  autoMergeThreshold: 0.85,
  methods: {
    jaroWinkler: { weight: 0.30 },
    abbreviation: { weight: 0.20 },
    levenshtein: { weight: 0.15 },
    dice: { weight: 0.15 },
    soundex: { weight: 0.05 },
    metaphone: { weight: 0.05 },
  },
});

const graph = await buildGraph(wikiArticles, {
  llm,
  entityResolver: async (entities) => {
    const result = resolver.resolve(entities);
    return { mergeMap: result.mergeMap, entities: result.entities };
  },
});

console.log(graph.stats().nodeCount);  // ~80 (down from ~200 raw mentions)
```

### 19.2 CRM Data Cleanup

A sales team has 5,000 company records in their CRM, many of which are duplicates from different data entry conventions. "International Business Machines", "IBM", "IBM Corp.", and "IBM Corporation" are four separate records. The team exports the records, runs them through `entity-resolve`, and uses the match pairs to identify duplicates for merging:

```typescript
import { resolve } from 'entity-resolve';

const companies = crmRecords.map(r => ({
  name: r.companyName,
  type: 'Organization',
  properties: { crmId: r.id, industry: r.industry },
  source: `crm-${r.id}`,
}));

const result = resolve(companies, {
  autoMergeThreshold: 0.85,
  reviewThreshold: 0.70,
  methods: {
    abbreviation: { weight: 0.30 },  // Heavy abbreviation weight for company names
    jaroWinkler: { weight: 0.25 },
    dice: { weight: 0.20 },
    levenshtein: { weight: 0.15 },
    soundex: { weight: 0.05 },
    metaphone: { weight: 0.05 },
  },
});

console.log(`${result.stats.totalMentions} records → ${result.stats.canonicalEntities} unique companies`);
console.log(`${result.matches.filter(m => m.classification === 'same').length} auto-merge pairs`);
console.log(`${result.matches.filter(m => m.classification === 'possible').length} pairs for manual review`);

// Apply auto-merges to CRM
for (const entity of result.entities) {
  if (entity.mentionCount > 1) {
    const crmIds = entity.mentions.map(m => m.properties?.crmId);
    await crm.mergeRecords(crmIds, { canonicalName: entity.name });
  }
}
```

### 19.3 Document Entity Linking with Incremental Resolution

A news monitoring system processes incoming articles and maintains a canonical entity registry. Each article produces new entity mentions that must be matched against the existing registry:

```typescript
import { createResolver } from 'entity-resolve';

const resolver = createResolver({
  autoMergeThreshold: 0.85,
  aliases: {
    'POTUS': 'President of the United States',
    'UN': 'United Nations',
    'EU': 'European Union',
    'WHO': 'World Health Organization',
    'NYC': 'New York City',
    'UK': 'United Kingdom',
  },
});

// Seed with known entities
const knownEntities = await entityDatabase.getAll();
resolver.resolve(knownEntities);

// Process each incoming article
async function processArticle(article: string) {
  const extracted = await kgExtract.extract(article, { llm });

  for (const entity of extracted.entities) {
    const result = resolver.addEntity(entity);

    if (result.action === 'merged') {
      console.log(`"${entity.name}" resolved to "${result.canonicalEntity.name}"`);
      await entityDatabase.addAlias(result.canonicalEntity.name, entity.name);
    } else {
      console.log(`New entity discovered: "${entity.name}" (${entity.type})`);
      await entityDatabase.create(result.canonicalEntity);
    }
  }
}
```

### 19.4 Cross-Document Coreference for Intelligence Analysis

An analyst processes 1,000 intelligence reports mentioning various persons of interest under different names, nicknames, transliterations, and aliases. Names may be transliterated differently from non-Latin scripts:

```typescript
import { resolve } from 'entity-resolve';

const personMentions = allReports.flatMap(report =>
  report.entities
    .filter(e => e.type === 'Person')
    .map(e => ({ ...e, source: report.id }))
);

const result = resolve(personMentions, {
  autoMergeThreshold: 0.80,
  reviewThreshold: 0.60,
  methods: {
    jaroWinkler: { weight: 0.25 },
    metaphone: { weight: 0.15 },  // Phonetic matching for transliterations
    soundex: { weight: 0.10 },
    dice: { weight: 0.20 },
    levenshtein: { weight: 0.15 },
    abbreviation: { weight: 0.05 },
    embedding: { weight: 0.10, embedder: myEmbedder },
  },
  blocking: ['prefix', 'phonetic', 'type'],
});

// Identify the most-mentioned individuals
const topEntities = result.entities
  .sort((a, b) => b.mentionCount - a.mentionCount)
  .slice(0, 20);

for (const entity of topEntities) {
  const sources = new Set(entity.mentions.map(m => m.source));
  console.log(
    `${entity.name} — ${entity.mentionCount} mentions across ${sources.size} reports`,
    `  Aliases: ${entity.aliases.join(', ')}`,
  );
}

// Pairs flagged for analyst review
const reviewPairs = result.matches.filter(m => m.classification === 'possible');
console.log(`${reviewPairs.length} pairs flagged for manual review`);
```
