-- Add brand differentiation columns to scan_runs
-- Supports both outrankllm (GEO) and hiringbrand (employer reputation) scans

-- Brand column to differentiate scan types
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS brand TEXT DEFAULT 'outrankllm';

-- Organization ID for HiringBrand scans (links to organizations table)
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Monitored domain ID for HiringBrand scans (links to monitored_domains table)
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS monitored_domain_id UUID REFERENCES monitored_domains(id) ON DELETE CASCADE;

-- Index for efficient querying by brand
CREATE INDEX IF NOT EXISTS idx_scan_runs_brand ON scan_runs(brand);

-- Index for HiringBrand organization queries
CREATE INDEX IF NOT EXISTS idx_scan_runs_organization_id ON scan_runs(organization_id);

-- Index for HiringBrand monitored domain queries
CREATE INDEX IF NOT EXISTS idx_scan_runs_monitored_domain_id ON scan_runs(monitored_domain_id);

COMMENT ON COLUMN scan_runs.brand IS 'Brand identifier: outrankllm (GEO) or hiringbrand (employer reputation)';
COMMENT ON COLUMN scan_runs.organization_id IS 'HiringBrand organization that owns this scan';
COMMENT ON COLUMN scan_runs.monitored_domain_id IS 'HiringBrand monitored domain being scanned';
