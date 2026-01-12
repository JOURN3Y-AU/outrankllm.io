-- Migration: Domain subscription data isolation
-- Created: 2025-01-12
--
-- This migration adds domain_subscription_id to tables that were previously
-- only linked by lead_id. With multi-domain subscriptions, data must be
-- isolated per domain, not per lead.
--
-- Tables affected:
-- 1. score_history - trend data per domain
-- 2. subscriber_competitors - competitors tracked per domain
-- 3. action_plans - action plans per domain
-- 4. action_items_history - completed action history per domain
-- 5. prd_documents - PRD docs per domain
-- 6. prd_tasks_history - completed PRD tasks per domain

-- ============================================
-- SCORE_HISTORY
-- ============================================
ALTER TABLE score_history
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_score_history_domain_subscription ON score_history(domain_subscription_id);

-- Backfill from scan_runs
UPDATE score_history sh
SET domain_subscription_id = sr.domain_subscription_id
FROM scan_runs sr
WHERE sh.run_id = sr.id
  AND sr.domain_subscription_id IS NOT NULL
  AND sh.domain_subscription_id IS NULL;

COMMENT ON COLUMN score_history.domain_subscription_id IS 'Links score history to specific domain subscription for multi-domain isolation';

-- ============================================
-- SUBSCRIBER_COMPETITORS
-- ============================================
ALTER TABLE subscriber_competitors
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_subscriber_competitors_domain_subscription ON subscriber_competitors(domain_subscription_id);

-- Backfill from first domain subscription per lead
UPDATE subscriber_competitors sc
SET domain_subscription_id = ds.id
FROM (
  SELECT DISTINCT ON (lead_id) id, lead_id
  FROM domain_subscriptions
  ORDER BY lead_id, created_at ASC
) ds
WHERE sc.lead_id = ds.lead_id
  AND sc.domain_subscription_id IS NULL;

-- Update unique constraint to be per-domain instead of per-lead
ALTER TABLE subscriber_competitors
DROP CONSTRAINT subscriber_competitors_lead_id_name_key;

-- Add new unique constraint (only if domain_subscription_id is set)
CREATE UNIQUE INDEX idx_subscriber_competitors_domain_name
ON subscriber_competitors(domain_subscription_id, name)
WHERE domain_subscription_id IS NOT NULL;

-- Keep old constraint for legacy data without domain_subscription_id
CREATE UNIQUE INDEX idx_subscriber_competitors_lead_name_legacy
ON subscriber_competitors(lead_id, name)
WHERE domain_subscription_id IS NULL;

COMMENT ON COLUMN subscriber_competitors.domain_subscription_id IS 'Links competitors to specific domain subscription for multi-domain isolation';

-- ============================================
-- ACTION_PLANS
-- ============================================
ALTER TABLE action_plans
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_action_plans_domain_subscription ON action_plans(domain_subscription_id);

-- Backfill from scan_runs
UPDATE action_plans ap
SET domain_subscription_id = sr.domain_subscription_id
FROM scan_runs sr
WHERE ap.run_id = sr.id
  AND sr.domain_subscription_id IS NOT NULL
  AND ap.domain_subscription_id IS NULL;

COMMENT ON COLUMN action_plans.domain_subscription_id IS 'Links action plans to specific domain subscription for multi-domain isolation';

-- ============================================
-- ACTION_ITEMS_HISTORY
-- ============================================
ALTER TABLE action_items_history
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_action_items_history_domain_subscription ON action_items_history(domain_subscription_id);

-- Backfill from first domain subscription per lead
UPDATE action_items_history aih
SET domain_subscription_id = ds.id
FROM (
  SELECT DISTINCT ON (lead_id) id, lead_id
  FROM domain_subscriptions
  ORDER BY lead_id, created_at ASC
) ds
WHERE aih.lead_id = ds.lead_id
  AND aih.domain_subscription_id IS NULL;

