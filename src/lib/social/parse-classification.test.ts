import { describe, it, expect } from 'vitest'
import { parseClassificationText } from './parse-classification'

describe('parseClassificationText', () => {
  it('parses a well-formed ANSWER line with all 4 dimensions', () => {
    const text =
      'Reasoning...\nANSWER: {"sentiment": "negative", "intents": ["complaint", "comparison"], "topics": ["app_experience"], "brands": ["PayNow", "QuickPay"]}'
    expect(parseClassificationText(text)).toEqual({
      sentiment: 'negative',
      intents: ['complaint', 'comparison'],
      topics: ['app_experience'],
      brands: ['PayNow', 'QuickPay'],
      error: null,
    })
  })

  it('allows empty intents/topics/brands arrays (a post can mention zero tracked brands)', () => {
    const text = 'ANSWER: {"sentiment": "neutral", "intents": ["other"], "topics": ["general"], "brands": []}'
    expect(parseClassificationText(text)).toEqual({
      sentiment: 'neutral',
      intents: ['other'],
      topics: ['general'],
      brands: [],
      error: null,
    })
  })

  it('drops unknown category ids but keeps the known ones', () => {
    const text = 'ANSWER: {"sentiment": "positive", "intents": ["praise", "made_up_intent"], "topics": ["general"], "brands": ["PayNow", "NotARealBrand"]}'
    const parsed = parseClassificationText(text)
    expect(parsed.intents).toEqual(['praise'])
    expect(parsed.brands).toEqual(['PayNow'])
  })

  it('falls back to the last JSON-looking block when the ANSWER prefix is missing', () => {
    const text = 'Done. {"sentiment": "positive", "intents": ["praise"], "topics": ["general"], "brands": []}'
    expect(parseClassificationText(text).sentiment).toBe('positive')
  })

  it('returns an unparseable error when sentiment is missing or unknown', () => {
    expect(parseClassificationText('ANSWER: {"intents": ["praise"], "topics": [], "brands": []}').error).toBe('unparseable')
    expect(parseClassificationText('ANSWER: {"sentiment": "mixed", "intents": [], "topics": [], "brands": []}').error).toBe('unparseable')
  })

  it('returns an unparseable error when no JSON is found at all', () => {
    expect(parseClassificationText('I refuse to classify this.').error).toBe('unparseable')
  })

  it('treats missing intents/topics/brands fields as empty arrays rather than failing', () => {
    const parsed = parseClassificationText('ANSWER: {"sentiment": "positive"}')
    expect(parsed).toEqual({ sentiment: 'positive', intents: [], topics: [], brands: [], error: null })
  })
})
