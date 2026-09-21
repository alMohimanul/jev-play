import { describe, it, expect } from 'vitest'
import { computeRecallPrecision, classifyLabels, runSocialEvalTrial } from './social-harness'
import type { ClassificationOutcome } from '@/types'

describe('classifyLabels', () => {
  it('splits predicted labels into correct and extra, and finds missing ground-truth labels', () => {
    expect(classifyLabels(['a', 'c'], ['a', 'b'])).toEqual({ correct: ['a'], missing: ['b'], extra: ['c'] })
  })

  it('is all-correct, nothing missing or extra, on a perfect match', () => {
    expect(classifyLabels(['a', 'b'], ['a', 'b'])).toEqual({ correct: ['a', 'b'], missing: [], extra: [] })
  })

  it('handles an empty ground truth correctly predicted as empty', () => {
    expect(classifyLabels([], [])).toEqual({ correct: [], missing: [], extra: [] })
  })
})

describe('computeRecallPrecision', () => {
  it('is 1/1 on an exact match', () => {
    expect(computeRecallPrecision(['a', 'b'], ['a', 'b'])).toEqual({ recall: 1, precision: 1 })
  })

  it('penalizes recall for a missed label and precision for an extra one', () => {
    expect(computeRecallPrecision(['a', 'c'], ['a', 'b'])).toEqual({ recall: 0.5, precision: 0.5 })
  })

  it('treats an empty ground truth correctly predicted as empty as a perfect score', () => {
    expect(computeRecallPrecision([], [])).toEqual({ recall: 1, precision: 1 })
  })

  it('penalizes precision (not recall) for a false positive against an empty ground truth', () => {
    expect(computeRecallPrecision(['PayNow'], [])).toEqual({ recall: 1, precision: 0 })
  })

  it('zeroes both when something was expected but nothing was predicted', () => {
    expect(computeRecallPrecision([], ['PayNow'])).toEqual({ recall: 0, precision: 0 })
  })
})

describe('runSocialEvalTrial', () => {
  const message = {
    id: '1',
    text: "PayNow's app crashed during a transfer, way worse than QuickPay.",
    groundTruth: { sentiment: 'negative', intents: ['complaint', 'comparison'], topics: ['app_experience'], brands: ['PayNow', 'QuickPay'] },
  }

  it('scores a fully correct classification as perfect across all 4 dimensions', async () => {
    const classify = async (): Promise<ClassificationOutcome> => ({
      ok: true,
      result: {
        sentiment: 'negative',
        sentimentConfidence: 0.9,
        sentimentProbabilities: null,
        intents: ['complaint', 'comparison'],
        intentProbabilities: null,
        topics: ['app_experience'],
        topicProbabilities: null,
        brands: ['PayNow', 'QuickPay'],
        brandProbabilities: null,
        latencyMs: 100,
        costUsd: 0.001,
        inputTokens: 50,
        outputTokens: 10,
      },
    })

    const result = await runSocialEvalTrial({ message, engine: 'jev', classify })

    expect(result.sentimentCorrect).toBe(true)
    expect(result.intentRecall).toBe(1)
    expect(result.intentPrecision).toBe(1)
    expect(result.topicRecall).toBe(1)
    expect(result.brandRecall).toBe(1)
    expect(result.error).toBeNull()
  })

  it('scores a partially wrong classification proportionally', async () => {
    const classify = async (): Promise<ClassificationOutcome> => ({
      ok: true,
      result: {
        sentiment: 'neutral',
        sentimentConfidence: 0.6,
        sentimentProbabilities: null,
        intents: ['complaint'],
        intentProbabilities: null,
        topics: ['app_experience', 'fees_charges'],
        topicProbabilities: null,
        brands: ['PayNow'],
        brandProbabilities: null,
        latencyMs: 200,
        costUsd: 0.002,
        inputTokens: 60,
        outputTokens: 15,
      },
    })

    const result = await runSocialEvalTrial({ message, engine: 'openai/gpt-5', classify })

    expect(result.sentimentCorrect).toBe(false)
    expect(result.intentRecall).toBe(0.5)
    expect(result.intentPrecision).toBe(1)
    expect(result.topicRecall).toBe(1)
    expect(result.topicPrecision).toBe(0.5)
    expect(result.brandRecall).toBe(0.5)
    expect(result.brandPrecision).toBe(1)
  })

  it('returns a zeroed, errored result when the classifier fails', async () => {
    const classify = async (): Promise<ClassificationOutcome> => ({ ok: false, error: 'Request failed (500)' })

    const result = await runSocialEvalTrial({ message, engine: 'openai/gpt-5', classify })

    expect(result.error).toBe('Request failed (500)')
    expect(result.sentimentCorrect).toBe(false)
    expect(result.intentRecall).toBe(0)
    expect(result.topicRecall).toBe(0)
    expect(result.brandRecall).toBe(0)
  })
})
