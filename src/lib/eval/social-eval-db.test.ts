import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { insertSocialEvalRun, getSocialEvalSummary, getSocialEvalBatches, getSocialEvalRunsForMessage } from './social-eval-db'
import type { SocialEvalRunRow } from './social-eval-db'

function tempDbPath(): string {
  return path.join(os.tmpdir(), `social-eval-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
}

function makeRow(overrides: Partial<SocialEvalRunRow> = {}): SocialEvalRunRow {
  return {
    batchId: 'batch-1',
    messageId: '1',
    messageText: "PayNow's app crashed.",
    engine: 'jev',
    trialIndex: 0,
    sentimentPredicted: 'negative',
    sentimentTruth: 'negative',
    sentimentCorrect: true,
    intentsPredicted: ['complaint'],
    intentRecall: 1,
    intentPrecision: 1,
    topicsPredicted: ['app_experience'],
    topicRecall: 1,
    topicPrecision: 1,
    brandsPredicted: ['PayNow'],
    brandRecall: 1,
    brandPrecision: 1,
    groundTruth: { sentiment: 'negative', intents: ['complaint'], topics: ['app_experience'], brands: ['PayNow'] },
    latencyMs: 100,
    costUsd: 0.0001,
    error: null,
    ...overrides,
  }
}

describe('social-eval-db', () => {
  const paths: string[] = []
  afterEach(() => {
    for (const p of paths.splice(0)) fs.rmSync(p, { force: true })
  })

  it('inserts runs and aggregates accuracy/recall/precision/latency/cost by engine', () => {
    const dbPath = tempDbPath()
    paths.push(dbPath)

    insertSocialEvalRun(makeRow({ trialIndex: 0, sentimentCorrect: true, intentRecall: 1, latencyMs: 40, costUsd: 0.0001 }), dbPath)
    insertSocialEvalRun(makeRow({ trialIndex: 1, sentimentCorrect: false, intentRecall: 0.5, latencyMs: 60, costUsd: 0.0002 }), dbPath)
    insertSocialEvalRun(makeRow({ engine: 'openai/gpt-5', trialIndex: 0, sentimentCorrect: true, intentRecall: 1, latencyMs: 2000, costUsd: 0.01 }), dbPath)

    const summary = getSocialEvalSummary('batch-1', dbPath)
    const jev = summary.find((s) => s.engine === 'jev')!
    expect(jev.count).toBe(2)
    expect(jev.successRate).toBe(1)
    expect(jev.sentimentAccuracy).toBeCloseTo(0.5, 10)
    expect(jev.avgIntentRecall).toBeCloseTo(0.75, 10)
    expect(jev.avgLatencyMs).toBeCloseTo(50, 10)
    expect(jev.avgCostUsd).toBeCloseTo(0.00015, 10)

    const gpt5 = summary.find((s) => s.engine === 'openai/gpt-5')!
    expect(gpt5.count).toBe(1)
    expect(gpt5.sentimentAccuracy).toBe(1)
  })

  it('lists distinct batches with row counts', () => {
    const dbPath = tempDbPath()
    paths.push(dbPath)
    insertSocialEvalRun(makeRow({ batchId: 'batch-1' }), dbPath)
    insertSocialEvalRun(makeRow({ batchId: 'batch-1' }), dbPath)
    insertSocialEvalRun(makeRow({ batchId: 'batch-2' }), dbPath)

    const batches = getSocialEvalBatches(dbPath)
    expect(batches.find((b) => b.batchId === 'batch-1')?.count).toBe(2)
    expect(batches.find((b) => b.batchId === 'batch-2')?.count).toBe(1)
  })

  it('returns every run for a specific message with full ground truth and predictions', () => {
    const dbPath = tempDbPath()
    paths.push(dbPath)
    insertSocialEvalRun(makeRow({ messageId: '7', engine: 'jev' }), dbPath)
    insertSocialEvalRun(makeRow({ messageId: '7', engine: 'openai/gpt-5' }), dbPath)
    insertSocialEvalRun(makeRow({ messageId: '8', engine: 'jev' }), dbPath)

    const runs = getSocialEvalRunsForMessage('batch-1', '7', dbPath)
    expect(runs).toHaveLength(2)
    expect(runs[0].groundTruth).toEqual({ sentiment: 'negative', intents: ['complaint'], topics: ['app_experience'], brands: ['PayNow'] })
    expect(runs[0].intentsPredicted).toEqual(['complaint'])
  })

  it('tracks error count and success rate separately per engine, without letting errors drag down accuracy', () => {
    const dbPath = tempDbPath()
    paths.push(dbPath)
    // An errored row would score as a total failure (recall 0, incorrect) if it leaked into the
    // accuracy average — it must not, since an error reflects infrastructure, not the model's judgment.
    insertSocialEvalRun(makeRow({ trialIndex: 0, sentimentPredicted: null, sentimentCorrect: false, intentRecall: 0, latencyMs: 0, costUsd: 0, error: 'Request failed (500)' }), dbPath)
    insertSocialEvalRun(makeRow({ trialIndex: 1, sentimentCorrect: true, intentRecall: 1, latencyMs: 50, costUsd: 0.0001 }), dbPath)

    const summary = getSocialEvalSummary('batch-1', dbPath)
    const jev = summary.find((s) => s.engine === 'jev')!
    expect(jev.count).toBe(2)
    expect(jev.errorCount).toBe(1)
    expect(jev.successRate).toBeCloseTo(0.5, 10)
    expect(jev.sentimentAccuracy).toBe(1)
    expect(jev.avgIntentRecall).toBe(1)
    expect(jev.avgLatencyMs).toBe(50)
    expect(jev.avgCostUsd).toBeCloseTo(0.0001, 10)
  })

  it('falls back to zeroed accuracy fields, rather than null, when every run for an engine errored', () => {
    const dbPath = tempDbPath()
    paths.push(dbPath)
    insertSocialEvalRun(makeRow({ sentimentPredicted: null, sentimentCorrect: false, intentRecall: 0, latencyMs: 0, costUsd: 0, error: 'Request failed (500)' }), dbPath)

    const summary = getSocialEvalSummary('batch-1', dbPath)
    const jev = summary.find((s) => s.engine === 'jev')!
    expect(jev.successRate).toBe(0)
    expect(jev.sentimentAccuracy).toBe(0)
    expect(jev.avgIntentRecall).toBe(0)
    expect(jev.avgLatencyMs).toBe(0)
    expect(jev.avgCostUsd).toBe(0)
  })
})
