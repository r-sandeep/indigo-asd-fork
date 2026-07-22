const DATE_ONLY_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const DATE_TIME_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

function parseLocalDateParts(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day)

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== monthIndex ||
    date.getDate() !== day
  ) {
    return null
  }

  return date
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

export function formatDateOnlyLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const localDate = parseLocalDateParts(dateStr)
  if (!localDate) return '—'
  return DATE_ONLY_FMT.format(localDate)
}

export function formatGenericLocal(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '—'
  return DATE_TIME_FMT.format(date)
}

export function isDateOnlyExpiredLocal(dateStr: string | null | undefined, now = new Date()): boolean {
  if (!dateStr) return false
  const localDate = parseLocalDateParts(dateStr)
  if (!localDate) return false
  return startOfLocalDay(now) > localDate
}

export function isDateOnlyExpiringSoonLocal(
  dateStr: string | null | undefined,
  daysAhead = 30,
  now = new Date(),
): boolean {
  if (!dateStr) return false
  const localDate = parseLocalDateParts(dateStr)
  if (!localDate) return false

  const today = startOfLocalDay(now)
  if (localDate < today) return false

  const cutoff = addLocalDays(today, daysAhead)
  return localDate <= cutoff
}