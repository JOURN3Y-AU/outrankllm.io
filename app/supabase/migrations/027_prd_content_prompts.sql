-- ============================================
-- PRD CONTENT PROMPTS
-- Separate code tasks from content requirements
-- ============================================

-- Add content-related columns to prd_tasks
ALTER TABLE prd_tasks
  ADD COLUMN IF NOT EXISTS requires_content BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS content_prompts JSONB;

-- Comments
COMMENT ON COLUMN prd_tasks.requires_content IS 'True if this task requires content to be written before code implementation';
COMMENT ON COLUMN prd_tasks.content_prompts IS 'Array of content prompts for text that needs to be written separately (case studies, testimonials, etc.)';

-- Content prompts structure:
-- [
--   {
--     "type": "Case Study",
--     "prompt": "Write a case study about...",
--     "usedIn": "pages/case-studies/client.tsx",
--     "wordCount": 500
--   }
-- ]
