import { completeJSON } from './complete'
import { llmModelFast } from './llm'
import { REVIEW_SYSTEM, buildReviewUser, parseReview, type DetailReview } from './sourced-details'

/**
 * Asks the writer model which concrete details in a post the evidence doesn't
 * support (see REVIEW_SYSTEM). Returns `{ ok: false }` when the call fails or the
 * response is unusable — save_post then refuses to save, because an unchecked post
 * is exactly what this review exists to stop.
 */
export async function reviewDetails(body: string, evidence: string[]): Promise<DetailReview> {
  try {
    const raw = await completeJSON({
      model: llmModelFast(),
      system: REVIEW_SYSTEM,
      user: buildReviewUser(body, evidence),
    })
    const review = parseReview(raw, body)
    // Log what was flagged (quotes only), so an over-strict review can be checked for free.
    if (review.ok) console.info('[review_details] flagged', review.unsupported.map((u) => u.quote))
    else console.error('[review_details] unusable review response')
    return review
  } catch (e) {
    console.error('[review_details] failed', e)
    return { ok: false }
  }
}
