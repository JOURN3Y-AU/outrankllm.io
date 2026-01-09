-- ============================================
-- RE-BACKFILL SCORE HISTORY
-- Clear and repopulate score_history from reports
-- This ensures data consistency
-- ============================================

-- First, clear existing score_history data
TRUNCATE score_history;

-- Re-insert score history records from completed scan runs
-- Uses the report's visibility_score and platform_scores
INSERT INTO score_history (
  lead_id,
  run_id,
  visibility_score,
  chatgpt_score,
  claude_score,
  gemini_score,
  perplexity_score,
  query_coverage,
  total_queries,
  total_mentions,
  recorded_at
)
SELECT
  sr.lead_id,
  sr.id as run_id,
  COALESCE(r.visibility_score, 0) as visibility_score,
  (r.platform_scores->>'chatgpt')::DECIMAL as chatgpt_score,
  (r.platform_scores->>'claude')::DECIMAL as claude_score,
  (r.platform_scores->>'gemini')::DECIMAL as gemini_score,
  (r.platform_scores->>'perplexity')::DECIMAL as perplexity_score,
  -- Calculate query coverage from llm_responses
  (
    SELECT
      CASE
        WHEN COUNT(*) > 0 THEN (COUNT(*) FILTER (WHERE domain_mentioned = true)::DECIMAL / COUNT(*)::DECIMAL) * 100
        ELSE 0
      END
    FROM llm_responses lr
    WHERE lr.run_id = sr.id
  ) as query_coverage,
  -- Total queries
  (SELECT COUNT(*) FROM llm_responses lr WHERE lr.run_id = sr.id) as total_queries,
  -- Total mentions
  (SELECT COUNT(*) FROM llm_responses lr WHERE lr.run_id = sr.id AND lr.domain_mentioned = true) as total_mentions,
  -- Use completed_at if available, otherwise created_at
  COALESCE(sr.completed_at, sr.created_at) as recorded_at
FROM scan_runs sr
JOIN reports r ON r.run_id = sr.id
WHERE sr.status = 'complete'
ORDER BY sr.created_at ASC;

-- Log how many records were inserted
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count FROM score_history;
  RAISE NOTICE 'Score history now contains % records', inserted_count;
END $$;
