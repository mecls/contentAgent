/**
 * Which stored research Choose and the chat's list_research draw from. Deliberately
 * import-free so scripts/check-research-window.mjs can load it with
 * `node --experimental-strip-types`.
 */

export const RESEARCH_WINDOW = {
  sinceDays: 7,
  limit: 20,
  /** At most this many items from any one search, so a single story can't fill the list. */
  perTopic: 3,
} as const

/**
 * Keep `rows` in their order (newest first), skipping any item past the first
 * `perTopic` from the same search (`topic` is the query it came from), up to `limit`.
 */
export function pickResearchWindow<T extends { topic: string | null }>(
  rows: readonly T[],
  { limit, perTopic }: { limit: number; perTopic: number },
): T[] {
  const perSearch = new Map<string, number>()
  const picked: T[] = []
  for (const row of rows) {
    if (picked.length >= limit) break
    const taken = perSearch.get(row.topic ?? '') ?? 0
    if (taken >= perTopic) continue
    perSearch.set(row.topic ?? '', taken + 1)
    picked.push(row)
  }
  return picked
}
