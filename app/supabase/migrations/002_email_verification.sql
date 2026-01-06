-- Migration: Email verification, feature flags, and Stripe-ready schema
-- Created: 2025-01-06

-- ============================================
-- EMAIL VERIFICATION TOKENS
-- Magic link verification for report access
-- ============================================
CREATE TABLE email_verification_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_verification_token ON email_verification_tokens(token);
CREATE INDEX idx_verification_email ON email_verification_tokens(email);
CREATE INDEX idx_verification_lead ON email_verification_tokens(lead_id);

-- ============================================
-- FEATURE FLAGS TABLE
-- Enable/disable features per tier
-- ============================================
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled_for_tiers TEXT[] DEFAULT '{free}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SUBSCRIPTIONS TABLE (Stripe-backed)
-- Tracks subscription state for paid users
-- ============================================
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT UNIQUE NOT NULL,
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  tier TEXT NOT NULL DEFAULT 'pro' CHECK (tier IN ('pro', 'enterprise')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_subscriptions_lead ON subscriptions(lead_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- ============================================
-- EMAIL LOGS TABLE
-- Track sent emails for debugging and analytics
-- ============================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  run_id UUID REFERENCES scan_runs(id) ON DELETE SET NULL,
  email_type TEXT NOT NULL CHECK (email_type IN ('verification', 'report_ready', 'marketing')),
  recipient TEXT NOT NULL,
  subject TEXT,
  resend_id TEXT,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_logs_lead ON email_logs(lead_id);
CREATE INDEX idx_email_logs_run ON email_logs(run_id);
CREATE INDEX idx_email_logs_type ON email_logs(email_type);

-- ============================================
-- MODIFY LEADS TABLE
-- Add verification status, tier, and Stripe customer ID
-- ============================================
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tier TEXT DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise'));
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE;

-- ============================================
-- MODIFY SITE_ANALYSES TABLE
-- Add enhanced geo detection fields
-- ============================================
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS tld_country TEXT;
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS detected_country TEXT;
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS geo_confidence TEXT CHECK (geo_confidence IN ('high', 'medium', 'low'));

-- ============================================
-- MODIFY REPORTS TABLE
-- Add verification tracking
-- ============================================
ALTER TABLE reports ADD COLUMN IF NOT EXISTS requires_verification BOOLEAN DEFAULT true;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS verified_views INTEGER DEFAULT 0;

-- ============================================
-- INSERT DEFAULT FEATURE FLAGS
-- ============================================
INSERT INTO feature_flags (name, description, enabled_for_tiers) VALUES
  ('blur_competitors', 'Show only first competitor, blur others', '{free}'),
  ('show_all_competitors', 'Show all competitors without restrictions', '{pro,enterprise}'),
  ('editable_prompts', 'Allow users to edit and customize prompts', '{pro,enterprise}'),
  ('show_prd_tasks', 'Show PRD generation and tasks', '{pro,enterprise}'),
  ('geo_enhanced_prompts', 'Use enhanced geo detection for prompts', '{free,pro,enterprise}'),
  ('unlimited_scans', 'Allow unlimited domain scans', '{pro,enterprise}'),
  ('export_reports', 'Allow exporting reports as PDF/CSV', '{pro,enterprise}')
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================
ALTER TABLE email_verification_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Feature flags are publicly readable
CREATE POLICY "Feature flags are viewable by everyone" ON feature_flags
  FOR SELECT USING (true);

-- Verification tokens: only service role can access
CREATE POLICY "Verification tokens service access" ON email_verification_tokens
  FOR ALL USING (auth.role() = 'service_role');

-- Subscriptions: only service role can access
CREATE POLICY "Subscriptions service access" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- Email logs: only service role can access
CREATE POLICY "Email logs service access" ON email_logs
  FOR ALL USING (auth.role() = 'service_role');
