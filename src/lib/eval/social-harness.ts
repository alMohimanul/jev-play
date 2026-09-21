import type { ClassificationOutcome } from '@/types'
import type { SocialMessage } from './social-messages'

export interface RecallPrecision {
  recall: number
  precision: number
}

export function computeRecallPrecision(predicted: string[], groundTruth: string[]): RecallPrecision {
  const truthSet = new Set(groundTruth)
  const intersection = predicted.filter((t) => truthSet.has(t))
  const recall = groundTruth.length === 0 ? 1 : intersection.length / groundTruth.length
  const precision = predicted.length === 0 ? (groundTruth.length === 0 ? 1 : 0) : intersection.length / predicted.length
  return { recall, precision }
}

export interface LabelOutcome {
  correct: string[]
  missing: string[]
  extra: string[]
}

export function classifyLabels(predicted: string[], groundTruth: string[]): LabelOutcome {
  const truthSet = new Set(groundTruth)
  const predictedSet = new Set(predicted)
  return {
    correct: predicted.filter((p) => truthSet.has(p)),
    missing: groundTruth.filter((t) => !predictedSet.has(t)),
    extra: predicted.filter((p) => !truthSet.has(p)),
  }
}

export interface SocialEvalTrialResult {
  messageId: string
  engine: string
  sentimentPredicted: string | null
  sentimentTruth: string
  sentimentCorrect: boolean
  intentsPredicted: string[]
  intentRecall: number
  intentPrecision: number
  topicsPredicted: string[]
  topicRecall: number
  topicPrecision: number
  brandsPredicted: string[]
  brandRecall: number
  brandPrecision: number
  latencyMs: number
  costUsd: number
  inputTokens: number | null
  outputTokens: number | null
  error: string | null
}

export async function runSocialEvalTrial({
  message,
  engine,
  classify,
}: {
  message: SocialMessage
  engine: string
  classify: () => Promise<ClassificationOutcome>
}): Promise<SocialEvalTrialResult> {
  const outcome = await classify()
  const { groundTruth } = message

  if (!outcome.ok) {
    return {
      messageId: message.id,
      engine,
      sentimentPredicted: null,
      sentimentTruth: groundTruth.sentiment,
      sentimentCorrect: false,
      intentsPredicted: [],
      intentRecall: 0,
      intentPrecision: 0,
      topicsPredicted: [],
      topicRecall: 0,
      topicPrecision: 0,
      brandsPredicted: [],
      brandRecall: 0,
      brandPrecision: 0,
      latencyMs: 0,
      costUsd: 0,
      inputTokens: null,
      outputTokens: null,
      error: outcome.error,
    }
  }

  const { result } = outcome
  const intent = computeRecallPrecision(result.intents, groundTruth.intents)
  const topic = computeRecallPrecision(result.topics, groundTruth.topics)
  const brand = computeRecallPrecision(result.brands, groundTruth.brands)

  return {
    messageId: message.id,
    engine,
    sentimentPredicted: result.sentiment,
    sentimentTruth: groundTruth.sentiment,
    sentimentCorrect: result.sentiment === groundTruth.sentiment,
    intentsPredicted: result.intents,
    intentRecall: intent.recall,
    intentPrecision: intent.precision,
    topicsPredicted: result.topics,
    topicRecall: topic.recall,
    topicPrecision: topic.precision,
    brandsPredicted: result.brands,
    brandRecall: brand.recall,
    brandPrecision: brand.precision,
    latencyMs: result.latencyMs,
    costUsd: result.costUsd,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    error: null,
  }
}
