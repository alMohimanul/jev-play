import { describe, it, expect, afterEach } from 'vitest'
import { getBaselineModels, getAllEngines, getEngineLabel, getEngineColor } from './engines'

describe('engines config', () => {
  const original = process.env.BASELINE_MODELS

  afterEach(() => {
    process.env.BASELINE_MODELS = original
  })

  it('falls back to the default 7-model roster when BASELINE_MODELS is unset', () => {
    delete process.env.BASELINE_MODELS
    expect(getBaselineModels()).toEqual([
      'anthropic/claude-sonnet-5',
      'openai/gpt-5',
      'google/gemini-3.7-flash',
      'x-ai/grok-4.5',
      'z-ai/glm-5.3-flashx',
      '~deepseek/deepseek-flash-latest',
      '~openai/gpt-luna-latest',
    ])
  })

  it('parses a comma-separated BASELINE_MODELS override, trimming whitespace', () => {
    process.env.BASELINE_MODELS = 'openai/gpt-5, google/gemini-2.5-pro '
    expect(getBaselineModels()).toEqual(['openai/gpt-5', 'google/gemini-2.5-pro'])
  })

  it('always puts jev first in the full engine list', () => {
    process.env.BASELINE_MODELS = 'openai/gpt-5'
    const engines = getAllEngines()
    expect(engines[0]).toEqual({ id: 'jev', label: 'JEV' })
    expect(engines[1]).toEqual({ id: 'openai/gpt-5', label: 'GPT-5' })
  })

  it('falls back to the raw id as the label for an unknown model', () => {
    expect(getEngineLabel('some/unknown-model')).toBe('some/unknown-model')
  })

  it('gives every known engine a distinct accent color', () => {
    const ids = [
      'jev',
      'anthropic/claude-sonnet-5',
      'anthropic/claude-opus-5',
      'openai/gpt-5',
      'openai/gpt-6-astra',
      'google/gemini-3.7-flash',
      'x-ai/grok-4.5',
      'z-ai/glm-5.3-flashx',
      '~deepseek/deepseek-flash-latest',
      '~openai/gpt-luna-latest',
    ]
    const colors = ids.map((id) => getEngineColor(id))
    expect(new Set(colors).size).toBe(ids.length)
  })

  it('falls back to a neutral color for an unknown engine', () => {
    expect(getEngineColor('some/unknown-model')).toBe('#8b8b95')
  })
})
