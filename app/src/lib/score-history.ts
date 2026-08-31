/**
 * Score history lookups shared by every path that reports a score change.
 *
 * The scan-complete email used to read the previous score with a `lead_id`
 * filter alone. On a multi-domain account that returns whichever domain
 * scanned most recently, so the delta compared two different websites. On
 * 2026-08-30 theservicescompany.com scored 13 and the email announced "up 5%"
 * against letstorc.com's 8 from fifteen hours earlier. The domain had in fact
 * moved 18 to 13, down 5, and the customer noticed before we did.
 *
 * Read a previous score through this module so the comparison always stays
 * inside one domain.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Return the visibility score from the scan before `currentRunId` for the same
 * domain, or `undefined` when this is the domain's first scan.
 *
 * The domain match runs against `scan_runs.domain` rather than
 * `score_history.domain_subscription_id` because the latter is null on rows
 * written before the multi-domain migration, and a null there would silently
 * widen the search back to the whole account.
 */
export async function getPreviousScoreForDomain(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  leadId: string,
  domain: string,
  currentRunId: string
): Promise<number | undefined> {
  if (!domain) return undefined

  const { data, error } = await supabase
    .from("score_history")
    .select("visibility_score, scan_runs!inner(domain)")
    .eq("lead_id", leadId)
    .eq("scan_runs.domain", domain)
    .neq("run_id", currentRunId)
    .order("recorded_at", { ascending: false })
    .limit(1)

  if (error || !data || data.length === 0) return undefined

  const score = Number(data[0].visibility_score)
  return Number.isFinite(score) ? score : undefined
}
