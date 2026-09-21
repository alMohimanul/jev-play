import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import type { SocialGroundTruth } from './social-messages'

const instances = new Map<string, Database.Database>()

function resolveDbPath(dbPath?: string): string {
  return dbPath ?? process.env.SOCIAL_EVAL_DB_PATH ?? './data/social-eval.db'
}

function getSocialEvalDb(dbPath?: string): Database.Database {
  const resolved = resolveDbPath(dbPath)
  const cached = instances.get(resolved)
  if (cached) return cached

  fs.mkdirSync(path.dirname(resolved), { recursive: true })
  const db = new Database(resolved)
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_eval_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      message_text TEXT NOT NULL,
      engine TEXT NOT NULL,
      trial_index INTEGER NOT NULL,
      sentiment_predicted TEXT,
      sentiment_truth TEXT NOT NULL,
      sentiment_correct INTEGER NOT NULL,
      intents_predicted TEXT NOT NULL,
      intent_recall REAL NOT NULL,
      intent_precision REAL NOT NULL,
      topics_predicted TEXT NOT NULL,
      topic_recall REAL NOT NULL,
      topic_precision REAL NOT NULL,
      brands_predicted TEXT NOT NULL,
      brand_recall REAL NOT NULL,
      brand_precision REAL NOT NULL,
      ground_truth TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE INDEX IF NOT EXISTS idx_social_eval_runs_batch ON social_eval_runs(batch_id);
    CREATE INDEX IF NOT EXISTS idx_social_eval_runs_message ON social_eval_runs(batch_id, message_id);
  `)

  instances.set(resolved, db)
  return db
}

export interface SocialEvalRunRow {
  batchId: string
  messageId: string
  messageText: string
  engine: string
  trialIndex: number
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
  groundTruth: SocialGroundTruth
  latencyMs: number
  costUsd: number
  error: string | null
}

export function insertSocialEvalRun(row: SocialEvalRunRow, dbPath?: string): void {
  const db = getSocialEvalDb(dbPath)
  db.prepare(
    `INSERT INTO social_eval_runs
      (batch_id, message_id, message_text, engine, trial_index, sentiment_predicted, sentiment_truth, sentiment_correct,
       intents_predicted, intent_recall, intent_precision, topics_predicted, topic_recall, topic_precision,
       brands_predicted, brand_recall, brand_precision, ground_truth, latency_ms, cost_usd, error)
     VALUES (@batchId, @messageId, @messageText, @engine, @trialIndex, @sentimentPredicted, @sentimentTruth, @sentimentCorrect,
       @intentsPredicted, @intentRecall, @intentPrecision, @topicsPredicted, @topicRecall, @topicPrecision,
       @brandsPredicted, @brandRecall, @brandPrecision, @groundTruth, @latencyMs, @costUsd, @error)`
  ).run({
    batchId: row.batchId,
    messageId: row.messageId,
    messageText: row.messageText,
    engine: row.engine,
    trialIndex: row.trialIndex,
    sentimentPredicted: row.sentimentPredicted,
    sentimentTruth: row.sentimentTruth,
    sentimentCorrect: row.sentimentCorrect ? 1 : 0,
    intentsPredicted: JSON.stringify(row.intentsPredicted),
    intentRecall: row.intentRecall,
    intentPrecision: row.intentPrecision,
    topicsPredicted: JSON.stringify(row.topicsPredicted),
    topicRecall: row.topicRecall,
    topicPrecision: row.topicPrecision,
    brandsPredicted: JSON.stringify(row.brandsPredicted),
    brandRecall: row.brandRecall,
    brandPrecision: row.brandPrecision,
    groundTruth: JSON.stringify(row.groundTruth),
    latencyMs: row.latencyMs,
    costUsd: row.costUsd,
    error: row.error,
  })
}

export interface SocialEvalSummaryRow {
  engine: string
  count: number
  errorCount: number
  successRate: number
  sentimentAccuracy: number
  avgIntentRecall: number
  avgIntentPrecision: number
  avgTopicRecall: number
  avgTopicPrecision: number
  avgBrandRecall: number
  avgBrandPrecision: number
  avgLatencyMs: number
  avgCostUsd: number
}

interface RawSocialEvalSummary {
  engine: string
  count: number
  errorCount: number
  sentimentAccuracy: number | null
  avgIntentRecall: number | null
  avgIntentPrecision: number | null
  avgTopicRecall: number | null
  avgTopicPrecision: number | null
  avgBrandRecall: number | null
  avgBrandPrecision: number | null
  avgLatencyMs: number | null
  avgCostUsd: number | null
}

// Accuracy/recall/precision/latency/cost are averaged over successful runs only (WHEN error IS NULL) —
// a provider-side error reflects infrastructure flakiness, not the model's classification judgment,
// and must not silently drag down the reported accuracy. errorCount/successRate report reliability
// as its own, separate, equally-visible number instead.
export function getSocialEvalSummary(batchId: string, dbPath?: string): SocialEvalSummaryRow[] {
  const db = getSocialEvalDb(dbPath)
  const rows = db
    .prepare(
      `SELECT
        engine,
        COUNT(*) AS count,
        SUM(CASE WHEN error IS NOT NULL THEN 1 ELSE 0 END) AS errorCount,
        AVG(CASE WHEN error IS NULL THEN sentiment_correct END) AS sentimentAccuracy,
        AVG(CASE WHEN error IS NULL THEN intent_recall END) AS avgIntentRecall,
        AVG(CASE WHEN error IS NULL THEN intent_precision END) AS avgIntentPrecision,
        AVG(CASE WHEN error IS NULL THEN topic_recall END) AS avgTopicRecall,
        AVG(CASE WHEN error IS NULL THEN topic_precision END) AS avgTopicPrecision,
        AVG(CASE WHEN error IS NULL THEN brand_recall END) AS avgBrandRecall,
        AVG(CASE WHEN error IS NULL THEN brand_precision END) AS avgBrandPrecision,
        AVG(CASE WHEN error IS NULL THEN latency_ms END) AS avgLatencyMs,
        AVG(CASE WHEN error IS NULL THEN cost_usd END) AS avgCostUsd
      FROM social_eval_runs
      WHERE batch_id = ?
      GROUP BY engine
      ORDER BY sentimentAccuracy DESC`
    )
    .all(batchId) as RawSocialEvalSummary[]

  return rows.map((r) => ({
    engine: r.engine,
    count: r.count,
    errorCount: r.errorCount,
    successRate: r.count === 0 ? 0 : (r.count - r.errorCount) / r.count,
    sentimentAccuracy: r.sentimentAccuracy ?? 0,
    avgIntentRecall: r.avgIntentRecall ?? 0,
    avgIntentPrecision: r.avgIntentPrecision ?? 0,
    avgTopicRecall: r.avgTopicRecall ?? 0,
    avgTopicPrecision: r.avgTopicPrecision ?? 0,
    avgBrandRecall: r.avgBrandRecall ?? 0,
    avgBrandPrecision: r.avgBrandPrecision ?? 0,
    avgLatencyMs: r.avgLatencyMs ?? 0,
    avgCostUsd: r.avgCostUsd ?? 0,
  }))
}

export interface SocialEvalBatchRow {
  batchId: string
  count: number
  createdAt: string
}

export function getSocialEvalBatches(dbPath?: string): SocialEvalBatchRow[] {
  const db = getSocialEvalDb(dbPath)
  return db
    .prepare(
      `SELECT batch_id AS batchId, COUNT(*) AS count, MAX(created_at) AS createdAt
       FROM social_eval_runs
       GROUP BY batch_id
       ORDER BY createdAt DESC`
    )
    .all() as SocialEvalBatchRow[]
}

interface RawSocialEvalRun {
  messageId: string
  messageText: string
  engine: string
  trialIndex: number
  sentimentPredicted: string | null
  sentimentTruth: string
  sentimentCorrect: number
  intentsPredicted: string
  intentRecall: number
  intentPrecision: number
  topicsPredicted: string
  topicRecall: number
  topicPrecision: number
  brandsPredicted: string
  brandRecall: number
  brandPrecision: number
  groundTruth: string
  latencyMs: number
  costUsd: number
  error: string | null
}

export function getSocialEvalRunsForMessage(batchId: string, messageId: string, dbPath?: string): SocialEvalRunRow[] {
  const db = getSocialEvalDb(dbPath)
  const rows = db
    .prepare(
      `SELECT
        message_id AS messageId, message_text AS messageText, engine, trial_index AS trialIndex,
        sentiment_predicted AS sentimentPredicted, sentiment_truth AS sentimentTruth, sentiment_correct AS sentimentCorrect,
        intents_predicted AS intentsPredicted, intent_recall AS intentRecall, intent_precision AS intentPrecision,
        topics_predicted AS topicsPredicted, topic_recall AS topicRecall, topic_precision AS topicPrecision,
        brands_predicted AS brandsPredicted, brand_recall AS brandRecall, brand_precision AS brandPrecision,
        ground_truth AS groundTruth, latency_ms AS latencyMs, cost_usd AS costUsd, error
      FROM social_eval_runs
      WHERE batch_id = ? AND message_id = ?
      ORDER BY engine ASC, trial_index ASC`
    )
    .all(batchId, messageId) as RawSocialEvalRun[]

  return rows.map((r) => ({
    batchId,
    messageId: r.messageId,
    messageText: r.messageText,
    engine: r.engine,
    trialIndex: r.trialIndex,
    sentimentPredicted: r.sentimentPredicted,
    sentimentTruth: r.sentimentTruth,
    sentimentCorrect: Boolean(r.sentimentCorrect),
    intentsPredicted: JSON.parse(r.intentsPredicted),
    intentRecall: r.intentRecall,
    intentPrecision: r.intentPrecision,
    topicsPredicted: JSON.parse(r.topicsPredicted),
    topicRecall: r.topicRecall,
    topicPrecision: r.topicPrecision,
    brandsPredicted: JSON.parse(r.brandsPredicted),
    brandRecall: r.brandRecall,
    brandPrecision: r.brandPrecision,
    groundTruth: JSON.parse(r.groundTruth),
    latencyMs: r.latencyMs,
    costUsd: r.costUsd,
    error: r.error,
  }))
}
