import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export function WelcomePage() {
  const { user, tenantMemberships } = useAuth()
  const navigate = useNavigate()

  const [password,    setPassword]    = useState('')
  const [confirm,     setConfirm]     = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  // If this is an existing user who somehow landed here (e.g. bookmarked),
  // send them straight to the app.
  if (user && tenantMemberships.length > 0) {
    navigate('/', { replace: true })
    return null
  }

  // Not yet authenticated — invite link not processed yet.
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-4xl">✉️</div>
          <h2 className="mt-4 text-base font-semibold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-500">
            Click the invite link in your email to set up your account.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="mt-6 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Back to login
          </button>
        </div>
      </div>
    )
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      // 1. Set the user's password
      const { error: pwErr } = await supabase.auth.updateUser({ password })
      if (pwErr) throw pwErr

      // 2. Mark all pending invitations as accepted
      await supabase.rpc('accept_my_invitations')

      // 3. Enter the app
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    'h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 ' +
    'placeholder:text-gray-400 focus:border-brand-500 focus:outline-none ' +
    'focus:ring-2 focus:ring-brand-100 transition-colors'

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">

        {/* Logo / brand mark */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg">
            <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">
            Welcome to Indigo
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <input
              type={showConfirm ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Same password again"
              required
              className={inputCls}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-500">
            <input
              type="checkbox"
              checked={showConfirm}
              onChange={(e) => setShowConfirm(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            Show passwords
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password || !confirm}
            className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Setting up your account…' : 'Create Password & Enter'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Signed in as {user.email}
        </p>
      </div>
    </div>
  )
}
