-- ============================================
-- ADD PER-PLATFORM MENTION COUNTS TO SCORE_HISTORY
-- Track absolute mention counts per platform for trend charts
-- ============================================

-- Add per-platform mention count columns
ALTER TABLE score_history
  ADD COLUMN IF NOT EXISTS chatgpt_mentions INTEGER,
  ADD COLUMN IF NOT EXISTS claude_mentions INTEGER,
  ADD COLUMN IF NOT EXISTS gemini_mentions INTEGER,
  ADD COLUMN IF NOT EXISTS perplexity_mentions INTEGER;

-- Update the record_score_snapshot function to accept new columns
CREATE OR REPLACE FUNCTION record_score_snapshot(
  p_lead_id UUID,
  p_run_id UUID,
  p_visibility_score DECIMAL,
  p_chatgpt_score DECIMAL DEFAULT NULL,
  p_claude_score DECIMAL DEFAULT NULL,
  p_gemini_score DECIMAL DEFAULT NULL,
  p_perplexity_score DECIMAL DEFAULT NULL,
  p_query_coverage DECIMAL DEFAULT NULL,
  p_total_queries INTEGER DEFAULT NULL,
  p_total_mentions INTEGER DEFAULT NULL,
  p_readiness_score DECIMAL DEFAULT NULL,
  p_chatgpt_mentions INTEGER DEFAULT NULL,
  p_claude_mentions INTEGER DEFAULT NULL,
  p_gemini_mentions INTEGER DEFAULT NULL,
  p_perplexity_mentions INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
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
    readiness_score,
    chatgpt_mentions,
    claude_mentions,
    gemini_mentions,
    perplexity_mentions,
    recorded_at
  ) VALUES (
    p_lead_id,
    p_run_id,
    p_visibility_score,
    p_chatgpt_score,
    p_claude_score,
    p_gemini_score,
    p_perplexity_score,
    p_query_coverage,
    p_total_queries,
    p_total_mentions,
    p_readiness_score,
    p_chatgpt_mentions,
    p_claude_mentions,
    p_gemini_mentions,
    p_perplexity_mentions,
    NOW()
  )
  ON CONFLICT (run_id) DO UPDATE SET
    visibility_score = EXCLUDED.visibility_score,
    chatgpt_score = EXCLUDED.chatgpt_score,
    claude_score = EXCLUDED.claude_score,
    gemini_score = EXCLUDED.gemini_score,
    perplexity_score = EXCLUDED.perplexity_score,
    query_coverage = EXCLUDED.query_coverage,
    total_queries = EXCLUDED.total_queries,
    total_mentions = EXCLUDED.total_mentions,
    readiness_score = EXCLUDED.readiness_score,
    chatgpt_mentions = EXCLUDED.chatgpt_mentions,
    claude_mentions = EXCLUDED.claude_mentions,
    gemini_mentions = EXCLUDED.gemini_mentions,
    perplexity_mentions = EXCLUDED.perplexity_mentions,
    recorded_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Backfill existing data from llm_responses
UPDATE score_history sh
SET
  chatgpt_mentions = (
    SELECT COUNT(*) FROM llm_responses lr
    WHERE lr.run_id = sh.run_id AND lr.platform = 'chatgpt' AND lr.domain_mentioned = true
  ),
  claude_mentions = (
    SELECT COUNT(*) FROM llm_responses lr
    WHERE lr.run_id = sh.run_id AND lr.platform = 'claude' AND lr.domain_mentioned = true
  ),
  gemini_mentions = (
    SELECT COUNT(*) FROM llm_responses lr
    WHERE lr.run_id = sh.run_id AND lr.platform = 'gemini' AND lr.domain_mentioned = true
  ),
  perplexity_mentions = (
    SELECT COUNT(*) FROM llm_responses lr
    WHERE lr.run_id = sh.run_id AND lr.platform = 'perplexity' AND lr.domain_mentioned = true
  )
WHERE chatgpt_mentions IS NULL;
