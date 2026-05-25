import { useAuth } from '@/hooks/useAuth'
import { SkeletonCard } from '@/components/ui/Skeleton'

export function DashboardPage() {
  const { profile } = useAuth()

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="p-6 pb-24 lg:pb-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">
          {greeting()}{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active Projects', value: '—', icon: '🏗️' },
          { label: 'Open RFIs',       value: '—', icon: '❓' },
          { label: 'Pending COs',     value: '—', icon: '📝' },
          { label: 'Draw Ready',      value: '—', icon: '💰' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-gray-200 bg-white p-4 shadow-card">
            <div className="flex items-center gap-2">
              <span className="text-lg">{stat.icon}</span>
              <span className="text-xs font-medium text-gray-500">{stat.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* AI Insights placeholder */}
      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">AI Insights</h2>
        <div className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
          ✦ Autonomous PM is watching your active projects. Insights will appear here each morning.
        </div>
      </div>

      {/* Recent projects skeleton — will be replaced with real data */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Recent Projects</h2>
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    </div>
  )
}
