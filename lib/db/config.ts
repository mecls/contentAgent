import { supabaseService } from '@/lib/supabase/service'

/**
 * Per-account key/value settings in the shared `config` table (account_id, key,
 * value jsonb; unique on account_id + key). Service-role client; the account id
 * is always server-derived.
 */

export async function getConfig(accountId: string, key: string): Promise<unknown> {
  const { data, error } = await supabaseService()
    .from('config')
    .select('value')
    .eq('account_id', accountId)
    .eq('key', key)
    .maybeSingle()
  if (error) throw new Error(`getConfig(${key}) failed: ${error.message}`)
  return data?.value ?? null
}

export async function setConfig(accountId: string, key: string, value: unknown): Promise<void> {
  const { error } = await supabaseService()
    .from('config')
    .upsert({ account_id: accountId, key, value }, { onConflict: 'account_id,key' })
  if (error) throw new Error(`setConfig(${key}) failed: ${error.message}`)
}

export async function deleteConfig(accountId: string, key: string): Promise<void> {
  const { error } = await supabaseService()
    .from('config')
    .delete()
    .eq('account_id', accountId)
    .eq('key', key)
  if (error) throw new Error(`deleteConfig(${key}) failed: ${error.message}`)
}
