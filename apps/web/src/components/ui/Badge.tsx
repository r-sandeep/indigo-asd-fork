import type { StatusColor } from '@indigo/shared'

const colorMap: Record<StatusColor, string> = {
  gray:   'bg-gray-100 text-gray-700',
  blue:   'bg-blue-50 text-blue-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  green:  'bg-green-50 text-green-700',
  red:    'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
}

interface BadgeProps {
  label: string
  color?: StatusColor
  size?: 'sm' | 'md'
}

export function Badge({ label, color = 'gray', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${colorMap[color]} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'
      }`}
    >
      {label}
    </span>
  )
}
