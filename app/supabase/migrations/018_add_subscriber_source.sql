-- ============================================
-- ADD SUBSCRIBER SOURCE TO SCAN_PROMPTS
-- Allows prompts to be sourced from subscriber_questions
-- ============================================

-- Drop the existing constraint
ALTER TABLE scan_prompts DROP CONSTRAINT IF EXISTS scan_prompts_source_check;

-- Add updated constraint with 'subscriber' option
ALTER TABLE scan_prompts ADD CONSTRAINT scan_prompts_source_check
  CHECK (source IN ('generated', 'researched', 'subscriber'));
