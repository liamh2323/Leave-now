import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Server-side client — uses SERVICE_KEY, bypasses Row Level Security.
// Only use in API routes and server components.
export function createServerClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_KEY')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// Browser-side client — uses ANON_KEY, respects Row Level Security.
// Use in client components and hooks.
let browserClient: SupabaseClient | null = null
export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }
  browserClient = createClient(url, key)
  return browserClient
}
