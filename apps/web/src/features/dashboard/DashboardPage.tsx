import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useDashboardStats } from './useDashboardStats'
import { SkeletonCard } from '@/components/ui/Skeleton'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

interface StatCardProps {
  label: string
  value: string | number
  icon: string
  loading?: boolean
  href?: string
}

function StatCard({ label, value, icon, loading, href }: StatCardProps) {
  const content = (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-card transition-shadow hover:shadow-panel">
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">{icon}</span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      {loading ? (
        <div className="mt-2 h-7 w-12 animate-pulse rounded bg-gray-200" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tabular-nums text-gray-900">{value}</p>
      )}
    </div>
  )

  return href ? (
    <Link to={href} className="block">
      {content}
    </Link>
  ) : (
    content
  )
}

export function DashboardPage() {
  const { profile } = useAuth()
  const { stats, isLoading } = useDashboardStats()

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month:   'long',
    day:     'numeric',
  })

  return (
    <div className="p-5 pb-24 lg:p-8 lg:pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {greeting()}{profile?.first_name ? `, ${profile.first_name}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">{today}</p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Active Projects"
          value={stats?.active ?? '—'}
          icon="🏗️"
          loading={isLoading}
          href="/projects"
        />
        <StatCard label="Open RFIs"    value="—" icon="❓" />
        <StatCard label="Pending COs"  value="—" icon="📝" />
        <StatCard label="Draw Ready"   value="—" icon="💰" />
      </div>

      {/* AI Insights */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">AI Insights</h2>
        <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          ✦ Autonomous PM is watching your active projects. Insights will appear here each morning.
        </div>
      </div>

      {/* Recent projects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Recent Projects</h2>
          <Link to="/projects" className="text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors">
            View all →
          </Link>
        </div>
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
