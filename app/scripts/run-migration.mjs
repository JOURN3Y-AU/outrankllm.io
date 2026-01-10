#!/usr/bin/env node

/**
 * Run SQL migration using the Supabase service role
 * This uses the pg library directly with the Supabase database URL
 */

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runMigration() {
  console.log('Checking if columns exist...')

  // Try to select the columns - if they don't exist, we need to add them
  const { data, error } = await supabase
    .from('leads')
    .select('scan_schedule_day, scan_schedule_hour, scan_timezone')
    .limit(1)

  if (error && error.message.includes('does not exist')) {
    console.log('Columns do not exist. You need to run the migration manually.')
    console.log('\nGo to: https://supabase.com/dashboard/project/ubfskwsjqdyeunttsqvt/sql')
    console.log('\nPaste and run this SQL:\n')
    console.log(`
-- Add scan schedule columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_schedule_day INTEGER DEFAULT 1;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_schedule_hour INTEGER DEFAULT 9;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_timezone TEXT DEFAULT 'Australia/Sydney';

-- Add check constraints (skip if they already exist)
DO $$
BEGIN
  BEGIN
    ALTER TABLE leads ADD CONSTRAINT leads_scan_schedule_day_check
      CHECK (scan_schedule_day >= 0 AND scan_schedule_day <= 6);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER TABLE leads ADD CONSTRAINT leads_scan_schedule_hour_check
      CHECK (scan_schedule_hour >= 0 AND scan_schedule_hour <= 23);
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END
$$;

-- Create index for efficient schedule queries
CREATE INDEX IF NOT EXISTS idx_leads_scan_schedule
  ON leads(tier, scan_schedule_day, scan_schedule_hour, scan_timezone)
  WHERE tier IN ('starter', 'pro', 'agency');

-- Add column comments
COMMENT ON COLUMN leads.scan_schedule_day IS 'Day of week for weekly scan: 0=Sun, 1=Mon, ..., 6=Sat';
COMMENT ON COLUMN leads.scan_schedule_hour IS 'Hour of day (0-23) in local time for weekly scan';
COMMENT ON COLUMN leads.scan_timezone IS 'IANA timezone string for interpreting schedule';
`)
  } else if (error) {
    console.error('Unexpected error:', error.message)
    process.exit(1)
  } else {
    console.log('Columns already exist!')
    console.log('Sample data:', data)
  }
}

runMigration().catch(console.error)
