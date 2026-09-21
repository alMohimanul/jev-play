export type ReasoningConfig = { enabled: false } | { effort: string }

const DISABLED: ReasoningConfig = { enabled: false }

/**
 * Verified live against OpenRouter's /models endpoint and real completions:
 * `enabled: false` 400s with "Reasoning is mandatory for this endpoint" on any
 * model whose provider forces reasoning on. For those, this uses the lowest
 * effort that actually drove reasoning_tokens to 0 in a real test call.
 */
const REASONING_CONFIG: Record<string, ReasoningConfig> = {
  'anthropic/claude-sonnet-5': DISABLED,
  'anthropic/claude-opus-5': DISABLED,
  '~deepseek/deepseek-flash-latest': DISABLED,
  '~openai/gpt-luna-latest': DISABLED,
  'openai/gpt-5': { effort: 'minimal' },
  'openai/gpt-6-astra': { effort: 'minimal' },
  'google/gemini-3.7-flash': { effort: 'low' },
  'x-ai/grok-4.5': { effort: 'low' },
  'z-ai/glm-5.3-flashx': { effort: 'low' },
}

const SAFE_FALLBACK: ReasoningConfig = { effort: 'low' }

export function getReasoningConfig(model: string): ReasoningConfig {
  return REASONING_CONFIG[model] ?? SAFE_FALLBACK
}
