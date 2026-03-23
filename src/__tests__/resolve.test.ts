import { describe, it, expect } from 'vitest'
import { resolve, similarity, createResolver } from '../resolver.js'
import type { EntityMention } from '../types.js'

describe('resolve', () => {
  it('merges IBM abbreviation with full name', () => {
    const entities: EntityMention[] = [
      { name: 'IBM', type: 'organization' },
      { name: 'International Business Machines', type: 'organization' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
    expect(result.stats.totalMentions).toBe(2)
    expect(result.stats.mentionsMerged).toBe(1)
    expect(result.stats.canonicalEntities).toBe(1)
  })

  it('merges exact duplicates', () => {
    const entities: EntityMention[] = [
      { name: 'John Smith', type: 'person' },
      { name: 'John Smith', type: 'person' },
      { name: 'John Smith', type: 'person' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
    expect(result.entities[0].mentionCount).toBe(3)
  })

  it('does not merge entities of different types', () => {
    const entities: EntityMention[] = [
      { name: 'Apple', type: 'organization' },
      { name: 'Apple', type: 'product' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(2)
  })

  it('keeps distinct entities separate', () => {
    const entities: EntityMention[] = [
      { name: 'Google', type: 'organization' },
      { name: 'Microsoft', type: 'organization' },
      { name: 'Amazon', type: 'organization' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(3)
  })

  it('returns correct stats', () => {
    const entities: EntityMention[] = [
      { name: 'Barack Obama', type: 'person' },
      { name: 'Barack Obama', type: 'person' },
    ]
    const result = resolve(entities)
    expect(result.stats.totalMentions).toBe(2)
    expect(result.stats.candidatePairs).toBeGreaterThanOrEqual(1)
    expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
    expect(result.stats.sameCount).toBeGreaterThanOrEqual(1)
  })

  it('merges with aliases', () => {
    const entities: EntityMention[] = [
      { name: 'United States', type: 'location', aliases: ['USA', 'US'] },
      { name: 'USA', type: 'location' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
  })

  it('handles single entity input', () => {
    const entities: EntityMention[] = [{ name: 'Lonely Corp', type: 'organization' }]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
    expect(result.stats.totalMentions).toBe(1)
    expect(result.stats.mentionsMerged).toBe(0)
  })

  it('handles empty input', () => {
    const result = resolve([])
    expect(result.entities.length).toBe(0)
    expect(result.stats.totalMentions).toBe(0)
  })

  it('applies prefix blocking strategy', () => {
    const entities: EntityMention[] = [
      { name: 'Microsoft', type: 'organization' },
      { name: 'Microsoft Corp', type: 'organization' },
      { name: 'Google', type: 'organization' },
    ]
    const result = resolve(entities, { blocking: ['prefix'] })
    // Microsoft and Microsoft Corp should be in same group; Google separate
    expect(result.entities.length).toBeLessThanOrEqual(2)
  })

  it('normalizes honorifics before comparison', () => {
    const entities: EntityMention[] = [
      { name: 'Dr. Jane Smith', type: 'person' },
      { name: 'Jane Smith', type: 'person' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
  })

  it('propertyMerge union adds new keys from mentions', () => {
    const entities: EntityMention[] = [
      { name: 'Acme Corp', type: 'organization', properties: { country: 'US' } },
      { name: 'Acme Corp', type: 'organization', properties: { founded: 1990 } },
    ]
    const result = resolve(entities, { propertyMerge: 'union' })
    expect(result.entities.length).toBe(1)
    expect(result.entities[0].properties).toHaveProperty('country', 'US')
    expect(result.entities[0].properties).toHaveProperty('founded', 1990)
  })

  it('propertyMerge firstWins ignores new properties from mentions', () => {
    const entities: EntityMention[] = [
      { name: 'Acme Corp', type: 'organization', properties: { country: 'US' } },
      { name: 'Acme Corp', type: 'organization', properties: { country: 'UK', founded: 1990 } },
    ]
    const result = resolve(entities, { propertyMerge: 'firstWins' })
    expect(result.entities.length).toBe(1)
    expect(result.entities[0].properties).toHaveProperty('country', 'US')
    expect(result.entities[0].properties).not.toHaveProperty('founded')
  })

  it('merges FBI abbreviation with stop words in full name', () => {
    const entities: EntityMention[] = [
      { name: 'FBI', type: 'organization' },
      { name: 'Federal Bureau of Investigation', type: 'organization' },
    ]
    const result = resolve(entities)
    expect(result.entities.length).toBe(1)
  })
})

describe('similarity', () => {
  it('returns high score for identical entities', () => {
    const a: EntityMention = { name: 'Google', type: 'organization' }
    const b: EntityMention = { name: 'Google', type: 'organization' }
    const result = similarity(a, b)
    expect(result.score).toBe(1.0)
    expect(result.typesCompatible).toBe(true)
  })

  it('returns 0 score for incompatible types', () => {
    const a: EntityMention = { name: 'Apple', type: 'organization' }
    const b: EntityMention = { name: 'Apple', type: 'fruit' }
    const result = similarity(a, b)
    expect(result.score).toBe(0)
    expect(result.typesCompatible).toBe(false)
  })

  it('returns methodScores with expected keys', () => {
    const a: EntityMention = { name: 'Amazon', type: 'organization' }
    const b: EntityMention = { name: 'Amazone', type: 'organization' }
    const result = similarity(a, b)
    expect(result.methodScores).toHaveProperty('jaroWinkler')
    expect(result.methodScores).toHaveProperty('levenshtein')
    expect(result.methodScores).toHaveProperty('dice')
  })

  it('handles typeHierarchy option', () => {
    const a: EntityMention = { name: 'IBM', type: 'company' }
    const b: EntityMention = { name: 'IBM', type: 'organization' }
    const result = similarity(a, b, { typeHierarchy: { company: 'organization' } })
    expect(result.typesCompatible).toBe(true)
    expect(result.score).toBeGreaterThan(0)
  })
})

describe('createResolver', () => {
  it('addEntity adds new entity when no match', () => {
    const resolver = createResolver({})
    const result = resolver.addEntity({ name: 'Google', type: 'organization' })
    expect(result.action).toBe('added')
    expect(resolver.size).toBe(1)
  })

  it('addEntity merges when duplicate', () => {
    const resolver = createResolver({})
    resolver.addEntity({ name: 'Google', type: 'organization' })
    const result = resolver.addEntity({ name: 'Google', type: 'organization' })
    expect(result.action).toBe('merged')
    expect(resolver.size).toBe(1)
    expect(result.canonicalEntity.mentionCount).toBe(2)
  })

  it('getEntity returns entity by name', () => {
    const resolver = createResolver({})
    resolver.addEntity({ name: 'Tesla', type: 'organization' })
    const entity = resolver.getEntity('Tesla')
    expect(entity).toBeDefined()
    expect(entity?.name).toBe('Tesla')
  })

  it('getEntities returns all entities', () => {
    const resolver = createResolver({})
    resolver.addEntity({ name: 'Alpha', type: 'organization' })
    resolver.addEntity({ name: 'Beta', type: 'organization' })
    expect(resolver.getEntities().length).toBe(2)
  })

  it('reset clears all entities', () => {
    const resolver = createResolver({})
    resolver.addEntity({ name: 'Alpha', type: 'organization' })
    resolver.reset()
    expect(resolver.size).toBe(0)
  })

  it('resolve on resolver clears and resolves batch', () => {
    const resolver = createResolver({})
    resolver.addEntity({ name: 'Existing', type: 'organization' })
    const result = resolver.resolve([
      { name: 'NewCo', type: 'organization' },
      { name: 'NewCo', type: 'organization' },
    ])
    expect(result.entities.length).toBe(1)
  })
})
