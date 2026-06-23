import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Lead, LeadActivity, LeadStatus } from './types'

// ── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  leads:      (tenantId: string) => ['leads', tenantId] as const,
  lead:       (id: string)       => ['lead', id] as const,
  activities: (leadId: string)   => ['lead-activities', leadId] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useLeads() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: KEYS.leads(activeTenantId ?? ''),
    enabled:  !!activeTenantId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', activeTenantId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Lead[]
    },
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: KEYS.lead(id),
    enabled:  !!id,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Lead
    },
  })
}

export function useLeadActivities(leadId: string) {
  return useQuery({
    queryKey: KEYS.activities(leadId),
    enabled:  !!leadId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', leadId)
        .order('activity_date', { ascending: false })
      if (error) throw error
      return data as LeadActivity[]
    },
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateLead() {
  const qc = useQueryClient()
  const { activeTenantId, user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      client_name: string
      client_email?: string
      client_phone?: string
      title: string
      job_address?: string
      job_city?: string
      job_state?: string
      job_zip?: string
      job_type?: string
      description?: string
      estimated_value_cents?: number
      lead_source?: string
      follow_up_date?: string
    }) => {
      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...input,
          tenant_id:  activeTenantId!,
          created_by: user?.id,
          status:     'new',
        })
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leads(activeTenantId ?? '') })
    },
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Lead> & { id: string }) => {
      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: (lead) => {
      qc.invalidateQueries({ queryKey: KEYS.leads(activeTenantId ?? '') })
      qc.setQueryData(KEYS.lead(lead.id), lead)
    },
  })
}

export function useUpdateLeadStatus() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const patch: Partial<Lead> = { status }
      if (status === 'won')  patch.won_date  = new Date().toISOString().split('T')[0]
      if (status === 'lost') patch.lost_date = new Date().toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Lead
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leads(activeTenantId ?? '') })
    },
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.leads(activeTenantId ?? '') })
    },
  })
}

export function useAddActivity() {
  const qc = useQueryClient()
  const { activeTenantId, user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      lead_id: string
      type: string
      description: string
      activity_date?: string
    }) => {
      const { data, error } = await supabase
        .from('lead_activities')
        .insert({
          ...input,
          tenant_id:  activeTenantId!,
          created_by: user?.id,
          activity_date: input.activity_date ?? new Date().toISOString(),
        })
        .select()
        .single()
      if (error) throw error
      return data as LeadActivity
    },
    onSuccess: (activity) => {
      qc.invalidateQueries({ queryKey: KEYS.activities(activity.lead_id) })
    },
  })
}

export function useDeleteActivity() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase.from('lead_activities').delete().eq('id', id)
      if (error) throw error
      return leadId
    },
    onSuccess: (leadId) => {
      qc.invalidateQueries({ queryKey: KEYS.activities(leadId) })
    },
  })
}
