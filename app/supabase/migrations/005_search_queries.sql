-- Migration: Search-based query system
-- Created: 2025-01-07
-- Description: Adds support for query research phase and search-enabled LLM queries

-- Table to store query suggestions from each LLM during research phase
CREATE TABLE IF NOT EXISTS query_research_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('chatgpt', 'claude', 'gemini')),
  suggested_query TEXT NOT NULL,
  category TEXT CHECK (category IN ('finding_provider', 'product_specific', 'service', 'comparison', 'review', 'how_to', 'general')),
  selected_for_scan BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_query_research_run ON query_research_results(run_id);
CREATE INDEX IF NOT EXISTS idx_query_research_selected ON query_research_results(run_id, selected_for_scan);

-- Add search tracking columns to llm_responses
ALTER TABLE llm_responses ADD COLUMN IF NOT EXISTS search_enabled BOOLEAN DEFAULT false;
ALTER TABLE llm_responses ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;

-- Add source tracking to scan_prompts (where the query came from)
ALTER TABLE scan_prompts ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'generated'
  CHECK (source IN ('generated', 'researched'));
ALTER TABLE scan_prompts ADD COLUMN IF NOT EXISTS research_result_id UUID REFERENCES query_research_results(id);

-- Add new scan status for research phase
-- Note: status column already exists as TEXT, just documenting new valid value: 'researching'
COMMENT ON TABLE scan_runs IS 'Valid status values: pending, crawling, analyzing, researching, generating, querying, brand_awareness, complete, failed';
