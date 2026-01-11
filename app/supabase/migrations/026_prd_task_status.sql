-- ============================================
-- PRD TASK STATUS AND HISTORY
-- Track completed PRD tasks across regenerations
-- ============================================

-- Add status field to prd_tasks
ALTER TABLE prd_tasks
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'dismissed')),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Archive table for completed PRD tasks (preserved across regenerations)
-- When weekly rescans generate new PRDs, completed tasks move here
CREATE TABLE IF NOT EXISTS prd_tasks_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  original_task_id UUID,                                           -- Reference to original prd_tasks.id
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  section TEXT,                                                    -- 'quick_wins', 'strategic', 'backlog'
  category TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  scan_run_id UUID REFERENCES scan_runs(id),                       -- Which scan this was completed during
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prd_tasks_status ON prd_tasks(prd_id, status);
CREATE INDEX IF NOT EXISTS idx_prd_history_lead ON prd_tasks_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_prd_history_completed ON prd_tasks_history(completed_at);

-- RLS policies
ALTER TABLE prd_tasks_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PRD history is viewable" ON prd_tasks_history;
CREATE POLICY "PRD history is viewable" ON prd_tasks_history
  FOR SELECT
  USING (true);

-- Comments
COMMENT ON COLUMN prd_tasks.status IS 'Task status: pending, completed, or dismissed';
COMMENT ON COLUMN prd_tasks.completed_at IS 'When the task was marked complete';
COMMENT ON TABLE prd_tasks_history IS 'Archive of completed PRD tasks, preserved when PRDs regenerate on weekly scans';
