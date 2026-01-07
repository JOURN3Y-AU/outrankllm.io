-- Add 'perplexity' to the allowed platforms in all tables
-- This is needed because Perplexity was added as a 4th AI platform

-- 1. llm_responses table
ALTER TABLE llm_responses DROP CONSTRAINT IF EXISTS llm_responses_platform_check;
ALTER TABLE llm_responses ADD CONSTRAINT llm_responses_platform_check
  CHECK (platform IN ('chatgpt', 'claude', 'gemini', 'perplexity'));

-- 2. brand_awareness_results table
ALTER TABLE brand_awareness_results DROP CONSTRAINT IF EXISTS brand_awareness_results_platform_check;
ALTER TABLE brand_awareness_results ADD CONSTRAINT brand_awareness_results_platform_check
  CHECK (platform IN ('chatgpt', 'claude', 'gemini', 'perplexity'));

-- 3. query_research_results table
ALTER TABLE query_research_results DROP CONSTRAINT IF EXISTS query_research_results_platform_check;
ALTER TABLE query_research_results ADD CONSTRAINT query_research_results_platform_check
  CHECK (platform IN ('chatgpt', 'claude', 'gemini', 'perplexity'));