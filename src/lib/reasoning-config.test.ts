import { describe, it, expect } from 'vitest'
import { getReasoningConfig } from './reasoning-config'

describe('getReasoningConfig', () => {
  it('fully disables reasoning for models that support turning it off', () => {
    expect(getReasoningConfig('anthropic/claude-sonnet-5')).toEqual({ enabled: false })
    expect(getReasoningConfig('anthropic/claude-opus-5')).toEqual({ enabled: false })
    expect(getReasoningConfig('~deepseek/deepseek-flash-latest')).toEqual({ enabled: false })
    expect(getReasoningConfig('~openai/gpt-luna-latest')).toEqual({ enabled: false })
  })

  it('uses the lowest effort a mandatory-reasoning model actually supports, verified against the live OpenRouter API', () => {
    // openai/gpt-5 and gpt-6-astra both hit 0 reasoning_tokens at "minimal"; the rest floor out at "low"
    expect(getReasoningConfig('openai/gpt-5')).toEqual({ effort: 'minimal' })
    expect(getReasoningConfig('openai/gpt-6-astra')).toEqual({ effort: 'minimal' })
    expect(getReasoningConfig('google/gemini-3.7-flash')).toEqual({ effort: 'low' })
    expect(getReasoningConfig('x-ai/grok-4.5')).toEqual({ effort: 'low' })
    expect(getReasoningConfig('z-ai/glm-5.3-flashx')).toEqual({ effort: 'low' })
  })

  it('falls back to the safe universal floor for a model not in the known roster', () => {
    // enabled:false 400s on any mandatory-reasoning model we haven't verified, so default to the
    // one effort level that's supported everywhere rather than risk breaking the request.
    expect(getReasoningConfig('some/future-model')).toEqual({ effort: 'low' })
  })
})
