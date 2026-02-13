-- Update sentiment_category to 4-tier system
-- strong (9-10), positive (6-8), mixed (4-5), negative (1-3)

-- Drop existing constraint FIRST
ALTER TABLE llm_responses DROP CONSTRAINT IF EXISTS llm_responses_sentiment_category_check;

-- Update existing data BEFORE adding new constraint
-- 'neutral' -> 'mixed'
UPDATE llm_responses SET sentiment_category = 'mixed' WHERE sentiment_category = 'neutral';

-- Also recategorize based on score for more accuracy:
-- Scores 8-10 should be 'strong' not 'positive'
UPDATE llm_responses SET sentiment_category = 'strong' WHERE sentiment_score >= 8 AND sentiment_category = 'positive';

-- Scores 6-7 stay as 'positive'
-- Scores 4-5 are 'mixed' (already updated from 'neutral')
-- Scores 1-3 stay as 'negative'

-- Add new constraint with 4 tiers
ALTER TABLE llm_responses ADD CONSTRAINT llm_responses_sentiment_category_check
  CHECK (sentiment_category IN ('strong', 'positive', 'mixed', 'negative'));

-- Update comment
COMMENT ON COLUMN llm_responses.sentiment_category IS 'Derived: strong (8-10), positive (6-7), mixed (4-5), negative (1-3)';
