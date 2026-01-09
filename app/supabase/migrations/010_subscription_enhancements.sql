-- Migration: Subscription enhancements for Stripe integration
-- Created: 2025-01-09

-- ============================================
-- UPDATE TIER CONSTRAINTS
-- Add 'starter' and 'agency' tiers
-- ============================================

-- Update leads tier constraint
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_tier_check;
ALTER TABLE leads ADD CONSTRAINT leads_tier_check
  CHECK (tier IN ('free', 'starter', 'pro', 'agency'));

-- Update subscriptions tier constraint
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_tier_check
  CHECK (tier IN ('starter', 'pro', 'agency'));

-- ============================================
-- REPORT EXPIRY (TTL)
-- Free reports expire after a configurable period
-- ============================================

ALTER TABLE reports ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS subscriber_only BOOLEAN DEFAULT false;

-- Set default expiry for existing reports (3 days from creation)
-- Only for reports that don't have subscriber_only set
UPDATE reports
SET expires_at = created_at + INTERVAL '3 days'
WHERE expires_at IS NULL AND subscriber_only = false;

-- ============================================
-- INDEX FOR EXPIRY QUERIES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_reports_expires_at ON reports(expires_at);

-- ============================================
-- UPDATE FEATURE FLAGS FOR NEW TIERS
-- ============================================
UPDATE feature_flags
SET enabled_for_tiers = '{free,starter,pro,agency}'
WHERE name = 'geo_enhanced_prompts';

UPDATE feature_flags
SET enabled_for_tiers = '{starter,pro,agency}'
WHERE name IN ('show_all_competitors', 'editable_prompts', 'show_prd_tasks', 'unlimited_scans', 'export_reports');

UPDATE feature_flags
SET enabled_for_tiers = '{free}'
WHERE name = 'blur_competitors';
