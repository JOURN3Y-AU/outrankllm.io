-- ============================================
-- ADD UNIQUE CONSTRAINT TO reports.run_id
-- ============================================
-- Prevents duplicate report records when Inngest retries the finalize-report step.
-- Before this, each retry would insert a NEW report, causing multiple reports per scan.

-- First, clean up any existing duplicates by keeping only the most recent per run_id
DELETE FROM reports r1
WHERE EXISTS (
  SELECT 1 FROM reports r2
  WHERE r2.run_id = r1.run_id
    AND r2.created_at > r1.created_at
);

-- Now add the unique constraint
ALTER TABLE reports
ADD CONSTRAINT reports_run_id_unique UNIQUE (run_id);

-- Log for verification
DO $$
BEGIN
  RAISE NOTICE 'Added UNIQUE constraint on reports.run_id';
END $$;
