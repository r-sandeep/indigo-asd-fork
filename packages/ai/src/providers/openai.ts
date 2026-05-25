import OpenAI from 'openai'
import type { AIMessage, AIModel, AIRouteRequest, AIRouteResponse, AIStreamResponse, AITool } from '../types.js'

const OPENAI_MODELS: AIModel[] = ['gpt-4o', 'gpt-4o-mini', 'o3', 'o4-mini']

export function isOpenAIModel(model: AIModel): boolean {
  return OPENAI_MODELS.includes(model)
}

function toOpenAIMessages(messages: AIMessage[]): OpenAI.ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }))
}

function toOpenAITools(tools: AITool[]): OpenAI.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }))
}

export async function callOpenAI(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIRouteResponse> {
  const client = new OpenAI({ apiKey })
  const start = Date.now()

  const params: OpenAI.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: toOpenAIMessages(req.messages),
    max_completion_tokens: req.maxTokens ?? 4096,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toOpenAITools(req.tools) } : {}),
  }

  const response = await client.chat.completions.create(params)
  const content = response.choices[0]?.message.content ?? ''

  return {
    provider: 'openai',
    model,
    content,
    inputTokens: response.usage?.prompt_tokens ?? 0,
    outputTokens: response.usage?.completion_tokens ?? 0,
    durationMs: Date.now() - start,
  }
}

export async function streamOpenAI(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIStreamResponse> {
  const client = new OpenAI({ apiKey })

  const stream = await client.chat.completions.create({
    model,
    messages: toOpenAIMessages(req.messages),
    max_completion_tokens: req.maxTokens ?? 4096,
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toOpenAITools(req.tools) } : {}),
    stream: true,
  })

  async function* textStream(): AsyncIterable<string> {
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta.content
      if (delta) yield delta
    }
  }

  return { provider: 'openai', model, stream: textStream() }
}
