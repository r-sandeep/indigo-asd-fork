import type { SupabaseClient } from './supabase.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProjectJob {
  id: string
  job_number: string
  job_name: string
  status: string
  job_type: string | null
  contract_amount_cents: number | null
  contract_value_cents: number | null
  current_contract_cents: number | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  zip: string | null
  job_address: string | null
  start_date: string | null
  target_completion: string | null
  actual_completion: string | null
  permit_number: string | null
  permit_issued_date: string | null
  permit_expiry_date: string | null
  has_construction_loan: boolean
  lender_name: string | null
  loan_amount_cents: number | null
  pm_user_id: string | null
  superintendent_user_id: string | null
  package_name: string | null
  description: string
  notes: string
  internal_notes: string | null
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

export interface ProjectMilestone {
  id: string
  project_id: string
  phase_id: string | null
  name: string
  description: string | null
  due_date: string | null
  completed_date: string | null
  status: string
  sequence: number
  is_client_visible: boolean
  requires_client_approval: boolean
  triggers_draw_request: boolean
  triggers_invoice: boolean
}

export interface ProjectPhase {
  id: string
  project_id: string
  tenant_id: string
  name: string
  sequence: number
  start_date: string | null
  end_date: string | null
  status: string
  color: string | null
  description: string | null
  created_at: string
  updated_at: string
  milestones: ProjectMilestone[]
}

// ── List (lean — only what the card needs) ────────────────────────────────

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
        contract_amount_cents,
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

// ── Single project (full detail) ───────────────────────────────────────────

export async function getProject(client: SupabaseClient, projectId: string) {
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
        contract_amount_cents,
        contract_value_cents,
        current_contract_cents,
        address_line1,
        address_line2,
        city,
        state,
        zip,
        job_address,
        start_date,
        target_completion,
        actual_completion,
        permit_number,
        permit_issued_date,
        permit_expiry_date,
        has_construction_loan,
        lender_name,
        loan_amount_cents,
        pm_user_id,
        superintendent_user_id,
        package_name,
        description,
        notes,
        internal_notes,
        tags
      )
    `)
    .eq('id', projectId)
    .single()

  if (error) throw error
  return data as ProjectRow
}

// ── Phases + milestones ────────────────────────────────────────────────────

export async function getProjectPhases(
  client: SupabaseClient,
  projectId: string,
  tenantId: string,
) {
  const { data, error } = await client
    .from('project_phases')
    .select(`
      id,
      project_id,
      tenant_id,
      name,
      sequence,
      start_date,
      end_date,
      status,
      color,
      description,
      created_at,
      updated_at,
      milestones (
        id,
        project_id,
        phase_id,
        name,
        description,
        due_date,
        completed_date,
        status,
        sequence,
        is_client_visible,
        requires_client_approval,
        triggers_draw_request,
        triggers_invoice
      )
    `)
    .eq('project_id', projectId)
    .eq('tenant_id', tenantId)
    .order('sequence', { ascending: true })

  if (error) throw error
  return (data ?? []) as ProjectPhase[]
}
