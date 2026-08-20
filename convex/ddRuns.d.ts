// Generated from hub/convex-backend by scripts/sync-types.mjs. Do not edit.
// Declarations only — the implementation stays in the backend repo.
export declare const getBySlug: import("convex/server").RegisteredQuery<"public", {
    slug: string;
    secret: string;
}, Promise<{
    _id: import("convex/values").GenericId<"dd_runs">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    content: any;
    error_message: string | null;
    ready_at: number | null;
    run_input: any;
    storage_path: string;
    pdf_filename: string;
} | null>>;
export declare const getById: import("convex/server").RegisteredQuery<"public", {
    id: string;
    secret: string;
}, Promise<{
    _id: import("convex/values").GenericId<"dd_runs">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    content: any;
    error_message: string | null;
    ready_at: number | null;
    run_input: any;
    storage_path: string;
    pdf_filename: string;
} | null>>;
export declare const list: import("convex/server").RegisteredQuery<"public", {
    secret: string;
    limit: number;
}, Promise<{
    _id: import("convex/values").GenericId<"dd_runs">;
    _creationTime: number;
    id: string;
    created_at: number;
    slug: string;
    status: "pending" | "ready" | "failed";
    content: any;
    error_message: string | null;
    ready_at: number | null;
    run_input: any;
    storage_path: string;
    pdf_filename: string;
}[]>>;
export declare const create: import("convex/server").RegisteredMutation<"public", {
    id: string;
    slug: string;
    run_input: any;
    storage_path: string;
    pdf_filename: string;
    secret: string;
}, Promise<{
    id: string;
    slug: string;
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
/** Upload URL for the OM PDF. The app POSTs the bytes to it and gets a storage id. */
export declare const generateUploadUrl: import("convex/server").RegisteredMutation<"public", {
    secret: string;
}, Promise<string>>;
/**
 * A short-lived URL for reading a stored PDF back.
 *
 * Convex storage URLs are permanent and unguessable rather than expiring, which
 * differs from the Supabase signed URLs this replaces. Nothing here hands the
 * URL to a browser — the worker fetches the bytes server-side — so that
 * difference doesn't matter yet. It would if this were ever surfaced to a user.
 */
export declare const getDownloadUrl: import("convex/server").RegisteredQuery<"public", {
    secret: string;
    storageId: string;
}, Promise<string | null>>;
