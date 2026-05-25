import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { queryClient } from '@/lib/queryClient'
import { useAuthListener, useAuth } from '@/hooks/useAuth'
import { AppShell } from '@/components/AppShell'
import { LoginPage } from '@/features/auth/LoginPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (user === null) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AuthRoutes() {
  useAuthListener()
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="projects" element={<ComingSoon name="Projects" />} />
        <Route path="projects/:id/*" element={<ComingSoon name="Project Detail" />} />
        <Route path="schedule" element={<ComingSoon name="Schedule" />} />
        <Route path="financials/*" element={<ComingSoon name="Financials" />} />
        <Route path="documents" element={<ComingSoon name="Documents" />} />
        <Route path="field/*" element={<ComingSoon name="Field" />} />
        <Route path="subcontractors" element={<ComingSoon name="Subcontractors" />} />
        <Route path="ai" element={<ComingSoon name="AI Assistant" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

function ComingSoon({ name }: { name: string }) {
  return (
    <div className="flex h-full min-h-[60vh] items-center justify-center p-6">
      <div className="text-center">
        <div className="mb-3 text-4xl">🚧</div>
        <h2 className="text-base font-semibold text-gray-900">{name}</h2>
        <p className="mt-1 text-sm text-gray-500">Coming in Phase 2</p>
      </div>
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthRoutes />
      </BrowserRouter>
      {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
