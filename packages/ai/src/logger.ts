/**
 * Logs AI interactions to the ai_conversations table.
 * Called after every successful route() call.
 * Server-side only — requires service_role key.
 */
import type { AIRouteRequest, AIRouteResponse } from './types.js'

export interface AILogEntry {
  tenant_id: string
  job_id?: string
  project_id?: string
  user_id?: string
  provider: string
  model: string
  task_type: string
  input_tokens: number
  output_tokens: number
  duration_ms: number
  content_type?: string
}

export type SupabaseAdminClient = {
  from: (table: string) => {
    insert: (data: unknown) => Promise<{ error: unknown }>
  }
}

export async function logAICall(
  req: AIRouteRequest,
  res: AIRouteResponse,
  supabase: SupabaseAdminClient
): Promise<void> {
  if (!req.meta?.tenantId) return

  const entry: AILogEntry = {
    tenant_id: req.meta.tenantId,
    job_id: req.meta.jobId,
    project_id: req.meta.projectId,
    user_id: req.meta.userId,
    provider: res.provider,
    model: res.model,
    task_type: req.task,
    input_tokens: res.inputTokens,
    output_tokens: res.outputTokens,
    duration_ms: res.durationMs,
    content_type: req.meta.contentType,
  }

  const { error } = await supabase.from('ai_conversations').insert(entry)
  if (error) {
    console.error('[ai-logger] Failed to log AI call:', error)
  }
}
