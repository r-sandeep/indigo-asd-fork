import { supabase } from '@/lib/supabase'

export async function notifyPortalClients(params: {
  projectId: string
  tenantId: string
  type: 'punch_item' | 'change_order'
  title: string
  description?: string | null
}): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return

    await fetch('/.netlify/functions/notify-portal-clients', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    })
  } catch {
    // Fire-and-forget: notification failures must never block the main flow
  }
}
