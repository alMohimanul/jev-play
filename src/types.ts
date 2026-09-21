export type EngineId = string

export interface EngineInfo {
  id: EngineId
  label: string
}

export interface ErrorPayload {
  engine: EngineId
  message: string
}

export interface ClassificationResult {
  sentiment: string | null
  sentimentConfidence: number | null
  sentimentProbabilities: Record<string, number> | null
  intents: string[]
  intentProbabilities: Record<string, number> | null
  topics: string[]
  topicProbabilities: Record<string, number> | null
  brands: string[]
  brandProbabilities: Record<string, number> | null
  latencyMs: number
  costUsd: number
  inputTokens: number | null
  outputTokens: number | null
}

export type ClassificationOutcome = { ok: true; result: ClassificationResult } | { ok: false; error: string }