COMMENT ON COLUMN action_items_history.domain_subscription_id IS 'Links action history to specific domain subscription for multi-domain isolation';

-- ============================================
-- PRD_DOCUMENTS
-- ============================================
ALTER TABLE prd_documents
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_prd_documents_domain_subscription ON prd_documents(domain_subscription_id);

-- Backfill from scan_runs
UPDATE prd_documents pd
SET domain_subscription_id = sr.domain_subscription_id
FROM scan_runs sr
WHERE pd.run_id = sr.id
  AND sr.domain_subscription_id IS NOT NULL
  AND pd.domain_subscription_id IS NULL;

COMMENT ON COLUMN prd_documents.domain_subscription_id IS 'Links PRD documents to specific domain subscription for multi-domain isolation';

-- ============================================
-- PRD_TASKS_HISTORY
-- ============================================
ALTER TABLE prd_tasks_history
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

CREATE INDEX idx_prd_tasks_history_domain_subscription ON prd_tasks_history(domain_subscription_id);

-- Backfill from first domain subscription per lead
UPDATE prd_tasks_history pth
SET domain_subscription_id = ds.id
FROM (
  SELECT DISTINCT ON (lead_id) id, lead_id
  FROM domain_subscriptions
  ORDER BY lead_id, created_at ASC
) ds
WHERE pth.lead_id = ds.lead_id
  AND pth.domain_subscription_id IS NULL;

COMMENT ON COLUMN prd_tasks_history.domain_subscription_id IS 'Links PRD task history to specific domain subscription for multi-domain isolation';

