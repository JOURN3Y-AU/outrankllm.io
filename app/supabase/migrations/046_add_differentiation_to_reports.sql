-- Add differentiation score and enhanced topic tracking to reports table
-- For HiringBrand employer reputation reports

-- Differentiation score: How unique the employer brand appears to AI (0-100)
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS differentiation_score INTEGER CHECK (differentiation_score >= 0 AND differentiation_score <= 100);

-- Topics with confidence: JSONB array tracking confidence level per topic
-- Format: [{"topic": "compensation", "confidence": "high", "mentions": 5}, ...]
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS topics_with_confidence JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN reports.differentiation_score IS 'How unique the employer brand appears vs competitors (0-100). For HiringBrand.';
COMMENT ON COLUMN reports.topics_with_confidence IS 'Array of topics with confidence levels: high, medium, low, none. For HiringBrand.';
