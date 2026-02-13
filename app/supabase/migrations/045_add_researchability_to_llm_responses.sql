-- Add researchability scoring columns to llm_responses
-- Measures how much specific information AI has about the company

-- Specificity score: How detailed/specific is the response? (1-10)
-- 1 = Very generic ("they have good benefits")
-- 10 = Very specific ("they offer unlimited PTO, 401k matching up to 6%")
ALTER TABLE llm_responses
ADD COLUMN IF NOT EXISTS specificity_score INTEGER CHECK (specificity_score >= 1 AND specificity_score <= 10);

-- Confidence score: How confident is AI in its information? (1-10)
-- 1 = Very uncertain ("I'm not sure, but I think...")
-- 10 = Very confident ("According to employee reviews, they are known for...")
ALTER TABLE llm_responses
ADD COLUMN IF NOT EXISTS confidence_score INTEGER CHECK (confidence_score >= 1 AND confidence_score <= 10);

-- Topics covered: Which employer brand topics are mentioned in this response
-- JSON array of topic strings from predefined list
ALTER TABLE llm_responses
ADD COLUMN IF NOT EXISTS topics_covered JSONB DEFAULT '[]'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN llm_responses.specificity_score IS 'How detailed/specific is the AI response about this employer (1-10)';
COMMENT ON COLUMN llm_responses.confidence_score IS 'How confident is the AI in its information about this employer (1-10)';
COMMENT ON COLUMN llm_responses.topics_covered IS 'Employer brand topics mentioned in response (compensation, benefits, culture, etc.)';
