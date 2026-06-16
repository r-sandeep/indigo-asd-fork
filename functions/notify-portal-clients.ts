/**
 * POST /.netlify/functions/notify-portal-clients
 *
 * Sends a notification email to all portal users on a project when
 * something requiring their attention is created: a client-facing punch
 * list item or a change order sent for client approval.
 *
 * Requires PM+ role. Sends via Resend REST API.
 *
 * Body (JSON):
 *   projectId    string                    — projects.id
 *   tenantId     string                    — tenants.id
 *   type         'punch_item' | 'change_order'
 *   title        string                    — item / CO title
 *   description  string | null             — optional additional context
 *
 * Env vars:
 *   RESEND_API_KEY        — Resend API key (re_...)
 *   RESEND_FROM_EMAIL     — From address, e.g. "Indigo <no-reply@yourdomain.com>"
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   URL                   — Netlify site URL (set automatically by Netlify)
 *   VITE_APP_URL          — fallback site URL for local dev
 */

import type { Handler } from '@netlify/functions'

const SUPABASE_URL         = process.env.SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const RESEND_API_KEY       = process.env.RESEND_API_KEY
const RESEND_FROM          = process.env.RESEND_FROM_EMAIL ?? 'Indigo <no-reply@indigo.build>'
const APP_URL              = (process.env.URL ?? process.env.VITE_APP_URL ?? 'http://localhost:5173').replace(/\/$/, '')

const PM_AND_ABOVE = new Set(['project_manager', 'admin', 'owner'])

function svcHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'apikey':        SUPABASE_SERVICE_KEY,
    ...extra,
  }
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

async function rest<T>(path: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: svcHeaders({ Accept: 'application/json' }),
  })
  return res.ok ? ((await res.json()) as T[]) : []
}

