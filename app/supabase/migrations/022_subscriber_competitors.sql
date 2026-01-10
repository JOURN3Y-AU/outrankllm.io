-- ============================================
-- SUBSCRIBER COMPETITORS
-- Competitors that subscribers want to track for positioning analysis
-- ============================================

-- Source type for tracking where competitors came from
CREATE TYPE competitor_source AS ENUM ('detected', 'user_added');

-- Main table for subscriber competitors
CREATE TABLE subscriber_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source competitor_source DEFAULT 'user_added',
  is_active BOOLEAN DEFAULT TRUE,  -- Include in positioning queries
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure unique competitor names per subscriber
  UNIQUE(lead_id, name)
);

-- Indexes
CREATE INDEX idx_subscriber_competitors_lead_id ON subscriber_competitors(lead_id);
CREATE INDEX idx_subscriber_competitors_active ON subscriber_competitors(lead_id, is_active);

-- RLS policies
ALTER TABLE subscriber_competitors ENABLE ROW LEVEL SECURITY;

-- Allow reading subscriber competitors (service role handles auth)
CREATE POLICY "Subscriber competitors are viewable" ON subscriber_competitors
  FOR SELECT
  USING (true);

-- Trigger to update updated_at
CREATE TRIGGER update_subscriber_competitors_updated_at
  BEFORE UPDATE ON subscriber_competitors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
