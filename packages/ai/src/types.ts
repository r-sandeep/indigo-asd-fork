export type AIProvider = 'claude' | 'openai' | 'deepseek'

export type AIModel =
  // Claude
  | 'claude-opus-4-7'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5'
  // OpenAI
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'o3'
  | 'o4-mini'
  // DeepSeek
  | 'deepseek-chat'
  | 'deepseek-reasoner'

/**
 * Task types drive the default routing decision.
 * Override by passing `model` or `provider` explicitly.
 */
export type AITaskType =
  | 'co_draft'           // Change order drafting — Claude Sonnet (structured + domain reasoning)
  | 'daily_log_summary'  // Field log → client summary — Claude Haiku (short, cheap)
  | 'rfi_draft'          // RFI drafting — Claude Sonnet
  | 'estimate_draft'     // Estimate from scope — Claude Sonnet
  | 'chat'               // AI assistant chat — Claude Sonnet
  | 'autonomous_pm'      // Nightly risk scan — DeepSeek Chat (cost-sensitive bulk)
  | 'document_extract'   // Structured JSON from documents — DeepSeek Reasoner
  | 'embedding'          // Not routed here — use Supabase pgvector directly
  | 'general'            // Fallback — Claude Sonnet

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AITool {
  name: string
  description: string
  parameters: Record<string, unknown> // JSON Schema object
}

export interface AIRouteRequest {
  task: AITaskType
  messages: AIMessage[]
  /** Override the auto-selected model */
  model?: AIModel
  /** Override the auto-selected provider */
  provider?: AIProvider
  tools?: AITool[]
  /** Max tokens to generate */
  maxTokens?: number
  /** Temperature 0–1 */
  temperature?: number
  /** Stream the response — caller receives AsyncIterable<string> */
  stream?: boolean
  /** Metadata written to ai_conversations table */
  meta?: {
    tenantId?: string
    jobId?: string
    projectId?: string
    userId?: string
    contentType?: string
  }
}

export interface AIRouteResponse {
  provider: AIProvider
  model: AIModel
  content: string
  inputTokens: number
  outputTokens: number
  durationMs: number
}

export interface AIStreamResponse {
  provider: AIProvider
  model: AIModel
  stream: AsyncIterable<string>
}

export type AIResponse = AIRouteResponse | AIStreamResponse

export function isStreamResponse(r: AIResponse): r is AIStreamResponse {
  return 'stream' in r
}

/** Tool call result for providers that support it */
export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}
