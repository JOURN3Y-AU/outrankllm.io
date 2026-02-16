-- Add role family support to HiringBrand
-- This enables tracking sentiment and AI awareness for specific job families (Engineering, Business, Operations, etc.)

-- Add max_role_families limit to organizations (tier-based)
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS max_role_families INTEGER DEFAULT 5;

-- Add detected role families to site_analyses
-- Stores AI-classified job families from commonRoles during employer analysis
ALTER TABLE site_analyses
ADD COLUMN detected_job_families JSONB DEFAULT '[]';

COMMENT ON COLUMN site_analyses.detected_job_families IS 'AI-classified job families: [{ family: "engineering", roles: ["Software Engineer"], relevance: 0.9 }]';

-- Add job_family column to llm_responses
-- Tags each response with the relevant job family for filtering
ALTER TABLE llm_responses
ADD COLUMN job_family TEXT CHECK (job_family IN ('engineering', 'business', 'operations', 'creative', 'corporate', 'general'));

CREATE INDEX idx_llm_responses_job_family ON llm_responses(job_family);

COMMENT ON COLUMN llm_responses.job_family IS 'Job family this response is about (null for general responses)';

-- Add role_family_scores to hb_score_history
-- Stores desirability and awareness scores per role family over time
ALTER TABLE hb_score_history
ADD COLUMN role_family_scores JSONB DEFAULT '{}';

COMMENT ON COLUMN hb_score_history.role_family_scores IS 'Per-family scores: { engineering: { desirability: 72, awareness: 68 }, ... }';

-- Add role_action_plans to reports (HiringBrand brand filter applied in queries)
-- Stores strategic action plans specific to each role family
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS role_action_plans JSONB DEFAULT '{}';

COMMENT ON COLUMN reports.role_action_plans IS 'Role-specific action plans: { engineering: { executiveSummary: "...", strengths: [...], gaps: [...], recommendations: [...] } }';

-- Create hb_frozen_role_families table
-- Allows users to manually override AI-detected families (similar to frozen_competitors/frozen_questions)
CREATE TABLE IF NOT EXISTS hb_frozen_role_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  monitored_domain_id UUID NOT NULL REFERENCES monitored_domains(id) ON DELETE CASCADE,
  family TEXT NOT NULL CHECK (family IN ('engineering', 'business', 'operations', 'creative', 'corporate', 'general')),
  display_name TEXT NOT NULL, -- e.g., "Engineering & Tech"
  description TEXT, -- e.g., "Software engineers, data scientists, DevOps"
  source TEXT NOT NULL DEFAULT 'user_custom', -- 'employer_research' or 'user_custom'
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_hb_frozen_role_families_org ON hb_frozen_role_families(organization_id);
CREATE INDEX idx_hb_frozen_role_families_domain ON hb_frozen_role_families(monitored_domain_id);
CREATE UNIQUE INDEX idx_hb_frozen_role_families_unique ON hb_frozen_role_families(monitored_domain_id, family) WHERE is_active = true;

COMMENT ON TABLE hb_frozen_role_families IS 'User-configured role families for custom employer brand analysis';
COMMENT ON COLUMN hb_frozen_role_families.family IS 'Standard family code (engineering, business, operations, creative, corporate, general)';
COMMENT ON COLUMN hb_frozen_role_families.display_name IS 'User-facing label shown in UI';
COMMENT ON COLUMN hb_frozen_role_families.source IS 'employer_research (AI-detected) or user_custom (manual override)';
