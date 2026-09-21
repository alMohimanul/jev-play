import { describe, it, expect, vi, afterEach } from 'vitest'
import { classifyWithOpenRouter } from './classify-openrouter'

function fakeStreamResponse(chunks: string[]) {
  const encoder = new TextEncoder()
  let i = 0
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          async read() {
            if (i < chunks.length) {
              const value = encoder.encode(chunks[i])
              i += 1
              return { done: false, value }
            }
            return { done: true, value: undefined }
          },
        }
      },
    },
  }
}

describe('classifyWithOpenRouter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('parses the single-shot 4-dimension classification with real cost', async () => {
    const chunks = [
      `data: ${JSON.stringify({ choices: [{ delta: { content: 'Negative complaint comparing brands.\nANSWER: {"sentiment": "negative", "intents": ["complaint", "comparison"], "topics": ["app_experience"], "brands": ["PayNow", "QuickPay"]}' } }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {} }], usage: { prompt_tokens: 300, completion_tokens: 60, cost: 0.0012 } })}\n\n`,
      `data: [DONE]\n\n`,
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeStreamResponse(chunks)))

    const outcome = await classifyWithOpenRouter("PayNow's app crashed, way worse than QuickPay.", 'openai/gpt-5')

    expect(outcome.ok).toBe(true)
    if (outcome.ok) {
      expect(outcome.result).toEqual({
        sentiment: 'negative',
        sentimentConfidence: null,
        sentimentProbabilities: null,
        intents: ['complaint', 'comparison'],
        intentProbabilities: null,
        topics: ['app_experience'],
        topicProbabilities: null,
        brands: ['PayNow', 'QuickPay'],
        brandProbabilities: null,
        latencyMs: expect.any(Number),
        costUsd: 0.0012,
        inputTokens: 300,
        outputTokens: 60,
      })
    }
  })

  it('returns an error outcome when the model never produces a parseable classification', async () => {
    const chunks = [`data: ${JSON.stringify({ choices: [{ delta: { content: 'not sure' } }] })}\n\n`, `data: [DONE]\n\n`]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeStreamResponse(chunks)))

    const outcome = await classifyWithOpenRouter('anything', 'openai/gpt-5')
    expect(outcome).toEqual({ ok: false, error: 'Response could not be parsed into a classification' })
  })

  it('returns an error outcome on a non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, body: null }))
    const outcome = await classifyWithOpenRouter('anything', 'openai/gpt-5')
    expect(outcome).toEqual({ ok: false, error: 'Request failed (500)' })
  })

  it('uses the per-model reasoning config and mentions all 4 dimensions in the prompt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(fakeStreamResponse([`data: [DONE]\n\n`]))
    vi.stubGlobal('fetch', fetchMock)

    await classifyWithOpenRouter('anything', 'anthropic/claude-sonnet-5')

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.reasoning).toEqual({ enabled: false })
    const systemPrompt: string = body.messages[0].content
    expect(systemPrompt).toMatch(/sentiment/i)
    expect(systemPrompt).toMatch(/intent/i)
    expect(systemPrompt).toMatch(/topic/i)
    expect(systemPrompt).toMatch(/brand/i)
    expect(systemPrompt).toContain('PayNow')
  })
})
