import type { SupabaseClient } from './supabase.js'

// ── Types ──────────────────────────────────────────────────────────────────

export interface PortalCustomer {
  id: string
  customer_name: string
  email: string
  phone: string
  portal_user_id: string | null
}

export interface PortalProjectJob {
  id: string
  job_name: string
  job_number: string
  project_status: string | null
  project_type: string | null
  address_line1: string | null
  city: string | null
  state: string | null
  contract_value_cents: number | null
  current_contract_cents: number | null
  start_date: string | null
  target_completion: string | null
  actual_completion: string | null
}

export interface PortalProject {
  id: string
  tenant_id: string
  job_id: string
  created_at: string
  job: PortalProjectJob | null
}

export interface PortalMilestone {
  id: string
  name: string
  status: string
  due_date: string | null
  completed_date: string | null
  requires_client_approval: boolean
  client_approved_at: string | null
  sequence: number
  phase_id: string | null
}

export interface PortalInvoice {
  id: string
  invoice_number: string
  invoice_date: string
  due_date: string
  invoice_status: string | null
  total_cents: number
  amount_paid_cents: number
  balance_due_cents: number
  sent_at: string | null
  paid_at: string | null
}

export interface PortalDocument {
  id: string
  type: string
  name: string
  mime_type: string | null
  file_size_bytes: number | null
  created_at: string
}

export interface PortalProjectData {
  project: PortalProject
  milestones: PortalMilestone[]
  invoices: PortalInvoice[]
  documents: PortalDocument[]
}

// ── Mutations ─────────────────────────────────────────────────────────────

/**
 * Called on first portal login when getCustomerByUserId returns null.
 * Calls the portal_link_self() security-definer RPC which matches
 * auth.email() → customers.email (case-insensitive) and sets portal_user_id.
 * Returns the now-linked customer, or null if no match was found.
 */
export async function linkCustomerByEmail(
  client: SupabaseClient,
  userId: string,
): Promise<PortalCustomer | null> {
  const { error } = await client.rpc('portal_link_self')
  if (error) throw error

  // Re-fetch the (now linked) customer
  return getCustomerByUserId(client, userId)
}

/**
 * Portal client approves a milestone via the portal_approve_milestone()
 * security-definer RPC. The function validates the caller is the job's
 * client and that the milestone actually requires approval.
 */
export async function approvePortalMilestone(
  client: SupabaseClient,
  milestoneId: string,
): Promise<void> {
  const { error } = await client.rpc(
    'portal_approve_milestone',
    { p_milestone_id: milestoneId } as unknown as never,
  )
  if (error) throw error
}

// ── Queries ────────────────────────────────────────────────────────────────

export async function getCustomerByUserId(
  client: SupabaseClient,
  userId: string,
): Promise<PortalCustomer | null> {
  const { data, error } = await client
    .from('customers')
    .select('id, customer_name, email, phone, portal_user_id')
    .eq('portal_user_id', userId)
    .maybeSingle()

  if (error) throw error
  return data as PortalCustomer | null
}

export async function getPortalProjects(
  client: SupabaseClient,
  customerId: string,
): Promise<PortalProject[]> {
  // Get job IDs for this customer
  const { data: jobs, error: jobsError } = await client
    .from('jobs')
    .select('id')
    .eq('customer_id', customerId)

  if (jobsError) throw jobsError
  if (!jobs || jobs.length === 0) return []

  const jobIds = (jobs as { id: string }[]).map((j) => j.id)

  const { data, error } = await client
    .from('projects')
    .select(`
      id, tenant_id, job_id, created_at,
      job:jobs (
        id, job_name, job_number,
        project_status, project_type,
        address_line1, city, state,
        contract_value_cents, current_contract_cents,
        start_date, target_completion, actual_completion
      )
    `)
    .in('job_id', jobIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as PortalProject[]
}

export async function getPortalProjectData(
  client: SupabaseClient,
  projectId: string,
): Promise<PortalProjectData> {
  const [projectRes, milestonesRes, docsRes] = await Promise.all([
    client
      .from('projects')
      .select(`
        id, tenant_id, job_id, created_at,
        job:jobs (
          id, job_name, job_number,
          project_status, project_type,
          address_line1, city, state,
          contract_value_cents, current_contract_cents,
          start_date, target_completion, actual_completion
        )
      `)
      .eq('id', projectId)
      .single(),
    client
      .from('milestones')
      .select('id, name, status, due_date, completed_date, requires_client_approval, client_approved_at, sequence, phase_id')
      .eq('project_id', projectId)
      .eq('is_client_visible', true)
      .order('sequence', { ascending: true }),
    client
      .from('documents')
      .select('id, type, name, mime_type, file_size_bytes, created_at')
      .eq('project_id', projectId)
      .eq('is_client_visible', true)
      .order('created_at', { ascending: false }),
  ])

  if (projectRes.error) throw projectRes.error
  if (milestonesRes.error) throw milestonesRes.error
  if (docsRes.error) throw docsRes.error

  const project = projectRes.data as PortalProject

  // Fetch invoices via job_id
  const { data: invoices, error: invError } = await client
    .from('invoices')
    .select('id, invoice_number, invoice_date, due_date, invoice_status, total_cents, amount_paid_cents, balance_due_cents, sent_at, paid_at')
    .eq('job_id', project.job_id)
    .neq('invoice_status', 'void')
    .order('invoice_date', { ascending: false })

  if (invError) throw invError

  return {
    project,
    milestones: (milestonesRes.data ?? []) as PortalMilestone[],
    invoices:   (invoices       ?? []) as PortalInvoice[],
    documents:  (docsRes.data   ?? []) as PortalDocument[],
  }
}
