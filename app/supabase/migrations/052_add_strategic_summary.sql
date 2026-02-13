-- Add strategic_summary column to reports table
-- Stores AI-generated executive summary for recruitment agents

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS strategic_summary JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN reports.strategic_summary IS 'AI-generated strategic summary for employer branding reports (HiringBrand). Contains executive summary, recommendations, strengths/gaps analysis.';
