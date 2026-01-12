-- ============================================================================
-- Migration: Fix scan domain tracking for multi-domain support
-- Created: 2025-01-12
-- ============================================================================
--
-- PROBLEM SUMMARY:
-- When a subscriber adds a second domain (e.g., j4rvis.com after mantel.com.au),
-- the system breaks because:
--   1. scan_runs has no domain column - relies on leads.domain (single value)
--   2. Webhook incorrectly links ALL scans to new domain_subscription
--   3. Enrichment uses leads.domain instead of the actual domain being scanned
--
-- This migration adds domain tracking to scan_runs and repairs existing data.
-- ============================================================================

-- ============================================
-- STEP 1: ADD DOMAIN COLUMN TO SCAN_RUNS
-- ============================================
ALTER TABLE scan_runs
ADD COLUMN domain TEXT;

CREATE INDEX idx_scan_runs_domain ON scan_runs(domain);

COMMENT ON COLUMN scan_runs.domain IS 'The domain being scanned. Critical for multi-domain isolation.';

-- ============================================
-- STEP 2: BACKFILL DOMAIN FROM EXISTING DATA
-- ============================================

-- For scans linked to a domain_subscription, use that subscription's domain
UPDATE scan_runs sr
SET domain = ds.domain
FROM domain_subscriptions ds
WHERE sr.domain_subscription_id = ds.id
  AND sr.domain IS NULL;

-- For unlinked scans, use the lead's domain (legacy single-domain case)
UPDATE scan_runs sr
SET domain = l.domain
FROM leads l
WHERE sr.lead_id = l.id
  AND sr.domain IS NULL;

-- ============================================
-- STEP 3: CREATE COMPOSITE INDEX FOR LOOKUPS
-- ============================================
CREATE INDEX idx_scan_runs_lead_domain ON scan_runs(lead_id, domain);

-- ============================================
-- STEP 4: DATA REPAIR - Fix incorrectly linked scans
-- Scans should only be linked to domain_subscriptions for MATCHING domains
-- ============================================

-- Unlink scans that are linked to wrong domain_subscription
-- (scan's domain doesn't match subscription's domain)
UPDATE scan_runs sr
SET domain_subscription_id = NULL
FROM domain_subscriptions ds
WHERE sr.domain_subscription_id = ds.id
  AND sr.domain IS NOT NULL
  AND ds.domain != sr.domain;

-- Re-link scans to correct domain_subscription based on matching domain
UPDATE scan_runs sr
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
WHERE sr.lead_id = ds.lead_id
  AND sr.domain = ds.domain
  AND sr.domain_subscription_id IS NULL
  AND ds.status IN ('active', 'past_due', 'trialing');

-- ============================================
-- DIAGNOSTIC QUERIES (run manually to verify)
-- ============================================

/*
-- Check for domain mismatches
SELECT
  sr.id as scan_id,
  sr.domain as scan_domain,
  sr.domain_subscription_id,
  ds.domain as subscription_domain,
  CASE WHEN sr.domain = ds.domain THEN 'OK' ELSE 'MISMATCH' END as status
FROM scan_runs sr
LEFT JOIN domain_subscriptions ds ON sr.domain_subscription_id = ds.id
WHERE sr.domain_subscription_id IS NOT NULL
ORDER BY sr.created_at DESC;

-- Check isolation status per domain
SELECT
  ds.domain,
  ds.status as sub_status,
  (SELECT COUNT(*) FROM scan_runs WHERE domain_subscription_id = ds.id) as scan_count,
  (SELECT COUNT(*) FROM subscriber_questions WHERE domain_subscription_id = ds.id) as question_count,
  (SELECT COUNT(*) FROM action_plans WHERE domain_subscription_id = ds.id) as action_plan_count,
  (SELECT COUNT(*) FROM prd_documents WHERE domain_subscription_id = ds.id) as prd_count
FROM domain_subscriptions ds
ORDER BY ds.lead_id, ds.created_at;
*/
