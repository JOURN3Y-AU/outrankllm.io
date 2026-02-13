-- Add columns to store sentiment-driving phrases
-- These are the exact quotes from responses that influenced the sentiment score

ALTER TABLE llm_responses
ADD COLUMN IF NOT EXISTS sentiment_positive_phrases text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS sentiment_negative_phrases text[] DEFAULT '{}';

COMMENT ON COLUMN llm_responses.sentiment_positive_phrases IS 'Exact quotes from response that drove the sentiment score up';
COMMENT ON COLUMN llm_responses.sentiment_negative_phrases IS 'Exact quotes from response that drove the sentiment score down';
