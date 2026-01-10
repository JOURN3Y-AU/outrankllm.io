-- Add enrichment tracking columns to scan_runs
-- Enrichment = premium features (brand awareness, action plans) that run separately
-- Migration: 021_enrichment_status.sql
-- Created: 2026-01-10

-- Add enrichment status tracking
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'not_applicable'
  CHECK (enrichment_status IN ('not_applicable', 'pending', 'processing', 'complete', 'failed'));

ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMPTZ;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS enrichment_completed_at TIMESTAMPTZ;
ALTER TABLE scan_runs ADD COLUMN IF NOT EXISTS enrichment_error TEXT;

-- Index for finding scans that need enrichment
CREATE INDEX IF NOT EXISTS idx_scan_runs_enrichment_status ON scan_runs(enrichment_status);

-- Comment explaining the statuses
COMMENT ON COLUMN scan_runs.enrichment_status IS 'Status of premium feature enrichment: not_applicable (free user), pending (waiting to start), processing (in progress), complete, failed';
