-- outrankllm.io Database Schema
-- Phase 1: Landing page + scan pipeline + reports

-- ============================================
-- LEADS TABLE
-- Users/leads who submit domains for scanning
-- ============================================
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  domain TEXT NOT NULL,
  marketing_opt_in BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(email, domain)
);

-- Index for email lookups
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_domain ON leads(domain);

-- ============================================
-- SCAN RUNS TABLE
-- Individual scan executions
-- ============================================
CREATE TABLE scan_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'crawling', 'analyzing', 'generating', 'querying', 'complete', 'failed')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for status queries
CREATE INDEX idx_scan_runs_status ON scan_runs(status);
CREATE INDEX idx_scan_runs_lead_id ON scan_runs(lead_id);

-- ============================================
-- SITE ANALYSES TABLE
-- Results of analyzing what the site sells/does
-- ============================================
CREATE TABLE site_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  business_type TEXT,
  business_name TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  target_audience TEXT,
  key_phrases TEXT[] DEFAULT '{}',
  pages_crawled INTEGER DEFAULT 0,
  raw_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for run lookups
CREATE INDEX idx_site_analyses_run_id ON site_analyses(run_id);

-- ============================================
-- SCAN PROMPTS TABLE
-- Generated prompts for each scan
-- ============================================
CREATE TABLE scan_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  category TEXT CHECK (category IN ('general', 'location', 'service', 'comparison', 'recommendation')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for run lookups
CREATE INDEX idx_scan_prompts_run_id ON scan_prompts(run_id);

-- ============================================
-- LLM RESPONSES TABLE
-- Responses from each AI platform
-- ============================================
CREATE TABLE llm_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  prompt_id UUID REFERENCES scan_prompts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('chatgpt', 'claude', 'gemini')),
  response_text TEXT,
  domain_mentioned BOOLEAN DEFAULT false,
  mention_position INTEGER CHECK (mention_position IS NULL OR (mention_position >= 1 AND mention_position <= 3)),
  competitors_mentioned JSONB DEFAULT '[]'::jsonb,
  response_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_llm_responses_run_id ON llm_responses(run_id);
CREATE INDEX idx_llm_responses_prompt_id ON llm_responses(prompt_id);
CREATE INDEX idx_llm_responses_platform ON llm_responses(platform);

-- ============================================
-- REPORTS TABLE
-- Final visibility reports
-- ============================================
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  url_token TEXT UNIQUE NOT NULL,
  visibility_score INTEGER CHECK (visibility_score >= 0 AND visibility_score <= 100),
  platform_scores JSONB DEFAULT '{}'::jsonb,
  top_competitors JSONB DEFAULT '[]'::jsonb,
  summary TEXT,
  recommendations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for token lookups (public report URLs)
CREATE INDEX idx_reports_token ON reports(url_token);
CREATE INDEX idx_reports_run_id ON reports(run_id);

-- ============================================
-- API COSTS TABLE (optional, for tracking)
-- ============================================
CREATE TABLE api_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES scan_runs(id) ON DELETE CASCADE,
  step TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_cents DECIMAL(10, 4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_api_costs_run_id ON api_costs(run_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for leads table
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to generate a random URL token
CREATE OR REPLACE FUNCTION generate_url_token()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'abcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..12 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Note: For MVP, we use service role key for all operations
-- RLS can be added later for user authentication
-- ============================================

-- Enable RLS on all tables (but allow service role full access)
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_costs ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (bypasses RLS)
-- Note: In production, you'd add more specific policies for authenticated users

-- Allow anyone to read reports by token (for public report URLs)
CREATE POLICY "Reports are viewable by token" ON reports
  FOR SELECT
  USING (true);

-- Allow anyone to read related data for reports
CREATE POLICY "Site analyses are viewable" ON site_analyses
  FOR SELECT
  USING (true);

CREATE POLICY "Scan prompts are viewable" ON scan_prompts
  FOR SELECT
  USING (true);

CREATE POLICY "LLM responses are viewable" ON llm_responses
  FOR SELECT
  USING (true);

CREATE POLICY "Scan runs are viewable" ON scan_runs
  FOR SELECT
  USING (true);
