-- Migration: Add industry field to site_analyses
-- Created: 2025-01-06

-- Add industry column for better business categorization
ALTER TABLE site_analyses ADD COLUMN IF NOT EXISTS industry TEXT;
