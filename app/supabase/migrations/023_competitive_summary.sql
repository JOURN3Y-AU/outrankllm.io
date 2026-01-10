-- ============================================
-- COMPETITIVE SUMMARY
-- Claude-synthesized competitive intelligence summary
-- ============================================

-- Add competitive_summary column to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS competitive_summary JSONB DEFAULT NULL;

-- The structure is:
-- {
--   "strengths": ["Strength 1", "Strength 2", ...],
--   "weaknesses": ["Weakness 1", "Weakness 2", ...],
--   "opportunities": ["Opportunity 1", "Opportunity 2", ...],
--   "overallPosition": "Overall competitive position summary"
-- }

COMMENT ON COLUMN reports.competitive_summary IS 'Claude-synthesized competitive intelligence summary with strengths, weaknesses, opportunities, and overall positioning';
