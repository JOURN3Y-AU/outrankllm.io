/**
 * OpenAI (ChatGPT) model configuration — SINGLE SOURCE OF TRUTH.
 *
 * OpenAI retires model IDs the same way Anthropic does, and the failure is just
 * as quiet. On 2026-10-25 `o4-mini` was deprecated mid-batch: the API returned
 * "The model `o4-mini` has been deprecated" (then "does not exist or you do not
 * have access to it"), every ChatGPT query failed in ~560ms, and the error text
 * was recorded as the AI's answer. ChatGPT carries a weight of 10 out of 17 —
 * 59% of the score — so commbank.com.au fell from 73 to 20 and journ3y.com.au
 * from 25 to 9. The scans still reported "complete" and the Monday digest
 * emailed all thirteen subscribers a link to the wrong numbers.
 *
 * The model ID was hardcoded in three places at the time: the scan search step,
 * brand awareness, and the model-health check. That is why this file exists —
 * mirroring src/lib/ai/anthropic-model.ts, so a retirement is a one-line fix.
 *
 * To update after a future retirement: change OPENAI_SEARCH_MODEL here, then add
 * the new ID to MODEL_PRICING and MODEL_MAP in src/lib/ai/costs.ts. An unpriced
 * model silently tracks $0.
 *
 * Verify availability any time with: GET /api/admin/model-health
 */

/**
 * Model used to simulate what ChatGPT tells a user — the `search_chatgpt` and
 * `brand_*_chatgpt` steps. Called through the Responses API with the
 * `web_search` tool, so it needs to be a model that searches aggressively on
 * its own rather than answering from training knowledge.
 *
 * Why o3 and not something cheaper: on 2026-10-26 four candidates replayed 22
 * prompts from the last known-good batch (18 Oct), scored with the same
 * checkDomainMention used in production. Agreement with that baseline, on the
 * same prompts:
 *
 *   o3            90% (18/20)   10.3 searches/call   $0.168/call
 *   gpt-5.4       75% (15/20)    1.0                 $0.043
 *   gpt-5-mini    63% (12/19)    1.9                 $0.026
 *   gpt-5.4-mini  65% (13/20)    1.1                 $0.020
 *
 * The cheap models produce fluent answers from one search. On commbank.com.au —
 * the one test domain with real visibility, 6 of 7 at baseline — o3 reproduced
 * 6/7 while they returned 2-4. A model that cannot find Australia's largest
 * bank is measuring recall, not visibility, and the score would drift for
 * reasons no customer could act on.
 *
 * o3 costs ~$144/month at current volume against o4-mini's ~$128. The five
 * paused internal domains saved ~$51/month, which more than covers it.
 */
export const OPENAI_SEARCH_MODEL = 'o3'

/**
 * Pricing key recorded in api_costs for the search step. Kept distinct from the
 * bare model ID because the same model is billed differently with the
 * web_search tool attached — see OPENAI_WEB_SEARCH_COST_CENTS_PER_CALL.
 */
export const OPENAI_SEARCH_COST_MODEL = `openai/${OPENAI_SEARCH_MODEL}-search` as const

/**
 * Detects the failure mode that cost the 25 Oct batch its ChatGPT data: the
 * model ID is gone, or this account cannot reach it.
 *
 * Deprecation produces two distinct messages as OpenAI winds a model down —
 * "has been deprecated" first, then "does not exist or you do not have access
 * to it" once it is removed. Both are configuration failures, not transient
 * ones: retrying never helps, and the text must never be stored as an answer.
 */
export function isOpenAIModelUnavailableError(error: unknown): boolean {
  const message = (error instanceof Error ? error.message : String(error ?? '')).toLowerCase()
  if (!message) return false

  return (
    message.includes('has been deprecated') ||
    message.includes('does not exist or you do not have access') ||
    message.includes('is not supported with') ||
    (message.includes('model') && message.includes('not found'))
  )
}
