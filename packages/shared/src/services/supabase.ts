import { createClient } from '@supabase/supabase-js'
import type { Database } from '@indigo/db'

/**
 * Creates a typed Supabase client for frontend use (anon key, RLS enforced).
 * Call once and export the singleton — do not create per request.
 */
export function createSupabaseClient(url: string, anonKey: string) {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>
export type TypedSupabaseClient = SupabaseClient
