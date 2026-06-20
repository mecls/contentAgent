import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'

/**
 * Service-role Supabase client (server only).
 *
 * Bypasses RLS — so every query made through this client MUST scope by
 * `account_id` itself. Never import this into client components or expose the
 * key. Used by provisioning, the skill store, the agent's tool execution, and
 * all server-side writes.
 */
let cached: SupabaseClient | null = null

export function supabaseService(): SupabaseClient {
  if (cached) return cached
  cached = createClient(env.supabaseUrl(), env.supabaseServiceRoleKey(), {
    auth: { persistSession: false },
  })
  return cached
}
