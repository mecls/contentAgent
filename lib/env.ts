/**
 * Typed environment access.
 *
 * Server-only secrets are read lazily through getters that throw a clear error
 * when missing — so a missing key surfaces at the call site, not as a cryptic
 * `undefined` deep inside an SDK. Public (browser-exposed) values are referenced
 * via their literal `process.env.NEXT_PUBLIC_*` names so Next can inline them at
 * build time.
 */

function required(name: string): string {
  const v = process.env[name]
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return v
}

/** Public Supabase config — safe to ship to the browser. */
export const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

export const env = {
  // Supabase (service-role — server only, never expose)
  supabaseUrl: () => required('SUPABASE_URL'),
  supabaseServiceRoleKey: () => required('SUPABASE_SERVICE_ROLE_KEY'),

  // LLM — OpenAI-compatible Chat Completions (Ollama Cloud). Drives the agent
  // loop. The model MUST support tool/function calling.
  llmApiKey: () => required('LLM_API_KEY'),
  llmBaseUrl: () => required('LLM_BASE_URL'),
  llmModel: () => required('LLM_MODEL'),
  llmMaxTokens: () => {
    const raw = process.env.LLM_MAX_TOKENS
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4096
  },

  // App base URL. Used for redirects. localhost in dev.
  appBaseUrl: () => {
    const explicit = process.env.APP_BASE_URL
    if (explicit) return explicit.replace(/\/$/, '')
    const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
    if (vercel) return `https://${vercel}`
    return 'http://localhost:3000'
  },

  // Apify scraping. Token is optional at rest (the apify module guards an empty
  // value explicitly) so the app still boots without it configured.
  apifyToken: () => process.env.APIFY_TOKEN ?? '',

  // Exa (exa.ai) — web/blog research search. Optional at rest (the exa module
  // guards an empty value explicitly), required when research runs.
  exaApiKey: () => process.env.EXA_API_KEY ?? '',

  // Jina Reader (r.jina.ai) — extracts readable page text for research summaries.
  // Works with NO key (free, rate-limited); a key just raises the rate limit.
  jinaApiKey: () => process.env.JINA_API_KEY ?? '',

  // Shared secret that protects the cron route. Vercel Cron auto-attaches it as
  // `Authorization: Bearer $CRON_SECRET`. Required — an unset secret should fail
  // loud rather than silently leave the endpoint open.
  cronSecret: () => required('CRON_SECRET'),
} as const