-- ============================================
-- UPDATE record_score_snapshot FUNCTION
-- Add domain_subscription_id parameter
-- ============================================
CREATE OR REPLACE FUNCTION record_score_snapshot(
  p_lead_id UUID,
  p_run_id UUID,
  p_visibility_score DECIMAL,
  p_chatgpt_score DECIMAL DEFAULT NULL,
  p_claude_score DECIMAL DEFAULT NULL,
  p_gemini_score DECIMAL DEFAULT NULL,
  p_perplexity_score DECIMAL DEFAULT NULL,
  p_query_coverage DECIMAL DEFAULT NULL,
  p_total_queries INTEGER DEFAULT NULL,
  p_total_mentions INTEGER DEFAULT NULL,
  p_readiness_score DECIMAL DEFAULT NULL,
  p_domain_subscription_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_domain_subscription_id UUID;
BEGIN
  -- If domain_subscription_id not provided, try to get it from scan_runs
  v_domain_subscription_id := p_domain_subscription_id;
  IF v_domain_subscription_id IS NULL THEN
    SELECT domain_subscription_id INTO v_domain_subscription_id
    FROM scan_runs WHERE id = p_run_id;
  END IF;

  INSERT INTO score_history (
    lead_id,
    run_id,
    domain_subscription_id,
    visibility_score,
    chatgpt_score,
    claude_score,
    gemini_score,
    perplexity_score,
    query_coverage,
    total_queries,
    total_mentions,
    readiness_score,
    recorded_at
  ) VALUES (
    p_lead_id,
    p_run_id,
    v_domain_subscription_id,
    p_visibility_score,
    p_chatgpt_score,
    p_claude_score,
    p_gemini_score,
    p_perplexity_score,
    p_query_coverage,
    p_total_queries,
    p_total_mentions,
    p_readiness_score,
    NOW()
  )
  ON CONFLICT (run_id) DO UPDATE SET
    domain_subscription_id = COALESCE(EXCLUDED.domain_subscription_id, score_history.domain_subscription_id),
    visibility_score = EXCLUDED.visibility_score,
    chatgpt_score = EXCLUDED.chatgpt_score,
    claude_score = EXCLUDED.claude_score,
    gemini_score = EXCLUDED.gemini_score,
    perplexity_score = EXCLUDED.perplexity_score,
    query_coverage = EXCLUDED.query_coverage,
    total_queries = EXCLUDED.total_queries,
    total_mentions = EXCLUDED.total_mentions,
    readiness_score = EXCLUDED.readiness_score,
    recorded_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- DATA REPAIR QUERIES
-- Run these manually if needed to fix orphaned data
-- ============================================

-- Repair: Link any orphaned scan_runs to domain_subscriptions by matching domain
-- (For scans that were created before proper linking was implemented)
/*
UPDATE scan_runs sr
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
JOIN leads l ON ds.lead_id = l.id AND ds.domain = l.domain
WHERE sr.lead_id = l.id
  AND sr.domain_subscription_id IS NULL
  AND ds.status = 'active';
*/

-- Repair: Fix subscriber_questions that don't have domain_subscription_id
/*
UPDATE subscriber_questions sq
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
WHERE sq.lead_id = ds.lead_id
  AND sq.domain_subscription_id IS NULL
  AND ds.status = 'active';
*/

-- Repair: Copy questions from lead's first domain to new domains
-- (For users who added a second domain but have no questions for it)
/*
INSERT INTO subscriber_questions (
  lead_id,
  domain_subscription_id,
  prompt_text,
  category,
  source,
  is_active,
  sort_order
)
SELECT
  ds_new.lead_id,
  ds_new.id as domain_subscription_id,
  sq.prompt_text,
  sq.category,
  'ai_generated' as source,
  sq.is_active,
  sq.sort_order
FROM domain_subscriptions ds_new
JOIN (
  SELECT DISTINCT ON (lead_id) id, lead_id
  FROM domain_subscriptions
  ORDER BY lead_id, created_at ASC
) ds_first ON ds_first.lead_id = ds_new.lead_id AND ds_first.id != ds_new.id
JOIN subscriber_questions sq ON sq.domain_subscription_id = ds_first.id
WHERE NOT EXISTS (
  SELECT 1 FROM subscriber_questions
  WHERE domain_subscription_id = ds_new.id
);
*/

-- Repair: Ensure all active domain_subscriptions have questions
-- by generating them from the latest scan prompts
/*
INSERT INTO subscriber_questions (
  lead_id,
  domain_subscription_id,
  prompt_text,
  category,
  source,
  is_active,
  sort_order
)
SELECT
  ds.lead_id,
  ds.id as domain_subscription_id,
  sp.prompt_text,
  sp.category,
  'ai_generated' as source,
  true as is_active,
  ROW_NUMBER() OVER (PARTITION BY ds.id ORDER BY sp.created_at) as sort_order
FROM domain_subscriptions ds
JOIN scan_runs sr ON sr.domain_subscription_id = ds.id
JOIN scan_prompts sp ON sp.run_id = sr.id
WHERE ds.status = 'active'
  AND sr.status = 'complete'
  AND NOT EXISTS (
    SELECT 1 FROM subscriber_questions
    WHERE domain_subscription_id = ds.id
  )
  AND sr.id = (
    SELECT id FROM scan_runs
    WHERE domain_subscription_id = ds.id
    ORDER BY created_at DESC
    LIMIT 1
  );
*/

-- View: Check data isolation status across tables
/*
SELECT
  ds.domain,
  ds.status as sub_status,
  (SELECT COUNT(*) FROM scan_runs WHERE domain_subscription_id = ds.id) as scan_count,
  (SELECT COUNT(*) FROM subscriber_questions WHERE domain_subscription_id = ds.id) as question_count,
  (SELECT COUNT(*) FROM subscriber_competitors WHERE domain_subscription_id = ds.id) as competitor_count,
  (SELECT COUNT(*) FROM score_history WHERE domain_subscription_id = ds.id) as score_count,
  (SELECT COUNT(*) FROM action_plans WHERE domain_subscription_id = ds.id) as action_plan_count,
  (SELECT COUNT(*) FROM prd_documents WHERE domain_subscription_id = ds.id) as prd_count
FROM domain_subscriptions ds
ORDER BY ds.lead_id, ds.created_at;
*/
