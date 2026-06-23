import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Proposal, ProposalLineItem, ProposalLineItemTemplate } from './types'

// ── Query keys ───────────────────────────────────────────────────────────────

const KEYS = {
  proposals:  (leadId: string)      => ['proposals', leadId] as const,
  proposal:   (id: string)          => ['proposal', id] as const,
  lineItems:  (proposalId: string)  => ['proposal-line-items', proposalId] as const,
  templates:  (tenantId: string)    => ['proposal-templates', tenantId] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useProposalsForLead(leadId: string) {
  return useQuery({
    queryKey: KEYS.proposals(leadId),
    enabled:  !!leadId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Proposal[]
    },
  })
}

export function useProposal(id: string) {
  return useQuery({
    queryKey: KEYS.proposal(id),
    enabled:  !!id,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Proposal
    },
  })
}

export function useProposalLineItems(proposalId: string) {
  return useQuery({
    queryKey: KEYS.lineItems(proposalId),
    enabled:  !!proposalId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('proposal_line_items')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('sort_order')
      if (error) throw error
      return data as ProposalLineItem[]
    },
  })
}

export function useProposalTemplates() {
  const { activeTenantId } = useAuth()
  return useQuery({
    queryKey: KEYS.templates(activeTenantId ?? ''),
    enabled:  !!activeTenantId,
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('proposal_line_item_templates')
        .select('*')
        .eq('tenant_id', activeTenantId!)
        .order('sort_order')
      if (error) throw error
      return data as ProposalLineItemTemplate[]
    },
  })
}

// ── Mutations ────────────────────────────────────────────────────────────────

export function useCreateProposal() {
  const qc = useQueryClient()
  const { activeTenantId, user } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      lead_id: string
      title: string
      client_name?: string
      client_email?: string
      job_address?: string
      job_city?: string
      job_state?: string
      job_zip?: string
    }) => {
      const { data, error } = await supabase
        .from('proposals')
        .insert({
          ...input,
          tenant_id:  activeTenantId!,
          created_by: user?.id,
          status:     'draft',
        } as any)
        .select()
        .single()
      if (error) throw error
      return data as Proposal
    },
    onSuccess: (p) => {
      if (p.lead_id) qc.invalidateQueries({ queryKey: KEYS.proposals(p.lead_id) })
    },
  })
}

export function useUpdateProposal() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Proposal> & { id: string }) => {
      const { data, error } = await (supabase.from('proposals') as any)
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as Proposal
    },
    onSuccess: (p) => {
      qc.setQueryData(KEYS.proposal(p.id), p)
      if (p.lead_id) qc.invalidateQueries({ queryKey: KEYS.proposals(p.lead_id) })
    },
  })
}

export function useDeleteProposal() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, leadId }: { id: string; leadId: string }) => {
      const { error } = await supabase.from('proposals').delete().eq('id', id)
      if (error) throw error
      return leadId
    },
    onSuccess: (leadId) => {
      qc.invalidateQueries({ queryKey: KEYS.proposals(leadId) })
    },
  })
}

// ── Line items ────────────────────────────────────────────────────────────────

export function useUpsertLineItems() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async ({
      proposalId,
      items,
    }: {
      proposalId: string
      items: Array<Partial<ProposalLineItem> & { id?: string }>
    }) => {
      // Delete all existing items then re-insert in order
      const { error: delErr } = await supabase
        .from('proposal_line_items')
        .delete()
        .eq('proposal_id', proposalId)
      if (delErr) throw delErr

      if (items.length === 0) return []

      const rows = items.map((item, idx) => ({
        proposal_id:      proposalId,
        tenant_id:        activeTenantId!,
        sort_order:       idx,
        item_name:        item.item_name ?? '',
        description:      item.description ?? '',
        unit_price_cents: item.unit_price_cents ?? 0,
        quantity:         item.quantity ?? 1,
      }))

      const { data, error } = await supabase
        .from('proposal_line_items')
        .insert(rows as any)
        .select()
      if (error) throw error
      return data as ProposalLineItem[]
    },
    onSuccess: (_, { proposalId }) => {
      qc.invalidateQueries({ queryKey: KEYS.lineItems(proposalId) })
    },
  })
}

export function useCreateTemplate() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async (input: {
      item_name: string
      description?: string
      unit_price_cents?: number
      category?: string
    }) => {
      const { data, error } = await supabase
        .from('proposal_line_item_templates')
        .insert({ ...input, tenant_id: activeTenantId! } as any)
        .select()
        .single()
      if (error) throw error
      return data as ProposalLineItemTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templates(activeTenantId ?? '') })
    },
  })
}

export function useUpdateTemplate() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<ProposalLineItemTemplate> & { id: string }) => {
      const { data, error } = await (supabase.from('proposal_line_item_templates') as any)
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as ProposalLineItemTemplate
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templates(activeTenantId ?? '') })
    },
  })
}

export function useDeleteTemplate() {
  const qc = useQueryClient()
  const { activeTenantId } = useAuth()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('proposal_line_item_templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.templates(activeTenantId ?? '') })
    },
  })
}
