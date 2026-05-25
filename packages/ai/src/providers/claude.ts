import Anthropic from '@anthropic-ai/sdk'
import type { AIMessage, AIModel, AIRouteRequest, AIRouteResponse, AIStreamResponse, AITool } from '../types.js'

const CLAUDE_MODELS: AIModel[] = ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5']

export function isClaudeModel(model: AIModel): boolean {
  return CLAUDE_MODELS.includes(model)
}

function mapModel(model: AIModel): string {
  const map: Record<string, string> = {
    'claude-opus-4-7': 'claude-opus-4-7',
    'claude-sonnet-4-6': 'claude-sonnet-4-6',
    'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  }
  return map[model] ?? model
}

function toAnthropicMessages(
  messages: AIMessage[]
): { systemPrompt: string | undefined; messages: Anthropic.MessageParam[] } {
  const systemMessages = messages.filter((m) => m.role === 'system')
  const conversationMessages = messages.filter((m) => m.role !== 'system')

  const systemPrompt =
    systemMessages.length > 0 ? systemMessages.map((m) => m.content).join('\n\n') : undefined

  const mapped: Anthropic.MessageParam[] = conversationMessages.map((m) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  return { systemPrompt, messages: mapped }
}

function toAnthropicTools(tools: AITool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters as Anthropic.Tool['input_schema'],
  }))
}

export async function callClaude(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIRouteResponse> {
  const client = new Anthropic({ apiKey })
  const { systemPrompt, messages } = toAnthropicMessages(req.messages)
  const start = Date.now()

  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: mapModel(model),
    max_tokens: req.maxTokens ?? 4096,
    messages,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toAnthropicTools(req.tools) } : {}),
  }

  const response = await client.messages.create(params)

  const content = response.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as Anthropic.TextBlock).text)
    .join('')

  return {
    provider: 'claude',
    model,
    content,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    durationMs: Date.now() - start,
  }
}

export async function streamClaude(
  req: AIRouteRequest,
  model: AIModel,
  apiKey: string
): Promise<AIStreamResponse> {
  const client = new Anthropic({ apiKey })
  const { systemPrompt, messages } = toAnthropicMessages(req.messages)

  const stream = client.messages.stream({
    model: mapModel(model),
    max_tokens: req.maxTokens ?? 4096,
    messages,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.tools ? { tools: toAnthropicTools(req.tools) } : {}),
  })

  async function* textStream(): AsyncIterable<string> {
    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        yield event.delta.text
      }
    }
  }

  return { provider: 'claude', model, stream: textStream() }
}