function buildEmail(opts: {
  projectName: string
  type: 'punch_item' | 'change_order'
  title: string
  description: string | null
  portalUrl: string
  recipientName?: string
}): { subject: string; html: string } {
  const { projectName, type, title, description, portalUrl, recipientName } = opts

  const isPunch = type === 'punch_item'

  const subject = isPunch
    ? `Action needed on ${projectName}`
    : `Change order awaiting your approval — ${projectName}`

  const heading = isPunch
    ? 'Your builder needs your input'
    : 'A change order requires your approval'

  const intro = isPunch
    ? `Your builder has flagged a new action item on <strong>${projectName}</strong> that needs your attention.`
    : `A change order for <strong>${projectName}</strong> has been submitted for your approval.`

  const ctaLabel = isPunch ? 'View Action Items' : 'Review Change Order'
  const tabParam  = isPunch ? '?tab=action-items' : '?tab=finances'

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;border-radius:12px 12px 0 0;padding:24px 32px;">
            <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">Indigo</span>
            <span style="font-size:13px;color:#c7d2fe;margin-left:8px;">${projectName}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#fff;padding:32px;border-radius:0 0 12px 12px;">
            ${recipientName ? `<p style="margin:0 0 4px;font-size:13px;color:#6b7280;">Hi ${recipientName},</p>` : ''}
            <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#111827;line-height:1.3;">${heading}</h1>
            <p style="margin:0 0 20px;font-size:14px;color:#374151;line-height:1.6;">${intro}</p>

            <!-- Item card -->
            <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px;background:#f9fafb;">
              <p style="margin:0 0 4px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.6px;color:#6b7280;">
                ${isPunch ? 'Action Item' : 'Change Order'}
              </p>
              <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${title}</p>
              ${description ? `<p style="margin:6px 0 0;font-size:13px;color:#6b7280;line-height:1.5;">${description}</p>` : ''}
            </div>

            <!-- CTA button -->
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="border-radius:8px;background:#4f46e5;">
                  <a href="${portalUrl}${tabParam}"
                     style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;border-radius:8px;">
                    ${ctaLabel} →
                  </a>
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
              You're receiving this because you have portal access for ${projectName}.
              If you have questions, please contact your builder directly.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`

  return { subject, html }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  // ── Authenticate caller ────────────────────────────────────────────────────
  const token = event.headers['authorization']?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'Missing Authorization header' })

  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_SERVICE_KEY },
  })
  if (!userRes.ok) return json(401, { error: 'Invalid or expired token' })

  const userBody = await userRes.json() as { id?: string }
  const userId   = userBody.id
  if (!userId) return json(401, { error: 'Could not resolve user from token' })

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Record<string, unknown>
  try { body = JSON.parse(event.body ?? '{}') }
  catch { return json(400, { error: 'Invalid JSON body' }) }

  const projectId   = typeof body.projectId   === 'string' ? body.projectId.trim()   : ''
  const tenantId    = typeof body.tenantId    === 'string' ? body.tenantId.trim()    : ''
  const type        = body.type === 'punch_item' || body.type === 'change_order' ? body.type : null
  const title       = typeof body.title       === 'string' ? body.title.trim()       : ''
  const description = typeof body.description === 'string' ? body.description.trim() || null : null

  if (!projectId || !tenantId || !type || !title) {
    return json(400, { error: 'projectId, tenantId, type, and title are required' })
  }

  // ── Verify caller is PM+ in the tenant ────────────────────────────────────
  const members = await rest<{ role: string }>(
    `tenant_members?select=role&user_id=eq.${userId}&tenant_id=eq.${tenantId}&limit=1`,
  )
  if (!members[0] || !PM_AND_ABOVE.has(members[0].role)) {
    return json(403, { error: 'PM+ role required' })
  }

  // ── Resolve project → job → customer ─────────────────────────────────────
  const projects = await rest<{ job_id: string }>(
    `projects?select=job_id&id=eq.${projectId}&limit=1`,
  )
  if (!projects[0]) return json(404, { error: 'Project not found' })
  const jobId = projects[0].job_id

  const jobs = await rest<{ customer_id: string | null; job_name: string }>(
    `jobs?select=customer_id,job_name&id=eq.${jobId}&limit=1`,
  )
  if (!jobs[0] || !jobs[0].customer_id) {
    // No customer linked — nothing to notify
    return json(200, { sent: 0, reason: 'No customer linked to this job' })
  }

  const projectName = jobs[0].job_name || 'Your Project'
  const customerId  = jobs[0].customer_id

  // ── Collect portal recipient emails ───────────────────────────────────────
  // Primary contact (only if they have a portal account)
  const customers = await rest<{ email: string; portal_user_id: string | null; customer_name: string | null }>(
    `customers?select=email,portal_user_id,customer_name&id=eq.${customerId}&limit=1`,
  )
  const customer = customers[0]

  // Secondary contacts (all invited, regardless of linked status)
  const secondary = await rest<{ email: string }>(
    `customer_portal_users?select=email&customer_id=eq.${customerId}`,
  )

  const emails = new Set<string>()
  if (customer?.portal_user_id) emails.add(customer.email.toLowerCase())
  for (const s of secondary) emails.add(s.email.toLowerCase())

  if (emails.size === 0) {
    return json(200, { sent: 0, reason: 'No portal users found for this project' })
  }

  // ── Send emails ───────────────────────────────────────────────────────────
  if (!RESEND_API_KEY) {
    console.warn('[notify-portal-clients] RESEND_API_KEY not set — skipping email send')
    return json(200, { sent: 0, reason: 'RESEND_API_KEY not configured' })
  }

  const portalUrl = `${APP_URL}/portal/projects/${projectId}`
  let sent = 0

  for (const email of emails) {
    const recipientName = email === customer?.email?.toLowerCase()
      ? (customer?.customer_name ?? undefined)
      : undefined

    const { subject, html } = buildEmail({
      projectName,
      type,
      title,
      description,
      portalUrl,
      recipientName: recipientName ?? undefined,
    })

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({ from: RESEND_FROM, to: [email], subject, html }),
    })

    if (res.ok) {
      sent++
    } else {
      const err = await res.text()
      console.error(`[notify-portal-clients] Failed to send to ${email}: ${err}`)
    }
  }

  return json(200, { sent })
}
