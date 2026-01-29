-- Migration: Trial Extension Support
-- Adds trial tier columns to leads table for time-limited feature upgrades
-- Trial users get "read-only Starter" features without affecting paid subscribers

-- Add trial columns to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trial_tier TEXT
  CHECK (trial_tier IS NULL OR trial_tier IN ('starter', 'pro', 'agency'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ;

-- Index for efficient trial expiry queries
CREATE INDEX IF NOT EXISTS idx_leads_trial_expires ON leads(trial_expires_at)
  WHERE trial_expires_at IS NOT NULL;

-- Comments for documentation
COMMENT ON COLUMN leads.trial_tier IS 'Temporary tier upgrade for trial promotions. NULL = no active trial. Trial users get read-only access to tier features.';
COMMENT ON COLUMN leads.trial_expires_at IS 'When trial_tier expires and user reverts to base tier. Checked in getUserTier() after paid subscriptions.';
