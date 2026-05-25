import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

interface NavItem {
  to: string
  label: string
  icon: string
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/',            label: 'Dashboard',   icon: '⊞',  end: true },
  { to: '/projects',    label: 'Projects',    icon: '🏗️' },
  { to: '/schedule',    label: 'Schedule',    icon: '📅' },
  { to: '/financials',  label: 'Financials',  icon: '💰' },
  { to: '/documents',   label: 'Documents',   icon: '📁' },
  { to: '/field',       label: 'Field',       icon: '📋' },
  { to: '/subcontractors', label: 'Subs',     icon: '🔧' },
  { to: '/ai',          label: 'AI Assistant', icon: '✦' },
]

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <span className="text-base leading-none">{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  )
}

export function AppShell() {
  const { profile, tenantMemberships, activeTenantId } = useAuth()
  const location = useLocation()

  const activeTenant = tenantMemberships.find((m) => m.tenant_id === activeTenantId)?.tenant

  return (
    <div className="flex h-screen overflow-hidden bg-surface-1">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-gray-200 bg-white lg:flex">
        {/* Logo */}
        <div className="flex h-14 items-center gap-2.5 border-b border-gray-200 px-4">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            I
          </div>
          <span className="text-sm font-semibold text-gray-900">Indigo</span>
          {activeTenant && (
            <span className="ml-auto text-xs text-gray-400 truncate max-w-[90px]">
              {activeTenant.name}
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavItemLink key={item.to} item={item} />
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-medium text-brand-700">
              {profile?.first_name?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-gray-900">
                {profile ? `${profile.first_name} ${profile.last_name}` : 'Loading...'}
              </p>
              <p className="truncate text-xs text-gray-500">{profile?.email ?? ''}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar — mobile + desktop */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 lg:px-6">
          {/* Mobile menu button placeholder */}
          <button className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 lg:hidden">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Breadcrumb placeholder */}
          <div className="flex-1" />

          {/* Notifications */}
          <button className="relative rounded-md p-1.5 text-gray-500 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav — mobile only */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex items-center justify-around border-t border-gray-200 bg-white px-2 pb-safe lg:hidden">
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const isActive = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className="flex min-h-[56px] flex-col items-center justify-center gap-1 px-3"
            >
              <span className={`text-lg leading-none ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium ${isActive ? 'text-brand-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
