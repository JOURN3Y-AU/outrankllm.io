-- Add sentiment scoring to llm_responses for HiringBrand employer reputation
-- AI platforms self-rate their response sentiment (1-10 scale)

-- Sentiment score: 1 = very negative, 5 = neutral, 10 = very positive
ALTER TABLE llm_responses ADD COLUMN IF NOT EXISTS sentiment_score INTEGER CHECK (sentiment_score >= 1 AND sentiment_score <= 10);

-- Derived category for easy filtering
ALTER TABLE llm_responses ADD COLUMN IF NOT EXISTS sentiment_category TEXT CHECK (sentiment_category IN ('positive', 'neutral', 'negative'));

-- Index for sentiment queries
CREATE INDEX IF NOT EXISTS idx_llm_responses_sentiment ON llm_responses(sentiment_category);

COMMENT ON COLUMN llm_responses.sentiment_score IS 'AI self-rated sentiment: 1=very negative, 5=neutral, 10=very positive';
COMMENT ON COLUMN llm_responses.sentiment_category IS 'Derived: positive (7-10), neutral (4-6), negative (1-3)';
