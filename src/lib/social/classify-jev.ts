import { SENTIMENT_CATEGORIES, INTENT_CATEGORIES, TOPIC_CATEGORIES, BRAND_ROSTER, NONE_BRAND } from './schema'
import type { ClassificationOutcome } from '@/types'

// Routed through OpenRouter (not TypeSafe's own api.typesafe.ai) so JEV shares the same
// OPENROUTER_API_KEY and real per-call billed cost as every other engine in this app.
const JEV_ENDPOINT = 'https://openrouter.ai/api/alpha/decisions'
const MULTI_LABEL_THRESHOLD = 0.15

function selectMultiLabel(probabilities: Record<string, number>, excludeIds: string[] = []): string[] {
  return Object.entries(probabilities)
    .filter(([id, p]) => p >= MULTI_LABEL_THRESHOLD && !excludeIds.includes(id))
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id)
}

interface JevQuestionAnswer {
  choice: string
  confidence: number
  probabilities: Record<string, number>
}

interface JevQuestionOutcome {
  ok: true
  answer: JevQuestionAnswer
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

interface JevQuestionError {
  ok: false
  error: string
}

async function callJevQuestion(
  text: string,
  dimension: string,
  instructions: string,
  criteria: Record<string, string>
): Promise<JevQuestionOutcome | JevQuestionError> {
  const start = performance.now()
  try {
    const response = await fetch(JEV_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        state: text,
        model: 'jev-latest',
        questions: { [dimension]: { type: 'choice', instructions, criteria } },
      }),
    })
    const latencyMs = Math.round(performance.now() - start)

    if (!response.ok) {
      return { ok: false, error: `JEV request failed (${response.status})` }
    }

    const json = await response.json()
    if (json.error) {
      return { ok: false, error: `JEV request failed (${json.error.code ?? 'unknown'})` }
    }

    const answer = json.answers[dimension] as JevQuestionAnswer
    return {
      ok: true,
      answer,
      inputTokens: json.usage?.input_tokens ?? 0,
      outputTokens: json.usage?.output_tokens ?? 0,
      costUsd: json.usage?.cost ?? 0,
      latencyMs,
    }
  } catch {
    return { ok: false, error: 'JEV request failed unexpectedly' }
  }
}

export async function classifyWithJev(text: string): Promise<ClassificationOutcome> {
  const [sentiment, intent, topic, brand] = await Promise.all([
    callJevQuestion(
      text,
      'sentiment',
      'Overall sentiment of the message toward the brand(s) or topic mentioned.',
      Object.fromEntries(SENTIMENT_CATEGORIES.map((c) => [c.id, c.description]))
    ),
    callJevQuestion(
      text,
      'intent',
      'What is the author trying to do with this message? Judge each independently — a message can have more than one intent.',
      Object.fromEntries(INTENT_CATEGORIES.map((c) => [c.id, c.description]))
    ),
    callJevQuestion(
      text,
      'topic',
      'Which topic(s) does the message discuss? Judge each independently — a message can touch more than one topic.',
      Object.fromEntries(TOPIC_CATEGORIES.map((c) => [c.id, c.description]))
    ),
    callJevQuestion(
      text,
      'brand',
      'Which tracked brand(s), if any, are mentioned? Judge each independently — a message can mention more than one, or none.',
      { ...Object.fromEntries(BRAND_ROSTER.map((c) => [c.id, c.description])), [NONE_BRAND]: 'No tracked brand mentioned.' }
    ),
  ])

  for (const outcome of [sentiment, intent, topic, brand]) {
    if (!outcome.ok) return { ok: false, error: outcome.error }
  }

  const s = sentiment as JevQuestionOutcome
  const i = intent as JevQuestionOutcome
  const t = topic as JevQuestionOutcome
  const b = brand as JevQuestionOutcome

  const inputTokens = s.inputTokens + i.inputTokens + t.inputTokens + b.inputTokens
  const outputTokens = s.outputTokens + i.outputTokens + t.outputTokens + b.outputTokens
  const costUsd = s.costUsd + i.costUsd + t.costUsd + b.costUsd

  return {
    ok: true,
    result: {
      sentiment: s.answer.choice,
      sentimentConfidence: s.answer.confidence,
      sentimentProbabilities: s.answer.probabilities,
      intents: selectMultiLabel(i.answer.probabilities),
      intentProbabilities: i.answer.probabilities,
      topics: selectMultiLabel(t.answer.probabilities),
      topicProbabilities: t.answer.probabilities,
      brands: selectMultiLabel(b.answer.probabilities, [NONE_BRAND]),
      brandProbabilities: b.answer.probabilities,
      latencyMs: Math.max(s.latencyMs, i.latencyMs, t.latencyMs, b.latencyMs),
      costUsd,
      inputTokens,
      outputTokens,
    },
  }
}
