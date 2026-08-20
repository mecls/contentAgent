// Generated from hub/convex-backend by scripts/sync-types.mjs. Do not edit.
// Declarations only — the implementation stays in the backend repo.
/**
 * Public: the report page reads by slug, which is an unguessable nanoid(10).
 *
 * This is the ONE unauthenticated function here, and a Convex query is callable
 * directly by anyone holding the deployment URL — not only through our own server.
 * So it returns a projection, never the document: `email`, `lead_id` and the raw
 * `lead_data` submission stay server-side. The Supabase table this replaced was
 * deny-all to every non-service-role client, and the page has only ever rendered
 * `status` and `content`.
 */
export declare const getBySlug: import("convex/server").RegisteredQuery<"public", {
    slug: string;
}, Promise<{
    slug: string;
    status: "pending" | "ready" | "failed";
    content: any;
} | null>>;
export declare const getById: import("convex/server").RegisteredQuery<"public", {
    id: string;
    secret: string;
}, Promise<{
    _id: import("convex/values").GenericId<"audits">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    email: string;
    lead_data: any;
    content: any;
    error_message: string | null;
    ready_at: number | null;
    lead_id: string | null;
} | null>>;
export declare const findByLeadId: import("convex/server").RegisteredQuery<"public", {
    secret: string;
    leadId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"audits">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    email: string;
    lead_data: any;
    content: any;
    error_message: string | null;
    ready_at: number | null;
    lead_id: string | null;
}>>;
export declare const findRecentByEmail: import("convex/server").RegisteredQuery<"public", {
    email: string;
    secret: string;
    since: number;
}, Promise<{
    _id: import("convex/values").GenericId<"audits">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    email: string;
    lead_data: any;
    content: any;
    error_message: string | null;
    ready_at: number | null;
    lead_id: string | null;
}>>;
/**
 * Create an audit, idempotently.
 *
 * Postgres enforced "one audit per leadgen_id" with a partial unique index, and
 * the caller caught error 23505 to turn a concurrent duplicate delivery from
 * Meta into an idempotent hit. Convex has no unique constraint — but a mutation
 * is a serializable transaction, so checking and inserting *here* closes the
 * race at its source rather than recovering from it. The duplicate path now
 * returns the existing row with `deduped: true` instead of throwing.
 */
export declare const create: import("convex/server").RegisteredMutation<"public", {
    id: string;
    slug: string;
    email: string;
    lead_data: any;
    lead_id: string | null;
    secret: string;
}, Promise<{
    id: string;
    slug: string;
    deduped: true;
} | {
    id: string;
    slug: string;
    deduped: false;
}>>;
export declare const markReady: import("convex/server").RegisteredMutation<"public", {
    id: string;
    content: any;
    secret: string;
}, Promise<void>>;
export declare const markFailed: import("convex/server").RegisteredMutation<"public", {
    id: string;
    message: string;
    secret: string;
}, Promise<void>>;
