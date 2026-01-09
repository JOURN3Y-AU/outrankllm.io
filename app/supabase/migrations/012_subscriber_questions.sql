-- ============================================
-- SUBSCRIBER QUESTIONS
-- Custom questions that subscribers can add/edit
-- ============================================

-- Source type for tracking where questions came from
CREATE TYPE question_source AS ENUM ('ai_generated', 'user_created');

-- Main table for subscriber custom questions
CREATE TABLE subscriber_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT DEFAULT 'custom',
  source question_source DEFAULT 'user_created',
  is_active BOOLEAN DEFAULT TRUE,
  is_archived BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- If this question was created by editing an original scan prompt
  original_prompt_id UUID REFERENCES scan_prompts(id) ON DELETE SET NULL,

  -- Track which scan/run generated this question (for AI-generated questions)
  source_run_id UUID REFERENCES scan_runs(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_subscriber_questions_lead_id ON subscriber_questions(lead_id);
CREATE INDEX idx_subscriber_questions_active ON subscriber_questions(lead_id, is_active, is_archived);

-- Question version history for reverting
CREATE TABLE question_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES subscriber_questions(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by TEXT DEFAULT 'user', -- 'user' or 'system'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for history lookups
CREATE INDEX idx_question_history_question_id ON question_history(question_id);
CREATE INDEX idx_question_history_version ON question_history(question_id, version DESC);

-- RLS policies
ALTER TABLE subscriber_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_history ENABLE ROW LEVEL SECURITY;

-- Allow reading subscriber questions (service role handles auth)
CREATE POLICY "Subscriber questions are viewable" ON subscriber_questions
  FOR SELECT
  USING (true);

CREATE POLICY "Question history is viewable" ON question_history
  FOR SELECT
  USING (true);

-- Trigger to update updated_at on subscriber_questions
CREATE TRIGGER update_subscriber_questions_updated_at
  BEFORE UPDATE ON subscriber_questions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to auto-create history entry on update
CREATE OR REPLACE FUNCTION create_question_history()
RETURNS TRIGGER AS $$
DECLARE
  next_version INTEGER;
BEGIN
  -- Only create history if prompt_text changed
  IF OLD.prompt_text IS DISTINCT FROM NEW.prompt_text THEN
    -- Get the next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
    FROM question_history
    WHERE question_id = OLD.id;

    -- Insert history record with the OLD text (before change)
    INSERT INTO question_history (question_id, prompt_text, version)
    VALUES (OLD.id, OLD.prompt_text, next_version);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create history on update
CREATE TRIGGER create_question_history_trigger
  BEFORE UPDATE ON subscriber_questions
  FOR EACH ROW
  EXECUTE FUNCTION create_question_history();
