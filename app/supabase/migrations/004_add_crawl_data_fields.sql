-- Migration: Add crawl data fields for AI Readiness checks
-- Created: 2025-01-06

-- Add crawl metadata fields to site_analyses
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS has_sitemap BOOLEAN DEFAULT false;
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS has_robots_txt BOOLEAN DEFAULT false;
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS schema_types TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS extracted_locations TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS extracted_services TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS extracted_products TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS locations TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS products TEXT[] DEFAULT '{}';
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS has_meta_descriptions BOOLEAN DEFAULT false;

-- Index for schema types (useful for filtering reports by schema support)
CREATE INDEX IF NOT EXISTS idx_site_analyses_schema_types ON site_analyses USING GIN (schema_types);
