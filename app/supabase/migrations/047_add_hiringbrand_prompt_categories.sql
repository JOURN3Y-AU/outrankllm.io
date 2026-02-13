-- Add HiringBrand employer prompt categories and sources to scan_prompts constraints
-- This allows HiringBrand scans to save their prompts

-- Update category constraint
ALTER TABLE scan_prompts DROP CONSTRAINT IF EXISTS scan_prompts_category_check;
ALTER TABLE scan_prompts ADD CONSTRAINT scan_prompts_category_check
  CHECK (category IN (
    -- outrankllm categories (existing)
    'finding_provider',
    'product_specific',
    'service',
    'comparison',
    'review',
    'how_to',
    'general',
    'location',
    'recommendation',
    -- HiringBrand employer categories (new)
    'reputation',
    'culture',
    'compensation',
    'growth',
    'industry',
    'balance',
    'leadership'
  ));

-- Update source constraint
ALTER TABLE scan_prompts DROP CONSTRAINT IF EXISTS scan_prompts_source_check;
ALTER TABLE scan_prompts ADD CONSTRAINT scan_prompts_source_check
  CHECK (source IN (
    -- outrankllm sources (existing)
    'generated',
    'researched',
    'subscriber',
    -- HiringBrand sources (new)
    'employer_research',
    'fallback'
  ));
