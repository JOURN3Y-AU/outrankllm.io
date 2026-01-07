-- Update category constraints for new query research categories

-- Update scan_prompts category constraint
ALTER TABLE scan_prompts DROP CONSTRAINT IF EXISTS scan_prompts_category_check;
ALTER TABLE scan_prompts ADD CONSTRAINT scan_prompts_category_check
  CHECK (category IN (
    -- New research-based categories
    'finding_provider',
    'product_specific',
    'service',
    'comparison',
    'review',
    'how_to',
    'general',
    -- Legacy categories for backward compatibility
    'location',
    'recommendation'
  ));

-- Also update scan_runs status to include 'researching' and 'brand_awareness'
ALTER TABLE scan_runs DROP CONSTRAINT IF EXISTS scan_runs_status_check;
ALTER TABLE scan_runs ADD CONSTRAINT scan_runs_status_check
  CHECK (status IN ('pending', 'crawling', 'analyzing', 'researching', 'generating', 'querying', 'brand_awareness', 'complete', 'failed'));
