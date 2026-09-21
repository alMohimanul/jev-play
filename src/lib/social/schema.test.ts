import { describe, it, expect } from 'vitest'
import {
  SENTIMENT_CATEGORIES,
  INTENT_CATEGORIES,
  TOPIC_CATEGORIES,
  BRAND_ROSTER,
  getCategoryLabel,
  isKnownCategory,
} from './schema'

function expectUniqueIds(categories: { id: string }[]) {
  const ids = categories.map((c) => c.id)
  expect(new Set(ids).size).toBe(ids.length)
}

describe('social listening schema', () => {
  it('sentiment is exactly the 3 standard classes', () => {
    expect(SENTIMENT_CATEGORIES.map((c) => c.id)).toEqual(['positive', 'neutral', 'negative'])
  })

  it('has unique ids within each category list', () => {
    expectUniqueIds(SENTIMENT_CATEGORIES)
    expectUniqueIds(INTENT_CATEGORIES)
    expectUniqueIds(TOPIC_CATEGORIES)
    expectUniqueIds(BRAND_ROSTER)
  })

  it('has a reasonable number of categories per dimension', () => {
    expect(INTENT_CATEGORIES.length).toBeGreaterThanOrEqual(6)
    expect(TOPIC_CATEGORIES.length).toBeGreaterThanOrEqual(8)
    expect(BRAND_ROSTER.length).toBeGreaterThanOrEqual(4)
  })

  it('resolves a known category to its label, and falls back to the raw id otherwise', () => {
    expect(getCategoryLabel(INTENT_CATEGORIES, 'complaint')).toBe('Complaint')
    expect(getCategoryLabel(INTENT_CATEGORIES, 'does_not_exist')).toBe('does_not_exist')
    expect(isKnownCategory(BRAND_ROSTER, 'PayNow')).toBe(true)
    expect(isKnownCategory(BRAND_ROSTER, 'RealBrandXYZ')).toBe(false)
  })
})
