import { BRAND_ROSTER } from './schema'
import type { ClassificationOutcome, ClassificationResult } from '@/types'

function fakeDelayMs(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

function detectBrands(text: string): string[] {
  return BRAND_ROSTER.filter((b) => text.toLowerCase().includes(b.id.toLowerCase())).map((b) => b.id)
}

function detectSentiment(text: string): string {
  const lower = text.toLowerCase()
  if (/great|love|best|impressive|generous|recommend|clean|convenient|good/.test(lower)) return 'positive'
  if (/crash|frustrat|annoy|unacceptable|scam|never using|ridiculous|so annoying|hold|didn't/.test(lower)) return 'negative'
  return 'neutral'
}

function detectIntents(text: string): string[] {
  const lower = text.toLowerCase()
  const intents: string[] = []
  if (/\?|does anyone|is this|need advice|better for/.test(lower)) intents.push('inquiry')
  if (/crash|frustrat|annoy|unacceptable|never using|ridiculous|can't/.test(lower)) intents.push('complaint')
  if (/great|love|impressive|clean|generous/.test(lower)) intents.push('praise')
  if (/better than|worse than|versus|compared|comparing/.test(lower)) intents.push('comparison')
  if (/recommend/.test(lower)) intents.push('recommendation')
  if (/thinking about signing up|switch/.test(lower)) intents.push('purchase_intent')
  if (/offer|cashback|new feature|new bill payment/.test(lower)) intents.push('promotion')
  return intents.length > 0 ? intents : ['other']
}

function detectTopics(text: string): string[] {
  const lower = text.toLowerCase()
  const topics: string[] = []
  if (/app|crash|redesign/.test(lower)) topics.push('app_experience')
  if (/customer service|hold|support/.test(lower)) topics.push('customer_service')
  if (/pending|transfer|maintenance|delayed/.test(lower)) topics.push('transaction_issue')
  if (/fee|charge/.test(lower)) topics.push('fees_charges')
  if (/otp|scam|fraud|suspicious|login/.test(lower)) topics.push('security_fraud')
  if (/cashback|offer/.test(lower)) topics.push('rewards_offers')
  if (/log ?in|kyc|account/.test(lower)) topics.push('account_access')
  if (/agent/.test(lower)) topics.push('agent_network')
  if (/abroad|remittance|exchange rate/.test(lower)) topics.push('remittance')
  if (/bill|tuition/.test(lower)) topics.push('bill_payment')
  return topics.length > 0 ? topics : ['general']
}

function fakeResult(text: string): ClassificationResult {
  return {
    sentiment: detectSentiment(text),
    sentimentConfidence: 0.8,
    sentimentProbabilities: null,
    intents: detectIntents(text),
    intentProbabilities: null,
    topics: detectTopics(text),
    topicProbabilities: null,
    brands: detectBrands(text),
    brandProbabilities: null,
    latencyMs: 0,
    costUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
  }
}

export async function mockClassifyWithJev(text: string): Promise<ClassificationOutcome> {
  const start = performance.now()
  await new Promise((r) => setTimeout(r, fakeDelayMs(20, 60)))
  return { ok: true, result: { ...fakeResult(text), latencyMs: Math.round(performance.now() - start), costUsd: 0.000002, inputTokens: 45, outputTokens: 6 } }
}

export async function mockClassifyWithOpenRouter(text: string, _model: string): Promise<ClassificationOutcome> {
  const start = performance.now()
  await new Promise((r) => setTimeout(r, fakeDelayMs(80, 200)))
  const result = fakeResult(text)
  return {
    ok: true,
    result: { ...result, intentProbabilities: null, topicProbabilities: null, brandProbabilities: null, latencyMs: Math.round(performance.now() - start), costUsd: 0.0011, inputTokens: 200, outputTokens: 40 },
  }
}

