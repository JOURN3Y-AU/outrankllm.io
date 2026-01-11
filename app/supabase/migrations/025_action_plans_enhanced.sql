-- ============================================
-- ACTION PLANS ENHANCEMENTS
-- Add comprehensive action plan fields and history tracking
-- ============================================

-- Add new JSONB columns to action_plans for structured output sections
ALTER TABLE action_plans
  ADD COLUMN IF NOT EXISTS page_edits JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS content_priorities JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS keyword_map JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS key_takeaways JSONB DEFAULT '[]';

-- Add enhanced fields to action_items for richer recommendations
ALTER TABLE action_items
  ADD COLUMN IF NOT EXISTS consensus TEXT[] DEFAULT '{}',           -- Which AI platforms support this (e.g., ['chatgpt', 'claude'])
  ADD COLUMN IF NOT EXISTS implementation_steps TEXT[] DEFAULT '{}', -- Step-by-step implementation guide
  ADD COLUMN IF NOT EXISTS expected_outcome TEXT,                    -- What improvement this will drive
  ADD COLUMN IF NOT EXISTS source_insight TEXT;                      -- Links action to specific scan data (e.g., "Based on your AI Responses...")

-- Archive table for completed actions (preserved across regenerations)
-- When weekly rescans generate new action plans, completed actions move here
-- so users see their progress and don't get re-suggested the same fixes
CREATE TABLE IF NOT EXISTS action_items_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  original_action_id UUID,                                           -- Reference to original action_items.id
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  scan_run_id UUID REFERENCES scan_runs(id),                        -- Which scan this was completed during
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_action_history_lead ON action_items_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_action_history_completed ON action_items_history(completed_at);

-- RLS policies
ALTER TABLE action_items_history ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy to avoid "already exists" error on re-runs
DROP POLICY IF EXISTS "Action history is viewable" ON action_items_history;
CREATE POLICY "Action history is viewable" ON action_items_history
  FOR SELECT
  USING (true);

-- Comments for documentation
COMMENT ON COLUMN action_plans.page_edits IS 'Page-by-page edit guide with meta titles, descriptions, and content to add';
COMMENT ON COLUMN action_plans.content_priorities IS 'New content pieces to create with target questions and suggested URLs';
COMMENT ON COLUMN action_plans.keyword_map IS 'Keyword integration map: keyword, best page, where to add, priority';
COMMENT ON COLUMN action_plans.key_takeaways IS 'Summary takeaways with data-backed insights';
COMMENT ON COLUMN action_items.consensus IS 'Which AI platforms data supports this recommendation';
COMMENT ON COLUMN action_items.implementation_steps IS 'Step-by-step guide for implementing this action';
COMMENT ON COLUMN action_items.source_insight IS 'Links action to specific scan data (e.g., "Based on your AI Responses: ...")';
COMMENT ON TABLE action_items_history IS 'Archive of completed actions, preserved when action plans regenerate on weekly scans';
