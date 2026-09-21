import { describe, it, expect } from 'vitest'
import { SOCIAL_MESSAGES } from './social-messages'
import { SENTIMENT_CATEGORIES, INTENT_CATEGORIES, TOPIC_CATEGORIES, BRAND_ROSTER, isKnownCategory } from '@/lib/social/schema'

describe('SOCIAL_MESSAGES fixture', () => {
  it('has 18 messages with unique ids', () => {
    expect(SOCIAL_MESSAGES).toHaveLength(18)
    const ids = SOCIAL_MESSAGES.map((m) => m.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every ground-truth label is a real, known category', () => {
    for (const message of SOCIAL_MESSAGES) {
      const { groundTruth } = message
      expect(isKnownCategory(SENTIMENT_CATEGORIES, groundTruth.sentiment), `sentiment in message ${message.id}`).toBe(true)
      for (const intent of groundTruth.intents) expect(isKnownCategory(INTENT_CATEGORIES, intent), `intent "${intent}" in message ${message.id}`).toBe(true)
      for (const topic of groundTruth.topics) expect(isKnownCategory(TOPIC_CATEGORIES, topic), `topic "${topic}" in message ${message.id}`).toBe(true)
      for (const brand of groundTruth.brands) expect(isKnownCategory(BRAND_ROSTER, brand), `brand "${brand}" in message ${message.id}`).toBe(true)
    }
  })

  it('every message has at least one intent and one topic', () => {
    for (const message of SOCIAL_MESSAGES) {
      expect(message.groundTruth.intents.length).toBeGreaterThan(0)
      expect(message.groundTruth.topics.length).toBeGreaterThan(0)
    }
  })

  it('includes messages with zero, one, and multiple tracked brands', () => {
    const counts = SOCIAL_MESSAGES.map((m) => m.groundTruth.brands.length)
    expect(counts.some((c) => c === 0)).toBe(true)
    expect(counts.some((c) => c === 1)).toBe(true)
    expect(counts.some((c) => c >= 2)).toBe(true)
  })

  it('includes all 3 sentiment classes', () => {
    const sentiments = new Set(SOCIAL_MESSAGES.map((m) => m.groundTruth.sentiment))
    expect(sentiments).toEqual(new Set(['positive', 'neutral', 'negative']))
  })
})
