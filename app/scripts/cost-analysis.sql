-- Cost analysis per scan run per subscription
-- Shows costs broken down by LLM, with free vs paid flag
-- Run this in Supabase SQL Editor or any Postgres client

-- =============================================================================
-- DETAILED COST BREAKDOWN PER SCAN
-- =============================================================================

SELECT
  sr.id AS run_id,
  sr.domain,
  sr.created_at::date AS scan_date,
  sr.created_at AS scan_timestamp,

  -- Subscription info (NULL = free scan)
  ds.id AS subscription_id,
  ds.tier AS subscription_tier,
  CASE
    WHEN ds.id IS NOT NULL THEN 'paid'
    ELSE 'free'
  END AS scan_type,

  -- Lead info
  l.email,
  l.tier AS lead_tier,

  -- Costs by model/step
  COALESCE(SUM(CASE WHEN ac.model ILIKE '%claude%' THEN ac.cost_cents ELSE 0 END), 0) AS claude_cost_cents,
  COALESCE(SUM(CASE WHEN ac.model ILIKE '%gpt%' OR ac.model ILIKE '%openai%' THEN ac.cost_cents ELSE 0 END), 0) AS openai_cost_cents,
  COALESCE(SUM(CASE WHEN ac.model ILIKE '%gemini%' THEN ac.cost_cents ELSE 0 END), 0) AS gemini_cost_cents,
  COALESCE(SUM(CASE WHEN ac.model ILIKE '%perplexity%' OR ac.model ILIKE '%llama%' THEN ac.cost_cents ELSE 0 END), 0) AS perplexity_cost_cents,
  COALESCE(SUM(CASE WHEN ac.model ILIKE '%tavily%' THEN ac.cost_cents ELSE 0 END), 0) AS tavily_cost_cents,
  COALESCE(SUM(ac.cost_cents), 0) AS total_cost_cents,

  -- Token breakdown
  COALESCE(SUM(ac.input_tokens), 0) AS total_input_tokens,
  COALESCE(SUM(ac.output_tokens), 0) AS total_output_tokens,

  -- Step breakdown (scan vs enrichment)
  COALESCE(SUM(CASE WHEN ac.step NOT ILIKE '%enrich%' AND ac.step NOT ILIKE '%brand%' AND ac.step NOT ILIKE '%action%' AND ac.step NOT ILIKE '%prd%' THEN ac.cost_cents ELSE 0 END), 0) AS scan_cost_cents,
  COALESCE(SUM(CASE WHEN ac.step ILIKE '%enrich%' OR ac.step ILIKE '%brand%' OR ac.step ILIKE '%action%' OR ac.step ILIKE '%prd%' THEN ac.cost_cents ELSE 0 END), 0) AS enrichment_cost_cents

FROM scan_runs sr
LEFT JOIN leads l ON sr.lead_id = l.id
LEFT JOIN domain_subscriptions ds ON sr.domain_subscription_id = ds.id
LEFT JOIN api_costs ac ON ac.run_id = sr.id

GROUP BY
  sr.id,
  sr.domain,
  sr.created_at,
  ds.id,
  ds.tier,
  l.email,
  l.tier

ORDER BY sr.created_at DESC;


-- =============================================================================
-- SUMMARY: AVERAGE COST BY SCAN TYPE (FREE VS PAID)
-- =============================================================================

SELECT
  CASE WHEN ds.id IS NOT NULL THEN 'paid' ELSE 'free' END AS scan_type,
  COUNT(DISTINCT sr.id) AS scan_count,
  ROUND(AVG(COALESCE(ac_totals.total_cost_cents, 0)) / 100.0, 2) AS avg_cost_dollars,
  ROUND(SUM(COALESCE(ac_totals.total_cost_cents, 0)) / 100.0, 2) AS total_cost_dollars
FROM scan_runs sr
LEFT JOIN domain_subscriptions ds ON sr.domain_subscription_id = ds.id
LEFT JOIN (
  SELECT run_id, SUM(cost_cents) AS total_cost_cents
  FROM api_costs
  GROUP BY run_id
) ac_totals ON ac_totals.run_id = sr.id
GROUP BY CASE WHEN ds.id IS NOT NULL THEN 'paid' ELSE 'free' END
ORDER BY scan_type;


-- =============================================================================
-- MONTHLY COST TREND
-- =============================================================================

SELECT
  DATE_TRUNC('month', sr.created_at) AS month,
  CASE WHEN ds.id IS NOT NULL THEN 'paid' ELSE 'free' END AS scan_type,
  COUNT(DISTINCT sr.id) AS scans,
  ROUND(SUM(COALESCE(ac.cost_cents, 0)) / 100.0, 2) AS total_dollars
FROM scan_runs sr
LEFT JOIN domain_subscriptions ds ON sr.domain_subscription_id = ds.id
LEFT JOIN api_costs ac ON ac.run_id = sr.id
GROUP BY 1, 2
ORDER BY 1 DESC, 2;


-- =============================================================================
-- COST BREAKDOWN BY LLM PROVIDER
-- =============================================================================

SELECT
  ac.model,
  COUNT(*) AS api_calls,
  SUM(ac.input_tokens) AS total_input_tokens,
  SUM(ac.output_tokens) AS total_output_tokens,
  ROUND(SUM(ac.cost_cents) / 100.0, 2) AS total_cost_dollars,
  ROUND(AVG(ac.cost_cents) / 100.0, 4) AS avg_cost_per_call
FROM api_costs ac
GROUP BY ac.model
ORDER BY total_cost_dollars DESC;


-- =============================================================================
-- COST BREAKDOWN BY STEP
-- =============================================================================

SELECT
  ac.step,
  COUNT(*) AS calls,
  SUM(ac.input_tokens) AS total_input_tokens,
  SUM(ac.output_tokens) AS total_output_tokens,
  ROUND(SUM(ac.cost_cents) / 100.0, 2) AS total_cost_dollars,
  ROUND(AVG(ac.cost_cents) / 100.0, 4) AS avg_cost_per_call
FROM api_costs ac
GROUP BY ac.step
ORDER BY total_cost_dollars DESC;
