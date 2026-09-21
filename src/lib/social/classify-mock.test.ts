import { describe, it, expect } from 'vitest'
import { mockClassifyWithJev, mockClassifyWithOpenRouter } from './classify-mock'

describe('mock social classifiers', () => {
  it('detects a mentioned brand and a negative-sounding complaint', async () => {
    const outcome = await mockClassifyWithJev("PayNow's app crashed twice today, so frustrating.")
    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.brands).toEqual(['PayNow'])
      expect(outcome.result.sentiment).toBe('negative')
      expect(outcome.result.intents).toContain('complaint')
      expect(outcome.result.topics).toContain('app_experience')
    }
  })

  it('returns an empty brands list when no tracked brand is mentioned', async () => {
    const outcome = await mockClassifyWithOpenRouter('mobile banking is convenient these days', 'openai/gpt-5')
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.result.brands).toEqual([])
  })
})
