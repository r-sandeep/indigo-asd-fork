import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ── Types ─────────────────────────────────────────────────────────────────────

export type CompanySettings = {
  tenant_id:       string
  logo_url:        string | null
  company_name:    string | null
  company_phone:   string | null
  company_email:   string | null
  company_address: string | null
}

type SaveInput = Omit<CompanySettings, 'tenant_id'>

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCompanySettings() {
  const { activeTenantId } = useAuth()
  const qc = useQueryClient()
  const key = ['company-settings', activeTenantId ?? '']

  const query = useQuery({
    queryKey: key,
    enabled:  !!activeTenantId,
    queryFn:  async () => {
      const { data, error } = await (supabase as any)
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', activeTenantId!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as CompanySettings | null
    },
  })

  const save = useMutation({
    mutationFn: async (input: SaveInput) => {
      const { data, error } = await (supabase as any)
        .from('tenant_branding')
        .upsert({ tenant_id: activeTenantId!, ...input, updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      return data as CompanySettings
    },
    onSuccess: (data) => {
      qc.setQueryData(key, data)
    },
  })

  async function uploadLogo(file: File): Promise<string> {
    if (!activeTenantId) throw new Error('No active tenant')

    const ext  = file.name.split('.').pop() ?? 'png'
    const path = `${activeTenantId}/logo.${ext}`

    const { error } = await supabase.storage
      .from('tenant-assets')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (error) throw error

    const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path)
    // Bust cache so the browser (and PDF renderer) fetches the new file
    return `${data.publicUrl}?t=${Date.now()}`
  }

  return { ...query, save, uploadLogo }
}
