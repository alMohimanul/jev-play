/**
 * Batch eval harness for the social-listening classification scenario
 * (sentiment / intent / topic / brand — single-shot classification, no rounds).
 *
 * Requires OPENROUTER_API_KEY in the environment (unless SOCIAL_EVAL_MOCK=1) — JEV is called
 * through OpenRouter's /api/alpha/decisions endpoint, same key as every other engine.
 * export .env.local first: `set -o allexport && source .env.local && set +o allexport`
 *
 * Usage (dry run — prints the plan and a rough cost estimate, spends nothing):
 *   npx tsx scripts/run-social-eval.ts
 *
 * Usage (actually executes, real API spend unless SOCIAL_EVAL_MOCK=1):
 *   SOCIAL_EVAL_CONFIRM=1 SOCIAL_EVAL_TRIALS=3 npx tsx scripts/run-social-eval.ts
 *
 * Env vars:
 *   SOCIAL_EVAL_TRIALS       trials per (message, engine) combo. Default 1.
 *   SOCIAL_EVAL_MESSAGE_IDS  comma-separated message ids to run, or "all". Default "all".
 *   SOCIAL_EVAL_ENGINES      comma-separated engine ids to run, or "all". Default "all".
 *   SOCIAL_EVAL_MOCK         "1" to use the free mock classifiers instead of real APIs. Default unset.
 *   SOCIAL_EVAL_BATCH_ID     groups this run's rows for the results page. Default an auto timestamp id.
 *   SOCIAL_EVAL_CONFIRM      "1" required to actually execute; otherwise this prints the plan and exits.
 *   SOCIAL_EVAL_DB_PATH      where results are written. Default ./data/social-eval.db.
 */

import { SOCIAL_MESSAGES } from '../src/lib/eval/social-messages'
import { runSocialEvalTrial } from '../src/lib/eval/social-harness'
import { insertSocialEvalRun, getSocialEvalSummary } from '../src/lib/eval/social-eval-db'
import { classifyWithJev } from '../src/lib/social/classify-jev'
import { classifyWithOpenRouter } from '../src/lib/social/classify-openrouter'
import { mockClassifyWithJev, mockClassifyWithOpenRouter } from '../src/lib/social/classify-mock'
import { getBaselineModels } from '../src/lib/engines'

// Rough per-classification cost estimates. jev = 4 parallel calls; LLMs = 1 call each.
// Approximate only — actual spend varies with message length and model behavior.
const APPROX_COST_PER_CLASSIFICATION: Record<string, number> = {
  jev: 0.0004,
  'anthropic/claude-sonnet-5': 0.004,
  'anthropic/claude-opus-5': 0.012,
  'openai/gpt-5': 0.002,
  'openai/gpt-6-astra': 0.015,
  'google/gemini-3.7-flash': 0.0015,
  'x-ai/grok-4.5': 0.0025,
  'z-ai/glm-5.3-flashx': 0.002,
  '~deepseek/deepseek-flash-latest': 0.0005,
  '~openai/gpt-luna-latest': 0.0004,
}

function parseList(envVar: string | undefined): string[] | null {
  if (!envVar || envVar === 'all') return null
  return envVar.split(',').map((s) => s.trim())
}

