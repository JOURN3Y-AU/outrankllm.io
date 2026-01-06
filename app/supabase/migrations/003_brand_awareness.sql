-- Brand Awareness Results Table
-- Stores results from direct brand awareness queries to AI platforms
-- Migration: 003_brand_awareness.sql
-- Created: 2025-01-06

CREATE TABLE brand_awareness_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('chatgpt', 'claude', 'gemini')),
  query_type TEXT NOT NULL CHECK (query_type IN ('brand_recall', 'service_check', 'competitor_compare')),

  -- What we tested
  tested_entity TEXT NOT NULL,  -- Business name or competitor name
  tested_attribute TEXT,  -- Specific service/product being tested (for service_check)

  -- Results
  entity_recognized BOOLEAN DEFAULT false,
  attribute_mentioned BOOLEAN DEFAULT false,
  response_text TEXT,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),

  -- Competitor comparison (if applicable)
  compared_to TEXT,
  positioning TEXT CHECK (positioning IN ('stronger', 'weaker', 'equal', 'not_compared')),

  response_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_brand_awareness_run ON brand_awareness_results(run_id);
CREATE INDEX idx_brand_awareness_platform ON brand_awareness_results(platform);
CREATE INDEX idx_brand_awareness_query_type ON brand_awareness_results(query_type);

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE brand_awareness_results ENABLE ROW LEVEL SECURITY;

-- Brand awareness results: only service role can insert/update/delete
CREATE POLICY "Brand awareness results service access" ON brand_awareness_results
  FOR ALL USING (auth.role() = 'service_role');

-- Brand awareness results: publicly readable (needed for report pages)
CREATE POLICY "Brand awareness results are viewable by everyone" ON brand_awareness_results
  FOR SELECT USING (true);

-- ============================================
-- FEATURE FLAGS FOR BRAND AWARENESS
-- ============================================
INSERT INTO feature_flags (name, description, enabled_for_tiers) VALUES
  ('show_full_competitor_comparison', 'Full competitor brand analysis', '{pro,enterprise}'),
  ('brand_awareness_history', 'Track brand awareness over time', '{pro,enterprise}')
ON CONFLICT (name) DO NOTHING;
