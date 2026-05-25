import { Outlet, Link } from 'react-router-dom'
import { usePortalAuth } from '@/hooks/usePortalAuth'
import { supabase } from '@/lib/supabase'

export function PortalShell() {
  const { customer } = usePortalAuth()

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav */}
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link to="/portal" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              I
            </div>
            <span className="text-sm font-semibold text-gray-900">Client Portal</span>
          </Link>

          <div className="flex items-center gap-3">
            {customer && (
              <span className="hidden text-sm text-gray-500 sm:block">
                {customer.customer_name}
              </span>
            )}
            <button
              onClick={handleSignOut}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Page content — constrained width for readability */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
