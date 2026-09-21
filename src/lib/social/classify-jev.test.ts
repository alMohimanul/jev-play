import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyWithJev } from './classify-jev'

function jevResponse(dimension: string, choice: string, confidence: number, probabilities: Record<string, number>, inputTokens = 40, outputTokens = 5, cost = 0.00001) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model: 'typesafe/jev-1.13-20260917',
      provider: 'TypeSafe',
      answers: { [dimension]: { type: 'choice', choice, confidence, probabilities } },
      usage: { input_tokens: inputTokens, output_tokens: outputTokens, cost },
    }),
  }
}

describe('classifyWithJev', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('calls the OpenRouter decisions endpoint with the OpenRouter API key, not a TypeSafe-specific one', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body)
      const dimension = Object.keys(body.questions)[0]
      return jevResponse(dimension, 'positive', 0.9, { positive: 0.9, neutral: 0.05, negative: 0.05 })
    })
    vi.stubGlobal('fetch', fetchMock)
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key'

    await classifyWithJev('anything')

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/alpha/decisions')
    expect(opts.headers.Authorization).toBe('Bearer test-openrouter-key')
    const body = JSON.parse(opts.body)
    expect(body.model).toBe('jev-latest')
  })

  it('runs 4 parallel single-question calls and assembles a full classification result using real OpenRouter cost', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body)
      const dimension = Object.keys(body.questions)[0]
      if (dimension === 'sentiment') return jevResponse('sentiment', 'negative', 0.82, { positive: 0.05, neutral: 0.13, negative: 0.82 }, 40, 5, 0.00001)
      if (dimension === 'intent') return jevResponse('intent', 'complaint', 0.7, { complaint: 0.7, comparison: 0.4, praise: 0.02, inquiry: 0.01, purchase_intent: 0, recommendation: 0, promotion: 0, other: 0.01 }, 40, 5, 0.00002)
      if (dimension === 'topic') return jevResponse('topic', 'app_experience', 0.6, { app_experience: 0.6, transaction_issue: 0.3, customer_service: 0.05, fees_charges: 0, security_fraud: 0, rewards_offers: 0, account_access: 0, agent_network: 0, remittance: 0, bill_payment: 0.02, general: 0.03 }, 40, 5, 0.00003)
      if (dimension === 'brand') return jevResponse('brand', 'PayNow', 0.9, { PayNow: 0.9, QuickPay: 0.2, SendWise: 0, CashLink: 0, MoniGo: 0, TapPay: 0, none: 0.02 }, 40, 5, 0.00004)
      throw new Error(`unexpected dimension ${dimension}`)
    })
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await classifyWithJev("PayNow's app crashed during a transfer, way worse than QuickPay.")

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result.sentiment).toBe('negative')
      expect(outcome.result.sentimentConfidence).toBe(0.82)
      expect(outcome.result.intents).toEqual(['complaint', 'comparison'])
      expect(outcome.result.topics).toEqual(['app_experience', 'transaction_issue'])
      expect(outcome.result.brands).toEqual(['PayNow', 'QuickPay'])
      expect(outcome.result.inputTokens).toBe(160)
      expect(outcome.result.outputTokens).toBe(20)
      expect(outcome.result.costUsd).toBeCloseTo(0.0001, 10)
    }
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('excludes the none sentinel from the brands list, and returns empty when none wins', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body)
      const dimension = Object.keys(body.questions)[0]
      if (dimension === 'sentiment') return jevResponse('sentiment', 'neutral', 0.6, { positive: 0.2, neutral: 0.6, negative: 0.2 })
      if (dimension === 'intent') return jevResponse('intent', 'other', 0.5, { complaint: 0, comparison: 0, praise: 0, inquiry: 0, purchase_intent: 0, recommendation: 0, promotion: 0, other: 0.5 })
      if (dimension === 'topic') return jevResponse('topic', 'general', 0.5, { app_experience: 0, transaction_issue: 0, customer_service: 0, fees_charges: 0, security_fraud: 0, rewards_offers: 0, account_access: 0, agent_network: 0, remittance: 0, bill_payment: 0, general: 0.5 })
      if (dimension === 'brand') return jevResponse('brand', 'none', 0.95, { PayNow: 0.01, QuickPay: 0, SendWise: 0, CashLink: 0, MoniGo: 0, TapPay: 0, none: 0.95 })
      throw new Error('unexpected')
    })
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await classifyWithJev('mobile banking is convenient these days')
    expect(outcome.ok).toBe(true)
    if (outcome.ok) expect(outcome.result.brands).toEqual([])
  })

  it('returns an error outcome if any of the 4 calls fails with a non-OK HTTP status', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body)
      const dimension = Object.keys(body.questions)[0]
      if (dimension === 'brand') return { ok: false, status: 429 }
      return jevResponse(dimension, 'positive', 0.9, { positive: 0.9, neutral: 0.05, negative: 0.05 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await classifyWithJev('anything')
    expect(outcome).toEqual({ ok: false, error: 'JEV request failed (429)' })
  })

  it('returns an error outcome when OpenRouter relays a proxied error in an HTTP-200 body', async () => {
    const fetchMock = vi.fn().mockImplementation(async (_url: string, opts: { body: string }) => {
      const body = JSON.parse(opts.body)
      const dimension = Object.keys(body.questions)[0]
      if (dimension === 'topic') {
        return { ok: true, status: 200, json: async () => ({ error: { message: 'HTTP 529: system_overloaded', code: 529 } }) }
      }
      return jevResponse(dimension, 'positive', 0.9, { positive: 0.9, neutral: 0.05, negative: 0.05 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const outcome = await classifyWithJev('anything')
    expect(outcome).toEqual({ ok: false, error: 'JEV request failed (529)' })
  })

  it('returns an error outcome when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
    const outcome = await classifyWithJev('anything')
    expect(outcome).toEqual({ ok: false, error: 'JEV request failed unexpectedly' })
  })
})
