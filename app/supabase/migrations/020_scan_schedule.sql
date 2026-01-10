-- Add scan schedule columns to leads table
-- Allows subscribers to configure when their weekly scans run

-- Day of week: 0=Sunday, 1=Monday, ..., 6=Saturday
-- Default: Monday (1)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_schedule_day INTEGER DEFAULT 1
  CHECK (scan_schedule_day >= 0 AND scan_schedule_day <= 6);

-- Hour of day in local time: 0-23
-- Default: 9am
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_schedule_hour INTEGER DEFAULT 9
  CHECK (scan_schedule_hour >= 0 AND scan_schedule_hour <= 23);

-- IANA timezone string (e.g., 'Australia/Sydney', 'America/New_York')
-- Default: Australia/Sydney (detected from browser on first visit)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS scan_timezone TEXT DEFAULT 'Australia/Sydney';

-- Index for efficient querying by schedule
-- Only index subscribers (starter, pro, agency tiers)
CREATE INDEX IF NOT EXISTS idx_leads_scan_schedule
  ON leads(tier, scan_schedule_day, scan_schedule_hour, scan_timezone)
  WHERE tier IN ('starter', 'pro', 'agency');

-- Add comment explaining the columns
COMMENT ON COLUMN leads.scan_schedule_day IS 'Day of week for weekly scan: 0=Sun, 1=Mon, ..., 6=Sat';
COMMENT ON COLUMN leads.scan_schedule_hour IS 'Hour of day (0-23) in local time for weekly scan';
COMMENT ON COLUMN leads.scan_timezone IS 'IANA timezone string for interpreting schedule';
