-- HiringBrand.io Organization-based Model
-- Organizations are the billing entity, with multiple team members and monitored domains

-- Organizations table: the paying entity
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'hiringbrand',

  -- Subscription tier
  tier TEXT NOT NULL DEFAULT 'brand', -- 'brand', 'agency_10', 'agency_20', 'enterprise'
  domain_limit INTEGER NOT NULL DEFAULT 1, -- 1, 10, 20, or custom for enterprise

  -- Stripe billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'incomplete'
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team members: users belonging to an organization
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner', 'member'

  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,

  -- Ensure a user can only be in one org (for now)
  UNIQUE(lead_id),
  -- Prevent duplicate memberships
  UNIQUE(organization_id, lead_id)
);

-- Pending invitations
CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID REFERENCES leads(id),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monitored employers (domains)
CREATE TABLE IF NOT EXISTS monitored_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  company_name TEXT,

  -- Primary domains count toward limit, competitors don't
  is_primary BOOLEAN DEFAULT true,

  -- Who added this domain
  added_by UUID REFERENCES leads(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Can't monitor same domain twice in one org
  UNIQUE(organization_id, domain)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_organizations_brand ON organizations(brand);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_sub ON organizations(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_cust ON organizations(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations(status);

CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_lead ON organization_members(lead_id);

CREATE INDEX IF NOT EXISTS idx_org_invites_org ON organization_invites(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON organization_invites(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON organization_invites(token);

CREATE INDEX IF NOT EXISTS idx_monitored_domains_org ON monitored_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_monitored_domains_domain ON monitored_domains(domain);
CREATE INDEX IF NOT EXISTS idx_monitored_domains_primary ON monitored_domains(organization_id, is_primary) WHERE is_primary = true;

-- Helper function to count primary domains for an org
CREATE OR REPLACE FUNCTION get_primary_domain_count(org_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM monitored_domains
  WHERE organization_id = org_id AND is_primary = true;
$$ LANGUAGE SQL STABLE;

-- Helper function to check if org can add more primary domains
CREATE OR REPLACE FUNCTION can_add_primary_domain(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT get_primary_domain_count(org_id) < (
    SELECT domain_limit FROM organizations WHERE id = org_id
  );
$$ LANGUAGE SQL STABLE;

-- Updated_at trigger for organizations
CREATE OR REPLACE FUNCTION update_organizations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_organizations_updated_at();

-- Comments for documentation
COMMENT ON TABLE organizations IS 'HiringBrand.io billing entities - organizations pay for domain monitoring';
COMMENT ON COLUMN organizations.tier IS 'Subscription tier: brand (1 domain), agency_10 (10), agency_20 (20), enterprise (custom)';
COMMENT ON COLUMN organizations.domain_limit IS 'Max primary domains allowed (competitors unlimited)';
COMMENT ON COLUMN organization_members.role IS 'owner can manage billing/team, member can only view';
COMMENT ON COLUMN monitored_domains.is_primary IS 'Primary domains count toward limit, competitors (false) are free';
