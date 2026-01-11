-- ============================================
-- PRD TASK HISTORY UNIQUE CONSTRAINT
-- Prevent duplicate entries in history table
-- ============================================

-- Add unique constraint to prevent duplicate history entries
-- A task should only appear once in history per lead
ALTER TABLE prd_tasks_history
  ADD CONSTRAINT prd_history_unique_task UNIQUE (lead_id, original_task_id);

-- For tasks without original_task_id (edge case), we still want to prevent
-- exact duplicates, so we add a partial unique index on title
CREATE UNIQUE INDEX IF NOT EXISTS idx_prd_history_unique_title
  ON prd_tasks_history(lead_id, title)
  WHERE original_task_id IS NULL;
