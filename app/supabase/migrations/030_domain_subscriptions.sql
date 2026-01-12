-- Migration: Multi-domain subscriptions
-- Created: 2025-01-12
--
-- This migration introduces domain_subscriptions to support users monitoring
-- multiple domains, each with its own subscription (Starter or Pro tier).
--
-- Key changes:
-- 1. New domain_subscriptions table (replaces subscriptions for domain-level tracking)
-- 2. Add domain_subscription_id to scan_runs
-- 3. Add domain_subscription_id to subscriber_questions
-- 4. Migrate existing subscription data

-- ============================================
-- DOMAIN SUBSCRIPTIONS TABLE
-- One row per domain being monitored
-- ============================================
CREATE TABLE domain_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro')),

  -- Stripe integration
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Weekly scan schedule (moved from leads table)
  scan_schedule_day INTEGER DEFAULT 1 CHECK (scan_schedule_day >= 0 AND scan_schedule_day <= 6),
  scan_schedule_hour INTEGER DEFAULT 9 CHECK (scan_schedule_hour >= 0 AND scan_schedule_hour <= 23),
  scan_timezone TEXT DEFAULT 'Australia/Sydney',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One subscription per domain per user
  UNIQUE(lead_id, domain)
);

-- Indexes for common queries
CREATE INDEX idx_domain_subscriptions_lead ON domain_subscriptions(lead_id);
CREATE INDEX idx_domain_subscriptions_stripe ON domain_subscriptions(stripe_subscription_id);
CREATE INDEX idx_domain_subscriptions_status ON domain_subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_domain_subscriptions_schedule
  ON domain_subscriptions(status, scan_schedule_day, scan_schedule_hour, scan_timezone)
  WHERE status = 'active';

-- Trigger for updated_at
CREATE TRIGGER update_domain_subscriptions_updated_at
  BEFORE UPDATE ON domain_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE domain_subscriptions IS 'Tracks domain-level subscriptions - one per monitored domain';
COMMENT ON COLUMN domain_subscriptions.scan_schedule_day IS 'Day of week for weekly scan: 0=Sun, 1=Mon, ..., 6=Sat';
COMMENT ON COLUMN domain_subscriptions.scan_schedule_hour IS 'Hour of day (0-23) in local time for weekly scan';
COMMENT ON COLUMN domain_subscriptions.scan_timezone IS 'IANA timezone string for interpreting schedule';

-- ============================================
-- ADD DOMAIN_SUBSCRIPTION_ID TO SCAN_RUNS
-- Links scans to specific domain subscriptions
-- ============================================
ALTER TABLE scan_runs
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE SET NULL;

CREATE INDEX idx_scan_runs_domain_subscription ON scan_runs(domain_subscription_id);

COMMENT ON COLUMN scan_runs.domain_subscription_id IS 'Links to domain_subscriptions for subscriber scans. NULL for free user scans.';

-- ============================================
-- ADD DOMAIN_SUBSCRIPTION_ID TO SUBSCRIBER_QUESTIONS
-- Questions are per-domain subscription
-- ============================================
ALTER TABLE subscriber_questions
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_subscriber_questions_domain_subscription ON subscriber_questions(domain_subscription_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE domain_subscriptions ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Domain subscriptions service access" ON domain_subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- MIGRATE EXISTING DATA
-- Only runs if there's existing data to migrate
-- ============================================

-- Step 1: Migrate subscriptions + leads data to domain_subscriptions
INSERT INTO domain_subscriptions (
  lead_id,
  domain,
  tier,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  scan_schedule_day,
  scan_schedule_hour,
  scan_timezone,
  created_at
)
SELECT
  l.id as lead_id,
  l.domain,
  -- Map tier: agency users keep their domain as 'pro' for now
  CASE WHEN COALESCE(s.tier, l.tier) = 'agency' THEN 'pro' ELSE COALESCE(s.tier, l.tier) END as tier,
  s.stripe_subscription_id,
  s.stripe_price_id,
  COALESCE(s.status, 'active') as status,
  s.current_period_start,
  s.current_period_end,
  COALESCE(s.cancel_at_period_end, false),
  COALESCE(l.scan_schedule_day, 1),
  COALESCE(l.scan_schedule_hour, 9),
  COALESCE(l.scan_timezone, 'Australia/Sydney'),
  COALESCE(s.created_at, l.created_at)
FROM leads l
LEFT JOIN subscriptions s ON s.lead_id = l.id
WHERE l.tier IN ('starter', 'pro', 'agency')
  AND l.domain IS NOT NULL
ON CONFLICT (lead_id, domain) DO NOTHING;

-- Step 2: Link existing scan_runs to domain_subscriptions
UPDATE scan_runs sr
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
JOIN leads l ON ds.lead_id = l.id AND ds.domain = l.domain
WHERE sr.lead_id = l.id
  AND sr.domain_subscription_id IS NULL;

-- Step 3: Link existing subscriber_questions to domain_subscriptions
UPDATE subscriber_questions sq
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
WHERE sq.lead_id = ds.lead_id
  AND sq.domain_subscription_id IS NULL;
