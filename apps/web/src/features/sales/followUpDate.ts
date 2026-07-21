function parseLocalDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`)
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function isFollowUpOverdue(dateStr: string | null, now: Date = new Date()): boolean {
  if (!dateStr) return false
  return parseLocalDateOnly(dateStr) < startOfLocalDay(now)
}

export function formatRelativeFollowUpDate(dateStr: string | null, now: Date = new Date()): string | null {
  if (!dateStr) return null

  const dueDate = parseLocalDateOnly(dateStr)
  const diff = Math.round((dueDate.getTime() - startOfLocalDay(now).getTime()) / 86400000)

  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff < -1) return `${Math.abs(diff)}d overdue`

  return `In ${diff}d`
}