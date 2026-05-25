/**
 * Date utilities. No date library dependency — just native Intl.
 * All DB dates are ISO 8601 strings (timestamptz or date).
 */

const DATE_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})

const DATE_SHORT = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric',
})

const DATETIME_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
})

/** "May 25, 2026" */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATE_FMT.format(new Date(iso))
}

/** "May 25" */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATE_SHORT.format(new Date(iso))
}

/** "May 25, 2026 at 2:30 PM" */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return DATETIME_FMT.format(new Date(iso))
}

/** Days between two ISO date strings. Positive = a is after b. */
export function daysBetween(a: string, b: string): number {
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((new Date(a).getTime() - new Date(b).getTime()) / msPerDay)
}

/** "3 days ago", "in 5 days", "today" */
export function relativeDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const days = daysBetween(iso, new Date().toISOString())
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days === -1) return 'tomorrow'
  if (days > 0) return `${days} days ago`
  return `in ${Math.abs(days)} days`
}

/** ISO date string for N days from now */
export function daysFromNow(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]!
}

/** Today as YYYY-MM-DD */
export function today(): string {
  return new Date().toISOString().split('T')[0]!
}
