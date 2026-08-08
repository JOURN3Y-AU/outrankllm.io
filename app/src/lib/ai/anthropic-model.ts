/**
 * Anthropic (Claude) model configuration — SINGLE SOURCE OF TRUTH.
 *
 * Anthropic retires dated model IDs on a published schedule. When a model is
 * retired the API starts returning `404 not_found_error` with the message
 * `model: <id>`, and every Claude query in the app fails silently from that day
 * onward. That is exactly what happened with `claude-sonnet-4-20250514`, which
 * was retired 2026-06-15: every Claude scan and brand-awareness result from
 * 2026-06-16 onward stored the 404 text as if it were the AI's answer.
 *
 * To update after a future retirement, change CLAUDE_MODEL here and add the new
 * ID to src/lib/ai/costs.ts. Nothing else should hardcode a Claude model ID.
 *
 * Verify availability any time with: GET /api/admin/model-health
 */

/** Model ID used for direct Anthropic API calls. */
export const CLAUDE_MODEL = 'claude-sonnet-5'

/** Same model addressed through the Vercel AI Gateway. */
export const CLAUDE_GATEWAY_MODEL = `anthropic/${CLAUDE_MODEL}` as const

/**
 * Model used ONLY to simulate what Claude tells a user — the `search_claude_*`
 * and `brand_*_claude` steps, where we feed Tavily results in and ask for an
 * answer.
 *
 * Kept separate from CLAUDE_MODEL because the two jobs have different economics.
 * Claude carries a weight of 1 out of 17 in the scoring formula — 6% of the
 * score — but at Sonnet pricing this step was 25% of the entire AI bill, four
 * times its influence. The work itself is summarising supplied search results,
 * which Haiku handles well, and the step is already an approximation of Claude's
 * real product rather than the product itself.
 *
 * Internal analysis — sentiment, differentiation, strategic summaries — stays on
 * CLAUDE_MODEL. Those are cheap (all of them together are a few dollars a month)
 * and quality there moves the customer-visible numbers.
 *
 * Same retirement rules apply: add any new ID to MODEL_PRICING and MODEL_MAP in
 * src/lib/ai/costs.ts, or it silently tracks $0.
 */
export const CLAUDE_SEARCH_MODEL = 'claude-haiku-4-5'

/** Same search model addressed through the Vercel AI Gateway. */
export const CLAUDE_SEARCH_GATEWAY_MODEL = `anthropic/${CLAUDE_SEARCH_MODEL}` as const

/**
 * Claude Sonnet 5 runs adaptive thinking by default, and `max_tokens` caps
 * thinking + visible text together — so a tight output budget can truncate the
 * answer. We disable thinking: these calls simulate what a consumer AI assistant
 * replies, and extract/classify structured data. Neither benefits from it, and
 * both are latency- and cost-sensitive.
 *
 * Note: Sonnet 5 also rejects non-default `temperature` / `top_p` / `top_k` with
 * a 400 — do not add sampling parameters to Claude calls.
 */
export const CLAUDE_PROVIDER_OPTIONS = {
  anthropic: { thinking: { type: 'disabled' as const } },
} as const

/**
 * Detects the failure mode that silently broke Claude for two months: the model
 * ID is gone (retired/renamed) or this account cannot reach it.
 *
 * These are configuration failures, not transient ones — retrying will never
 * help, and they must be surfaced loudly rather than recorded as an AI answer.
 */
export function isModelUnavailableError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  if (!message) return false

  return (
    // Anthropic 404 for a retired/unknown model: `model: claude-sonnet-4-20250514`
    /^model:\s*claude/.test(message) ||
    message.includes('not_found_error') ||
    message.includes('model not found') ||
    // Gateway/plan-level denial for a model this account can't call
    message.includes('do not have access to this model') ||
    message.includes('does not have access to this model')
  )
}

/**
 * Log a model-availability failure in a way that is impossible to miss and easy
 * to grep for in Vercel/Inngest logs.
 */
export function logModelUnavailable(context: string, model: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error)
  console.error(
    `\n🚨 [MODEL_UNAVAILABLE] ${context}\n` +
      `   model: ${model}\n` +
      `   error: ${detail}\n` +
      `   This model is retired or inaccessible. Every request using it will keep failing.\n` +
      `   Fix: update CLAUDE_MODEL in src/lib/ai/anthropic-model.ts, then add pricing in src/lib/ai/costs.ts.\n` +
      `   Check all models: GET /api/admin/model-health\n`
  )
}
