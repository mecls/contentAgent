// Generated from hub/convex-backend by scripts/sync-types.mjs. Do not edit.
// Declarations only — the implementation stays in the backend repo.
/**
 * Guard for functions that only server code may call.
 *
 * Convex functions exported from `convex/` are callable by anyone who knows the
 * deployment URL — unlike the Supabase service-role key, which never left the
 * server. Reads of a public report by its unguessable slug are fine to expose;
 * writes and lookups by email or id are not.
 *
 * This shared secret is the like-for-like replacement for that service-role key,
 * and it's deliberately interim: once Better Auth lands (Phase 3) these become
 * real identity checks. Set it with:
 *
 *   npx convex env set SERVER_SECRET "$(openssl rand -hex 32)"
 */
export declare function assertServerCall(secret: string): void;
