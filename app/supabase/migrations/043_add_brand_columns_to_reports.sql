-- Add brand differentiation columns to reports table
-- Supports both outrankllm (GEO) and hiringbrand (employer reputation) reports

-- Brand column to differentiate report types
ALTER TABLE reports ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'outrankllm';

-- Organization ID for HiringBrand reports (links to organizations table)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Monitored domain ID for HiringBrand reports (links to monitored_domains table)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS monitored_domain_id UUID REFERENCES monitored_domains(id) ON DELETE CASCADE;

-- Index for efficient querying by brand
CREATE INDEX IF NOT EXISTS idx_reports_brand ON reports(brand);

-- Index for HiringBrand organization queries
CREATE INDEX IF NOT EXISTS idx_reports_organization_id ON reports(organization_id);

-- Index for HiringBrand monitored domain queries
CREATE INDEX IF NOT EXISTS idx_reports_monitored_domain_id ON reports(monitored_domain_id);

COMMENT ON COLUMN reports.brand IS 'Brand identifier: outrankllm (GEO) or hiringbrand (employer reputation)';
COMMENT ON COLUMN reports.organization_id IS 'HiringBrand organization that owns this report';
COMMENT ON COLUMN reports.monitored_domain_id IS 'HiringBrand monitored domain this report is for';
