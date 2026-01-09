-- ============================================
-- ACTION PLANS
-- AI-generated recommendations for improving visibility
-- ============================================

-- Priority levels for actions
CREATE TYPE action_priority AS ENUM ('quick_win', 'strategic', 'backlog');

-- Action status for tracking completion
CREATE TYPE action_status AS ENUM ('pending', 'in_progress', 'completed', 'dismissed');

-- Main table for action plans
CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,

  -- Executive summary
  executive_summary TEXT,

  -- Overall stats
  total_actions INTEGER DEFAULT 0,
  quick_wins_count INTEGER DEFAULT 0,
  strategic_count INTEGER DEFAULT 0,
  backlog_count INTEGER DEFAULT 0,

  -- Generation metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT DEFAULT 'claude-3-haiku',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One plan per run
  UNIQUE(run_id)
);

-- Individual action items
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,

  -- Action details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT, -- Why this action matters

  -- Categorization
  priority action_priority NOT NULL DEFAULT 'backlog',
  category TEXT, -- 'content', 'technical', 'schema', 'citations', etc.

  -- Implementation details
  estimated_impact TEXT, -- 'high', 'medium', 'low'
  estimated_effort TEXT, -- 'quick', 'moderate', 'significant'

  -- For page-specific actions
  target_page TEXT, -- URL or page identifier
  target_element TEXT, -- Specific element to modify

  -- For keyword-related actions
  target_keywords TEXT[], -- Keywords to target

  -- Tracking
  status action_status DEFAULT 'pending',
  completed_at TIMESTAMPTZ,

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_action_plans_lead_id ON action_plans(lead_id);
CREATE INDEX idx_action_plans_run_id ON action_plans(run_id);
CREATE INDEX idx_action_items_plan_id ON action_items(plan_id);
CREATE INDEX idx_action_items_priority ON action_items(plan_id, priority);
CREATE INDEX idx_action_items_status ON action_items(plan_id, status);

-- RLS policies
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Action plans are viewable" ON action_plans
  FOR SELECT
  USING (true);

CREATE POLICY "Action items are viewable" ON action_items
  FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_action_plans_updated_at
  BEFORE UPDATE ON action_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
