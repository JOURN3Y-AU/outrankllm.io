-- ============================================
-- PRD DOCUMENTS
-- Claude Code / Cursor ready PRD generation
-- Available for Pro and Agency tiers only
-- ============================================

-- PRD section types
CREATE TYPE prd_section_type AS ENUM ('quick_wins', 'strategic', 'backlog');

-- Main PRD document
CREATE TABLE prd_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES scan_runs(id) ON DELETE CASCADE,

  -- Document metadata
  title TEXT NOT NULL,
  overview TEXT, -- High-level summary
  goals TEXT[], -- Key objectives

  -- Technical context
  tech_stack TEXT[], -- Detected or specified tech stack
  target_platforms TEXT[], -- Web, mobile, etc.

  -- Generation metadata
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT DEFAULT 'claude-3-haiku',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One PRD per run
  UNIQUE(run_id)
);

-- PRD tasks/items
CREATE TABLE prd_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prd_id UUID NOT NULL REFERENCES prd_documents(id) ON DELETE CASCADE,

  -- Task details
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  acceptance_criteria TEXT[], -- Testable criteria

  -- Categorization
  section prd_section_type NOT NULL DEFAULT 'backlog',
  category TEXT, -- 'content', 'technical', 'schema', 'seo', etc.

  -- Priority and effort
  priority INTEGER DEFAULT 0, -- 1-5 scale
  estimated_hours DECIMAL(5,2), -- Rough estimate

  -- Implementation details
  file_paths TEXT[], -- Files to modify
  code_snippets JSONB, -- Example code/config

  -- Dependencies
  depends_on UUID[], -- Other task IDs this depends on
  blocks UUID[], -- Task IDs this blocks

  -- For Claude Code / Cursor
  prompt_context TEXT, -- Additional context for AI coding tools
  implementation_notes TEXT, -- Specific implementation guidance

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_prd_documents_lead_id ON prd_documents(lead_id);
CREATE INDEX idx_prd_documents_run_id ON prd_documents(run_id);
CREATE INDEX idx_prd_tasks_prd_id ON prd_tasks(prd_id);
CREATE INDEX idx_prd_tasks_section ON prd_tasks(prd_id, section);

-- RLS policies
ALTER TABLE prd_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE prd_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "PRD documents are viewable" ON prd_documents
  FOR SELECT
  USING (true);

CREATE POLICY "PRD tasks are viewable" ON prd_tasks
  FOR SELECT
  USING (true);

-- Triggers
CREATE TRIGGER update_prd_documents_updated_at
  BEFORE UPDATE ON prd_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prd_tasks_updated_at
  BEFORE UPDATE ON prd_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
