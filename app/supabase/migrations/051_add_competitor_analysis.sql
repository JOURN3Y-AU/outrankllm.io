-- Add competitor_analysis JSONB field to reports table
-- This stores AI-generated comparison of the monitored employer vs competitors
-- on key employer branding dimensions

ALTER TABLE reports
ADD COLUMN IF NOT EXISTS competitor_analysis jsonb DEFAULT NULL;

COMMENT ON COLUMN reports.competitor_analysis IS 'AI-generated comparison of employer vs competitors on key dimensions (compensation, culture, growth, etc.)';

-- Example structure:
-- {
--   "dimensions": ["compensation", "culture", "growth", "balance", "leadership", "tech", "mission"],
--   "employers": [
--     {
--       "name": "Stripe",
--       "isTarget": true,
--       "scores": { "compensation": 8, "culture": 7, "growth": 9, ... },
--       "highlights": ["Strong engineering culture", "Competitive pay"]
--     },
--     {
--       "name": "Canva",
--       "isTarget": false,
--       "scores": { "compensation": 7, "culture": 9, "growth": 8, ... },
--       "highlights": ["Great work-life balance", "Mission-driven"]
--     }
--   ],
--   "insights": {
--     "strengths": ["compensation", "growth"],
--     "weaknesses": ["balance"],
--     "recommendations": ["Improve work-life balance messaging"]
--   },
--   "generatedAt": "2026-01-31T12:00:00Z"
-- }
