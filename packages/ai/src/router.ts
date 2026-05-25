import { callClaude, isClaudeModel, streamClaude } from './providers/claude.js'
import { callOpenAI, isOpenAIModel, streamOpenAI } from './providers/openai.js'
import { callDeepSeek, isDeepSeekModel, streamDeepSeek } from './providers/deepseek.js'
import type {
  AIModel,
  AIProvider,
  AIResponse,
  AIRouteRequest,
  AIRouteResponse,
  AIStreamResponse,
  AITaskType,
} from './types.js'

// ---------------------------------------------------------------------------
// Default routing table
// Maps task type → [primary model, fallback model]
// Override per-request with req.model or req.provider
// ---------------------------------------------------------------------------
const TASK_ROUTING: Record<AITaskType, [AIModel, AIModel]> = {
  co_draft:          ['claude-sonnet-4-6', 'gpt-4o'],
  rfi_draft:         ['claude-sonnet-4-6', 'gpt-4o'],
  estimate_draft:    ['claude-sonnet-4-6', 'gpt-4o'],
  chat:              ['claude-sonnet-4-6', 'gpt-4o'],
  daily_log_summary: ['claude-haiku-4-5',  'deepseek-chat'],
  autonomous_pm:     ['deepseek-chat',     'claude-haiku-4-5'],
  document_extract:  ['deepseek-reasoner', 'claude-sonnet-4-6'],
  general:           ['claude-sonnet-4-6', 'gpt-4o'],
  embedding:         ['claude-sonnet-4-6', 'claude-sonnet-4-6'], // never used — handled by pgvector
}

function resolveModel(req: AIRouteRequest): AIModel {
  if (req.model) return req.model

  if (req.provider) {
    const providerDefaults: Record<AIProvider, AIModel> = {
      claude:   'claude-sonnet-4-6',
      openai:   'gpt-4o',
      deepseek: 'deepseek-chat',
    }
    return providerDefaults[req.provider]
  }

  return TASK_ROUTING[req.task][0]
}

function resolveProvider(model: AIModel): AIProvider {
  if (isClaudeModel(model)) return 'claude'
  if (isOpenAIModel(model)) return 'openai'
  if (isDeepSeekModel(model)) return 'deepseek'
  throw new Error(`Unknown model: ${model}`)
}

function getApiKey(provider: AIProvider): string {
  const keys: Record<AIProvider, string | undefined> = {
    claude:   process.env['ANTHROPIC_API_KEY'],
    openai:   process.env['OPENAI_API_KEY'],
    deepseek: process.env['DEEPSEEK_API_KEY'],
  }
  const key = keys[provider]
  if (!key) throw new Error(`Missing API key for provider: ${provider}`)
  return key
}

// ---------------------------------------------------------------------------
// Core routing functions
// ---------------------------------------------------------------------------

export async function route(req: AIRouteRequest): Promise<AIRouteResponse> {
  const model = resolveModel(req)
  const provider = resolveProvider(model)
  const apiKey = getApiKey(provider)

  if (isClaudeModel(model)) return callClaude(req, model, apiKey)
  if (isOpenAIModel(model)) return callOpenAI(req, model, apiKey)
  if (isDeepSeekModel(model)) return callDeepSeek(req, model, apiKey)

  throw new Error(`No handler for model: ${model}`)
}

export async function routeStream(req: AIRouteRequest): Promise<AIStreamResponse> {
  const model = resolveModel(req)
  const provider = resolveProvider(model)
  const apiKey = getApiKey(provider)

  if (isClaudeModel(model)) return streamClaude(req, model, apiKey)
  if (isOpenAIModel(model)) return streamOpenAI(req, model, apiKey)
  if (isDeepSeekModel(model)) return streamDeepSeek(req, model, apiKey)

  throw new Error(`No streaming handler for model: ${model}`)
}

/**
 * Unified entry point — respects req.stream flag.
 */
export async function ask(req: AIRouteRequest): Promise<AIResponse> {
  if (req.stream) return routeStream(req)
  return route(req)
}

export { TASK_ROUTING }
