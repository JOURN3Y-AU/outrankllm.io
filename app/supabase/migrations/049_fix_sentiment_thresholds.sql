-- Fix sentiment thresholds: strong should be 9-10 only, not 8-10
-- Previous migration incorrectly set score 8 as 'strong'

-- Move score 8 from 'strong' back to 'positive'
UPDATE llm_responses
SET sentiment_category = 'positive'
WHERE sentiment_score = 8 AND sentiment_category = 'strong';

-- Update column comment to reflect correct thresholds
COMMENT ON COLUMN llm_responses.sentiment_category IS 'Derived: strong (9-10), positive (6-8), mixed (4-5), negative (1-3)';
