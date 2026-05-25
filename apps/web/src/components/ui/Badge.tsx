interface BadgeProps {
  children: React.ReactNode
  className?: string
}

const STATUS_STYLES: Record<string, string> = {
  active:    'bg-brand-50 text-brand-700 ring-brand-200',
  bidding:   'bg-amber-50 text-amber-700 ring-amber-200',
  on_hold:   'bg-gray-100 text-gray-600 ring-gray-200',
  complete:  'bg-green-50 text-green-700 ring-green-200',
  cancelled: 'bg-red-50 text-red-600 ring-red-200',
  pending:   'bg-slate-50 text-slate-600 ring-slate-200',
}

const STATUS_DOT: Record<string, string> = {
  active:    'bg-brand-500',
  bidding:   'bg-amber-400',
  on_hold:   'bg-gray-400',
  complete:  'bg-green-500',
  cancelled: 'bg-red-500',
  pending:   'bg-slate-400',
}

const STATUS_LABELS: Record<string, string> = {
  active:    'Active',
  bidding:   'Bidding',
  on_hold:   'On Hold',
  complete:  'Complete',
  cancelled: 'Cancelled',
  pending:   'Pending',
}

const TYPE_STYLES: Record<string, string> = {
  custom:   'bg-brand-600 text-white',
  express:  'bg-amber-500 text-white',
  service:  'bg-teal-600 text-white',
  warranty: 'bg-purple-600 text-white',
}

export function StatusBadge({ status }: { status: string }) {
  const styles = STATUS_STYLES[status] ?? 'bg-gray-100 text-gray-600 ring-gray-200'
  const dot    = STATUS_DOT[status]    ?? 'bg-gray-400'
  const label  = STATUS_LABELS[status] ?? status.replace(/_/g, ' ')

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}

export function TypeBadge({ type }: { type: string }) {
  const styles = TYPE_STYLES[type] ?? 'bg-gray-600 text-white'
  const label  = type.charAt(0).toUpperCase() + type.slice(1)

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${styles}`}>
      {label}
    </span>
  )
}

/** Generic badge — pass className for color */
export function Badge({ children, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {children}
    </span>
  )
}
