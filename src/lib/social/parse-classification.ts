import { SENTIMENT_CATEGORIES, INTENT_CATEGORIES, TOPIC_CATEGORIES, BRAND_ROSTER, isKnownCategory } from './schema'

export interface ParsedClassification {
  sentiment: string | null
  intents: string[]
  topics: string[]
  brands: string[]
  error: string | null
}

interface RawClassification {
  sentiment?: unknown
  intents?: unknown
  topics?: unknown
  brands?: unknown
}

function tryParseJson(candidate: string): RawClassification | null {
  try {
    return JSON.parse(candidate) as RawClassification
  } catch {
    return null
  }
}

function filterKnown(value: unknown, categories: { id: string }[]): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && isKnownCategory(categories, v))
}

function toParsed(raw: RawClassification): ParsedClassification | null {
  if (typeof raw.sentiment !== 'string' || !isKnownCategory(SENTIMENT_CATEGORIES, raw.sentiment)) return null
  return {
    sentiment: raw.sentiment,
    intents: filterKnown(raw.intents, INTENT_CATEGORIES),
    topics: filterKnown(raw.topics, TOPIC_CATEGORIES),
    brands: filterKnown(raw.brands, BRAND_ROSTER),
    error: null,
  }
}

export function parseClassificationText(fullText: string): ParsedClassification {
  const answerMatch = fullText.match(/ANSWER:\s*(\{.*\})\s*$/s)
  if (answerMatch) {
    const parsed = tryParseJson(answerMatch[1])
    if (parsed) {
      const result = toParsed(parsed)
      if (result) return result
    }
  }

  const allBraces = [...fullText.matchAll(/\{[^{}]*\}/g)]
  const last = allBraces[allBraces.length - 1]
  if (last) {
    const parsed = tryParseJson(last[0])
    if (parsed) {
      const result = toParsed(parsed)
      if (result) return result
    }
  }

  return { sentiment: null, intents: [], topics: [], brands: [], error: 'unparseable' }
}
