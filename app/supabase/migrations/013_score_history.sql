-- ============================================
-- SCORE HISTORY
-- Track visibility scores over time for trend charts
-- ============================================

-- Score snapshots taken after each scan run
CREATE TABLE score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,

  -- Overall visibility score (reach-weighted)
  visibility_score DECIMAL(5,2) NOT NULL,

  -- Per-platform scores
  chatgpt_score DECIMAL(5,2),
  claude_score DECIMAL(5,2),
  gemini_score DECIMAL(5,2),
  perplexity_score DECIMAL(5,2),

  -- Additional metrics for detailed trends
  query_coverage DECIMAL(5,2),  -- % of queries with mentions
  total_queries INTEGER,
  total_mentions INTEGER,

  -- Readiness score (AI-readiness indicators)
  readiness_score DECIMAL(5,2),

  -- Timestamp (use scan completion time)
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ensure one score per run
  UNIQUE(run_id)
);

-- Indexes for efficient trend queries
CREATE INDEX idx_score_history_lead_id ON score_history(lead_id);
CREATE INDEX idx_score_history_recorded_at ON score_history(lead_id, recorded_at DESC);

-- RLS policies
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Score history is viewable" ON score_history
  FOR SELECT
  USING (true);

-- Function to automatically record score after scan completion
-- This will be called from the application code after processing
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
  p_readiness_score DECIMAL DEFAULT NULL
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
    recorded_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;
