-- HiringBrand Score History
-- Stores snapshots of scores after each scan for trend tracking

-- Main score history table (your brand over time)
CREATE TABLE IF NOT EXISTS hb_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_domain_id UUID NOT NULL REFERENCES monitored_domains(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  scan_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Core scores
  desirability_score INT,
  awareness_score INT,
  differentiation_score INT,

  -- Platform breakdown
  platform_scores JSONB DEFAULT '{}',  -- {chatgpt: 78, claude: 71, gemini: 65, perplexity: 58}

  -- Competitive position
  competitor_rank INT,  -- Your rank among all employers
  competitor_count INT, -- Total employers in comparison

  -- Dimension scores (for radar chart evolution)
  dimension_scores JSONB DEFAULT '{}',  -- {compensation: 7, culture: 8, growth: 6, ...}

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Competitor history table (track all competitors over time)
CREATE TABLE IF NOT EXISTS hb_competitor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitored_domain_id UUID NOT NULL REFERENCES monitored_domains(id) ON DELETE CASCADE,
  report_id UUID REFERENCES reports(id) ON DELETE SET NULL,
  scan_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Competitor info
  competitor_name TEXT NOT NULL,
  is_target BOOLEAN DEFAULT FALSE,

  -- Scores
  composite_score DECIMAL(5,2),  -- Average across all dimensions
  differentiation_score INT,

  -- Dimension breakdown
  dimension_scores JSONB DEFAULT '{}',  -- {compensation: 7, culture: 8, ...}

  -- Ranking
  rank_by_composite INT,
  rank_by_differentiation INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hb_score_history_domain_date
  ON hb_score_history(monitored_domain_id, scan_date DESC);

CREATE INDEX IF NOT EXISTS idx_hb_competitor_history_domain_date
  ON hb_competitor_history(monitored_domain_id, scan_date DESC);

CREATE INDEX IF NOT EXISTS idx_hb_competitor_history_competitor
  ON hb_competitor_history(monitored_domain_id, competitor_name, scan_date DESC);

-- Comments
COMMENT ON TABLE hb_score_history IS 'Tracks HiringBrand score snapshots over time for trend analysis';
COMMENT ON TABLE hb_competitor_history IS 'Tracks competitor employer scores over time for competitive trend analysis';
