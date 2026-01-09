-- Delete ALL data for a test user by email (handles multiple leads per email)
-- Case-insensitive email matching
-- Run this in Supabase SQL Editor

-- Set the email to delete (will match regardless of case)
DO $$
DECLARE
  target_email TEXT := 'kevin.morrell@journey.com.au';  -- Change this email
  lead_count INT;
BEGIN
  -- Count leads for this email (case-insensitive)
  SELECT COUNT(*) INTO lead_count FROM leads WHERE LOWER(email) = LOWER(target_email);

  IF lead_count = 0 THEN
    RAISE NOTICE 'No leads found with email: %', target_email;
    RETURN;
  END IF;

  RAISE NOTICE 'Found % lead(s) for email: %', lead_count, target_email;

  -- Delete password reset tokens for all leads with this email
  DELETE FROM password_reset_tokens WHERE lead_id IN (
    SELECT id FROM leads WHERE LOWER(email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted password reset tokens';

  -- Delete subscriptions for all leads with this email
  DELETE FROM subscriptions WHERE lead_id IN (
    SELECT id FROM leads WHERE LOWER(email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted subscriptions';

  -- Delete brand awareness results (via scan_runs)
  DELETE FROM brand_awareness_results WHERE run_id IN (
    SELECT sr.id FROM scan_runs sr
    JOIN leads l ON sr.lead_id = l.id
    WHERE LOWER(l.email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted brand awareness results';

  -- Delete reports (via scan_runs)
  DELETE FROM reports WHERE run_id IN (
    SELECT sr.id FROM scan_runs sr
    JOIN leads l ON sr.lead_id = l.id
    WHERE LOWER(l.email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted reports';

  -- Delete LLM responses (via scan_runs)
  DELETE FROM llm_responses WHERE run_id IN (
    SELECT sr.id FROM scan_runs sr
    JOIN leads l ON sr.lead_id = l.id
    WHERE LOWER(l.email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted LLM responses';

  -- Delete site analyses (via scan_runs)
  DELETE FROM site_analyses WHERE run_id IN (
    SELECT sr.id FROM scan_runs sr
    JOIN leads l ON sr.lead_id = l.id
    WHERE LOWER(l.email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted site analyses';

  -- Delete scan prompts (via scan_runs)
  DELETE FROM scan_prompts WHERE run_id IN (
    SELECT sr.id FROM scan_runs sr
    JOIN leads l ON sr.lead_id = l.id
    WHERE LOWER(l.email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted scan prompts';

  -- Delete email verification tokens
  DELETE FROM email_verification_tokens WHERE lead_id IN (
    SELECT id FROM leads WHERE LOWER(email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted email verification tokens';

  -- Delete scan runs for all leads with this email
  DELETE FROM scan_runs WHERE lead_id IN (
    SELECT id FROM leads WHERE LOWER(email) = LOWER(target_email)
  );
  RAISE NOTICE 'Deleted scan runs';

  -- Delete all leads with this email (case-insensitive)
  DELETE FROM leads WHERE LOWER(email) = LOWER(target_email);
  RAISE NOTICE 'Deleted % lead(s)', lead_count;

  RAISE NOTICE 'Cleanup complete for: %', target_email;
END $$;
