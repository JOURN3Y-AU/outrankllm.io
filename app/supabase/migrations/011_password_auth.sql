-- Migration: Password-based authentication
-- Created: 2025-01-09

-- ============================================
-- ADD PASSWORD FIELDS TO LEADS TABLE
-- ============================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS password_set_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- Index for faster login lookups (only leads with passwords)
CREATE INDEX IF NOT EXISTS idx_leads_email_password ON leads(email) WHERE password_hash IS NOT NULL;

-- ============================================
-- PASSWORD RESET TOKENS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);

-- RLS policies for password_reset_tokens
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can access password reset tokens
CREATE POLICY "Password reset tokens service access" ON password_reset_tokens
  FOR ALL USING (true);
