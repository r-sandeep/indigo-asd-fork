/**
 * DeepSeek uses an OpenAI-compatible API.
 * We point the OpenAI SDK at DeepSeek's endpoint and swap the model ID.
 *
 * API docs: https://platform.deepseek.com/api-docs
 * Current models: deepseek-chat (V3), deepseek-reasoner (R1)
 * When DeepSeek V4 ships, add the model ID to DEEPSEEK_MODELS and the map below.
 */
import OpenAI from 'openai'
import type { AIMessage, AIModel, AIRouteRequest, AIRouteResponse, AIStreamResponse, AITool } from '../types.js'

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
const DEEPSEEK_MODELS: AIModel[] = ['deepseek-chat', 'deepseek-reasoner']

export function isDeepSeekModel(model: AIModel): boolean {
  return DEEPSEEK_MODELS.includes(model)
}

function mapModel(model: AIModel): string {
  const map: Record<string, string> = {
    'deepseek-chat': 'deepseek-chat',
    'deepseek-reasoner': 'deepseek-reasoner',
  }
  return map[model] ?? model
}

function toMessages(messages: AIMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

function toTools(tools: AITool[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

function makeClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL })
}

export async function callDeepSeek(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIRouteResponse> {
  const client = makeClient(apiKey)
  const start = Date.now()

  const response = await client.chat.completions.create({
    model: mapModel(model),
    messages: toMessages(req.messages),
    max_tokens: req.maxTokens ?? 4096,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toTools(req.tools) } : {}),
    stream: false,
  })

  const content = response.choices[0]?.message.content ?? ''

  return {
    provider: 'deepseek',
    model,
    content,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - start,
  }
}

export async function streamDeepSeek(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIStreamResponse> {
  const client = makeClient(apiKey)

  const stream = await client.chat.completions.create({
    model: mapModel(model),
    messages: toMessages(req.messages),
    max_tokens: req.maxTokens ?? 4096,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toTools(req.tools) } : {}),
    stream: true,
  })

  async function* textStream(): AsyncIterable<string> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }

  return { provider: 'deepseek', model, stream: textStream() }
}