function main() {
  const trials = Number(process.env.SOCIAL_EVAL_TRIALS ?? '1')
  const messageIds = parseList(process.env.SOCIAL_EVAL_MESSAGE_IDS)
  const engineIds = parseList(process.env.SOCIAL_EVAL_ENGINES)
  const mock = process.env.SOCIAL_EVAL_MOCK === '1'
  const confirm = process.env.SOCIAL_EVAL_CONFIRM === '1'
  const batchId = process.env.SOCIAL_EVAL_BATCH_ID ?? `run-${new Date().toISOString().replace(/[:.]/g, '-')}`

  const messages = messageIds ? SOCIAL_MESSAGES.filter((m) => messageIds.includes(m.id)) : SOCIAL_MESSAGES
  const allEngines = ['jev', ...getBaselineModels()]
  const engines = engineIds ? allEngines.filter((e) => engineIds.includes(e)) : allEngines

  const totalCombos = messages.length * trials
  const totalClassifications = totalCombos * engines.length
  const estimatedCost = mock ? 0 : totalCombos * engines.reduce((sum, e) => sum + (APPROX_COST_PER_CLASSIFICATION[e] ?? 0.005), 0)

  console.log(`Social listening eval plan (batch: ${batchId})`)
  console.log(`  messages:   ${messages.length} (${messages.map((m) => m.id).join(', ')})`)
  console.log(`  engines:    ${engines.length} (${engines.join(', ')})`)
  console.log(`  trials:     ${trials}`)
  console.log(`  total classifications: ${totalClassifications}`)
  console.log(`  mode: ${mock ? 'MOCK (free)' : 'REAL API'}`)
  if (!mock) console.log(`  rough estimated cost: $${estimatedCost.toFixed(2)} (approximate, actual may vary)`)

  if (!confirm) {
    console.log('\nDry run only — set SOCIAL_EVAL_CONFIRM=1 to actually execute this plan.')
    return
  }

  runAll({ messages, engines, trials, mock, batchId }).then(() => {
    console.log('\nDone. Summary:')
    const summary = getSocialEvalSummary(batchId)
    for (const row of summary) {
      console.log(
        `  ${row.engine.padEnd(28)} n=${row.count}  sentiment=${(row.sentimentAccuracy * 100).toFixed(0)}%  intentR/P=${(row.avgIntentRecall * 100).toFixed(0)}/${(row.avgIntentPrecision * 100).toFixed(0)}%  topicR/P=${(row.avgTopicRecall * 100).toFixed(0)}/${(row.avgTopicPrecision * 100).toFixed(0)}%  brandR/P=${(row.avgBrandRecall * 100).toFixed(0)}/${(row.avgBrandPrecision * 100).toFixed(0)}%  avgLatency=${(row.avgLatencyMs / 1000).toFixed(2)}s  avgCost=$${row.avgCostUsd.toFixed(5)}  errors=${row.errorCount}`
      )
    }
  })
}

const RETRYABLE_ERROR = /\((429|500|502|503|504|520|521|522|523|524|529)\)/

async function withRetry(classify: () => ReturnType<typeof classifyWithJev>, maxAttempts = 3): ReturnType<typeof classifyWithJev> {
  let outcome = await classify()
  let attempt = 1
  while (!outcome.ok && attempt < maxAttempts && RETRYABLE_ERROR.test(outcome.error)) {
    await new Promise((r) => setTimeout(r, 1500 * attempt))
    outcome = await classify()
    attempt += 1
  }
  return outcome
}

function buildClassifier(engine: string, text: string, mock: boolean): () => ReturnType<typeof classifyWithJev> {
  if (engine === 'jev') {
    const fn = mock ? mockClassifyWithJev : classifyWithJev
    return () => withRetry(() => fn(text))
  }
  const fn = mock ? mockClassifyWithOpenRouter : classifyWithOpenRouter
  return () => withRetry(() => fn(text, engine))
}

async function runAll({
  messages,
  engines,
  trials,
  mock,
  batchId,
}: {
  messages: typeof SOCIAL_MESSAGES
  engines: string[]
  trials: number
  mock: boolean
  batchId: string
}) {
  let done = 0
  const total = messages.length * trials

  for (const message of messages) {
    for (let trial = 0; trial < trials; trial++) {
      const results = await Promise.all(
        engines.map(async (engine) => {
          try {
            const classify = buildClassifier(engine, message.text, mock)
            return await runSocialEvalTrial({ message, engine, classify })
          } catch (err) {
            return {
              messageId: message.id,
              engine,
              sentimentPredicted: null,
              sentimentTruth: message.groundTruth.sentiment,
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
              error: err instanceof Error ? err.message : 'Unexpected eval error',
            }
          }
        })
      )

      for (const result of results) {
        insertSocialEvalRun({ ...result, batchId, messageText: message.text, groundTruth: message.groundTruth, trialIndex: trial })
      }

      done += 1
      console.log(`[${done}/${total}] message ${message.id} trial ${trial} — done`)
    }
  }
}

main()
