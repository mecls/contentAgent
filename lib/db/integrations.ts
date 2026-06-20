import { supabaseService } from '@/lib/supabase/service'

/**
 * Account-scoped CRUD for third-party integrations (currently just Apify).
 * Service-role client; the account id is server-derived and re-checked — except
 * `listActiveApifyIntegrations`, the one deliberately cross-account read used by
 * the cron route, which has no user session.
 */

const APIFY_ACTOR_ID = 'harvestapi/linkedin-profile-posts'

export interface ApifyConfig {
  profileUrl?: string
  maxPosts?: number
  postedLimit?: string
}

export interface IntegrationRow {
  id: string
  provider: string
  name: string
  actor_id: string | null
  config: ApifyConfig
  status: string
}

/** The cron's cross-account work list: every active Apify integration. */
export async function listActiveApifyIntegrations(): Promise<
  { id: string; account_id: string; config: ApifyConfig }[]
> {
  const { data, error } = await supabaseService()
    .from('content_integrations')
    .select('id, account_id, config')
    .eq('provider', 'apify')
    .eq('status', 'active')
  if (error) throw new Error(`listActiveApifyIntegrations failed: ${error.message}`)
  return (data ?? []) as { id: string; account_id: string; config: ApifyConfig }[]
}

/** The single Apify integration for an account, if any. */
export async function getApifyIntegration(
  accountId: string,
): Promise<IntegrationRow | null> {
  const { data, error } = await supabaseService()
    .from('content_integrations')
    .select('id, provider, name, actor_id, config, status')
    .eq('account_id', accountId)
    .eq('provider', 'apify')
    .maybeSingle()
  if (error) throw new Error(`getApifyIntegration failed: ${error.message}`)
  return (data as IntegrationRow | null) ?? null
}

/**
 * Create or update the account's Apify integration (one per account). Activates
 * it and stores the profile URL + scrape window in config.
 */
export async function upsertApifyIntegration(
  accountId: string,
  config: ApifyConfig,
): Promise<void> {
  const existing = await getApifyIntegration(accountId)
  const svc = supabaseService()
  const payload = {
    actor_id: APIFY_ACTOR_ID,
    name: 'LinkedIn profile posts',
    config: {
      profileUrl: config.profileUrl,
      maxPosts: config.maxPosts ?? 50,
      // No postedLimit — pull the latest maxPosts regardless of age.
    },
    status: 'active',
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { error } = await svc
      .from('content_integrations')
      .update(payload)
      .eq('id', existing.id)
      .eq('account_id', accountId)
    if (error) throw new Error(`upsertApifyIntegration update failed: ${error.message}`)
    return
  }

  const { error } = await svc
    .from('content_integrations')
    .insert({ account_id: accountId, provider: 'apify', ...payload })
  if (error) throw new Error(`upsertApifyIntegration insert failed: ${error.message}`)
}
