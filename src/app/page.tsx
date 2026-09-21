import { getSocialEvalBatches, getSocialEvalSummary, getSocialEvalRunsForMessage } from '@/lib/eval/social-eval-db'
import { classifyLabels } from '@/lib/eval/social-harness'
import { SOCIAL_MESSAGES } from '@/lib/eval/social-messages'
import { getEngineLabel, getEngineColor } from '@/lib/engines'
import { getCategoryLabel, INTENT_CATEGORIES, TOPIC_CATEGORIES, BRAND_ROSTER } from '@/lib/social/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="metric-bar">
      <div className="metric-bar__fill" style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />
    </div>
  )
}

function LabelChips({ predicted, groundTruth, categories }: { predicted: string[]; groundTruth: string[]; categories: { id: string; label: string }[] }) {
  const { correct, missing, extra } = classifyLabels(predicted, groundTruth)
  if (correct.length === 0 && missing.length === 0 && extra.length === 0) {
    return <span className="detail-chip detail-chip--muted">none</span>
  }
  return (
    <span className="detail-chips">
      {correct.map((id) => (
        <span key={`c-${id}`} className="detail-chip detail-chip--correct">
          {getCategoryLabel(categories, id)}
        </span>
      ))}
      {extra.map((id) => (
        <span key={`e-${id}`} className="detail-chip detail-chip--extra">
          {getCategoryLabel(categories, id)}
        </span>
      ))}
      {missing.map((id) => (
        <span key={`m-${id}`} className="detail-chip detail-chip--missing">
          missed: {getCategoryLabel(categories, id)}
        </span>
      ))}
    </span>
  )
}

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  const { batch } = await searchParams
  const batches = getSocialEvalBatches()
  const batchId = batch ?? batches[0]?.batchId
  const summary = batchId ? getSocialEvalSummary(batchId) : []

  const jev = summary.find((s) => s.engine === 'jev')
  const llms = summary.filter((s) => s.engine !== 'jev')
  const avgOf = (fn: (s: (typeof summary)[number]) => number) => (llms.length === 0 ? 0 : llms.reduce((sum, s) => sum + fn(s), 0) / llms.length)
  const llmAvgAccuracy = avgOf((s) => (s.sentimentAccuracy + s.avgIntentRecall + s.avgTopicRecall + s.avgBrandRecall) / 4)
  const jevAccuracy = jev ? (jev.sentimentAccuracy + jev.avgIntentRecall + jev.avgTopicRecall + jev.avgBrandRecall) / 4 : 0
  const llmAvgCost = avgOf((s) => s.avgCostUsd)
  const llmAvgLatency = avgOf((s) => s.avgLatencyMs)
  const costMultiplier = jev && jev.avgCostUsd > 0 ? llmAvgCost / jev.avgCostUsd : null
  const speedMultiplier = jev && jev.avgLatencyMs > 0 ? llmAvgLatency / jev.avgLatencyMs : null

  return (
    <main className="results">
      <div className="results__hero">
        <span className="results__eyebrow">JEV vs 7 LLMs</span>
        <h1>Social Listening Classification</h1>
        <p className="results__subtitle">
          Sentiment, intent, topic, and brand detection — bounded multi-label classification, single-shot, no reasoning loops.
        </p>
      </div>

      {summary.length === 0 && (
        <p className="eval-empty">
          No eval runs yet. Run <code>npx tsx scripts/run-social-eval.ts</code> (see the script header for options) to populate this page.
        </p>
      )}

      {summary.length > 0 && (
        <>
          <div className="results__stat-cards">
            <div className="stat-card stat-card--jev">
              <span className="stat-card__label">JEV accuracy (avg across 4 dimensions)</span>
              <span className="stat-card__value">{pct(jevAccuracy)}</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__label">LLM average accuracy</span>
              <span className="stat-card__value">{pct(llmAvgAccuracy)}</span>
            </div>
            {costMultiplier && (
              <div className="stat-card stat-card--jev">
                <span className="stat-card__label">JEV is cheaper by</span>
                <span className="stat-card__value">{costMultiplier.toFixed(0)}x</span>
              </div>
            )}
            {speedMultiplier && (
              <div className="stat-card stat-card--jev">
                <span className="stat-card__label">JEV is faster by</span>
                <span className="stat-card__value">{speedMultiplier.toFixed(1)}x</span>
              </div>
            )}
          </div>

          <div className="results__table-wrap">
            <table className="results__table">
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Sentiment</th>
                  <th>Intent R/P</th>
                  <th>Topic R/P</th>
                  <th>Brand R/P</th>
                  <th>Latency</th>
                  <th>Cost</th>
                  <th>Reliability</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((row) => {
                  const color = getEngineColor(row.engine)
                  const isJev = row.engine === 'jev'
                  return (
                    <tr key={row.engine} className={isJev ? 'results__row results__row--jev' : 'results__row'}>
                      <td className="results__engine" style={{ color }}>
                        {getEngineLabel(row.engine)}
                      </td>
                      <td>
                        <Bar value={row.sentimentAccuracy} color={color} />
                        <span className="results__cell-label">{pct(row.sentimentAccuracy)}</span>
                      </td>
                      <td>
                        <Bar value={row.avgIntentRecall} color={color} />
                        <span className="results__cell-label">
                          {pct(row.avgIntentRecall)} / {pct(row.avgIntentPrecision)}
                        </span>
                      </td>
                      <td>
                        <Bar value={row.avgTopicRecall} color={color} />
                        <span className="results__cell-label">
                          {pct(row.avgTopicRecall)} / {pct(row.avgTopicPrecision)}
                        </span>
                      </td>
                      <td>
                        <Bar value={row.avgBrandRecall} color={color} />
                        <span className="results__cell-label">
                          {pct(row.avgBrandRecall)} / {pct(row.avgBrandPrecision)}
                        </span>
                      </td>
                      <td className="results__mono">{(row.avgLatencyMs / 1000).toFixed(2)}s</td>
                      <td className="results__mono">${row.avgCostUsd.toFixed(5)}</td>
                      <td className={row.successRate < 0.9 ? 'results__mono results__reliability--low' : 'results__mono'}>
                        {pct(row.successRate)}
                        {row.errorCount > 0 && <span className="results__cell-label">{row.errorCount} errored</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="results__footnote">
            {summary[0]?.count ?? 0} classifications per engine · 18 synthetic mobile-money/fintech social posts, fictional brand
            names · single-shot bounded classification (no iterative rounds) · accuracy/recall/precision/latency/cost are
            averaged over successful responses only — a provider-side error (rate limit, timeout, unparseable response) counts
            against reliability, not classification accuracy · batch <code>{batchId}</code>
          </p>

          <h2 className="results__detail-heading">Per-message classifications</h2>
          {SOCIAL_MESSAGES.map((message) => {
            const runs = batchId ? getSocialEvalRunsForMessage(batchId, message.id) : []
            if (runs.length === 0) return null
            return (
              <details key={message.id} className="detail-message">
                <summary className="detail-message__summary">
                  #{message.id} — {message.text}
                </summary>
                <p className="detail-message__truth">
                  Ground truth: <strong>{message.groundTruth.sentiment}</strong> ·{' '}
                  {message.groundTruth.intents.map((i) => getCategoryLabel(INTENT_CATEGORIES, i)).join(', ')} ·{' '}
                  {message.groundTruth.topics.map((t) => getCategoryLabel(TOPIC_CATEGORIES, t)).join(', ')} ·{' '}
                  {message.groundTruth.brands.length > 0 ? message.groundTruth.brands.join(', ') : 'no brand'}
                </p>
                <div className="results__table-wrap">
                  <table className="results__table">
                    <thead>
                      <tr>
                        <th>Engine</th>
                        <th>Trial</th>
                        <th>Sentiment</th>
                        <th>Intents</th>
                        <th>Topics</th>
                        <th>Brands</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runs.map((run) => (
                        <tr key={`${run.engine}-${run.trialIndex}`}>
                          <td className="results__engine" style={{ color: getEngineColor(run.engine) }}>
                            {getEngineLabel(run.engine)}
                          </td>
                          <td className="results__mono">{run.trialIndex}</td>
                          <td>
                            {run.error ? (
                              <span className="detail-chip detail-chip--error">{run.error}</span>
                            ) : (
                              <span className={run.sentimentCorrect ? 'detail-chip detail-chip--correct' : 'detail-chip detail-chip--extra'}>
                                {run.sentimentPredicted ?? 'none'}
                              </span>
                            )}
                          </td>
                          <td>{!run.error && <LabelChips predicted={run.intentsPredicted} groundTruth={run.groundTruth.intents} categories={INTENT_CATEGORIES} />}</td>
                          <td>{!run.error && <LabelChips predicted={run.topicsPredicted} groundTruth={run.groundTruth.topics} categories={TOPIC_CATEGORIES} />}</td>
                          <td>{!run.error && <LabelChips predicted={run.brandsPredicted} groundTruth={run.groundTruth.brands} categories={BRAND_ROSTER} />}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )
          })}
        </>
      )}
    </main>
  )
}
