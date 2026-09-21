import type { EngineInfo } from '@/types'

const DEFAULT_BASELINE_MODELS = [
  'anthropic/claude-sonnet-5',
  'openai/gpt-5',
  'google/gemini-3.7-flash',
  'x-ai/grok-4.5',
  'z-ai/glm-5.3-flashx',
  '~deepseek/deepseek-flash-latest',
  '~openai/gpt-luna-latest',
]

const DEFAULT_LABELS: Record<string, string> = {
  jev: 'JEV',
  'anthropic/claude-sonnet-5': 'Claude Sonnet 5',
  'anthropic/claude-opus-5': 'Claude Opus 5',
  'openai/gpt-5': 'GPT-5',
  'openai/gpt-6-astra': 'GPT-6 Astra',
  'google/gemini-3.7-flash': 'Gemini 3.7 Flash',
  'x-ai/grok-4.5': 'Grok 4.5',
  'z-ai/glm-5.3-flashx': 'GLM 5.3 FlashX',
  '~deepseek/deepseek-flash-latest': 'DeepSeek Flash',
  '~openai/gpt-luna-latest': 'GPT Luna',
}

const ENGINE_COLORS: Record<string, string> = {
  jev: '#2de6c9',
  'anthropic/claude-sonnet-5': '#ff8a5c',
  'anthropic/claude-opus-5': '#f472b6',
  'openai/gpt-5': '#3ddc84',
  'openai/gpt-6-astra': '#a3e635',
  'google/gemini-3.7-flash': '#5b8cff',
  'x-ai/grok-4.5': '#ff4d6d',
  'z-ai/glm-5.3-flashx': '#f4c93c',
  '~deepseek/deepseek-flash-latest': '#c084fc',
  '~openai/gpt-luna-latest': '#38bdf8',
}

const FALLBACK_ENGINE_COLOR = '#8b8b95'

export function getBaselineModels(): string[] {
  const raw = process.env.BASELINE_MODELS
  if (!raw || raw.trim() === '') return DEFAULT_BASELINE_MODELS
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function getEngineLabel(id: string): string {
  return DEFAULT_LABELS[id] ?? id
}

export function getEngineColor(id: string): string {
  return ENGINE_COLORS[id] ?? FALLBACK_ENGINE_COLOR
}

export function getAllEngines(): EngineInfo[] {
  return ['jev', ...getBaselineModels()].map((id) => ({ id, label: getEngineLabel(id) }))
}
