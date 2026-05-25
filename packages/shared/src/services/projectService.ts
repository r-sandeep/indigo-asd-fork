import type { SupabaseClient } from './supabase.js'

export interface ProjectJob {
  id: string
  job_number: string
  job_name: string
  status: string
  job_type: string | null
  contract_value_cents: number | null
  current_contract_cents: number | null
  address_line1: string | null
  city: string | null
  state: string | null
  zip: string | null
  start_date: string | null
  target_completion: string | null
  actual_completion: string | null
  pm_user_id: string | null
  superintendent_user_id: string | null
  package_name: string | null
  tags: string[]
}

export interface ProjectRow {
  id: string
  tenant_id: string
  job_id: string
  created_at: string
  updated_at: string
  job: ProjectJob | null
}

export async function getProjects(client: SupabaseClient, tenantId: string) {
  const { data, error } = await client
    .from('projects')
    .select(`
      id,
      tenant_id,
      job_id,
      created_at,
      updated_at,
      job:jobs (
        id,
        job_number,
        job_name,
        status,
        job_type,
        contract_value_cents,
        current_contract_cents,
        address_line1,
        city,
        state,
        zip,
        start_date,
        target_completion,
        actual_completion,
        pm_user_id,
        superintendent_user_id,
        package_name,
        tags
      )
    `)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ProjectRow[]
}
