# Inngest Integration Plan

**Status:** Ready for Implementation
**Estimated Time:** 3-4 hours (includes user-configurable schedule)
**Last Updated:** 2026-01-10

---

## Overview

Replace the current fire-and-forget `fetch()` pattern with Inngest for reliable background job processing. This solves:

1. **Unreliable admin rescans** - fire-and-forget fails on Vercel serverless
2. **No retry mechanism** - failed scans are lost
3. **No weekly CRON scans** - required for subscriber value
4. **No visibility** - can't see stuck/failed jobs

---

## Architecture Decision

### Sequential vs Parallel LLM Queries

**Current implementation**: 4 platforms queried in parallel via `Promise.all`
**Inngest free tier limit**: 5 concurrent steps

**Decision: Run LLM queries sequentially on free tier**

| Approach | Time per Scan | Concurrent Scans | Free Tier Compatible |
|----------|---------------|------------------|---------------------|
| Parallel (current) | ~1 min for LLM phase | 1 at a time | ❌ Uses 4 steps |
| Sequential | ~4 min for LLM phase | 4+ at a time | ✅ Uses 1 step |

**Trade-off accepted**: Scans take ~3 minutes longer, but multiple users' scans can run simultaneously. Total scan time ~10-12 minutes (acceptable for background processing).

**Future upgrade path**: When subscriber count justifies $75/mo Pro tier, switch to parallel execution.

---

## Implementation Steps

### Phase 1: Setup (~15 min)

#### 1.1 Install Inngest SDK

```bash
cd app
npm install inngest
```

#### 1.2 Create Inngest Client

Create `src/inngest/client.ts`:

```typescript
import { Inngest } from "inngest"

export const inngest = new Inngest({
  id: "outrankllm",
  // Retry configuration for all functions
  retries: 3,
})
```

#### 1.3 Create API Route Handler

Create `src/app/api/inngest/route.ts`:

```typescript
import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { processScan } from "@/inngest/functions/process-scan"
import { weeklyScans } from "@/inngest/functions/weekly-scans"

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processScan, weeklyScans],
})
```

#### 1.4 Environment Variables

Add to Vercel:
- `INNGEST_SIGNING_KEY` (from Inngest dashboard)
- `INNGEST_EVENT_KEY` (from Inngest dashboard)

---

### Phase 2: Process Scan Function (~45 min)

#### 2.1 Create the Inngest Function

Create `src/inngest/functions/process-scan.ts`:

**Event Schema:**
```typescript
type ScanProcessEvent = {
  name: "scan/process"
  data: {
    scanId: string
    domain: string
    email: string
    leadId: string
    verificationToken?: string
    skipEmail?: boolean
  }
}
```

**Function Structure (7 steps):**

```
Step 1: crawl-site
├── crawlSite(domain)
├── detectGeography()
├── Save site_analyses to DB
└── Update progress: 10%

Step 2: analyze-content
├── analyzeWebsite(combinedContent)
├── Update progress: 25%

Step 3: research-queries
├── Check subscriber_questions (for subscribers)
├── OR researchQueries() for free users
├── Save scan_prompts to DB
└── Update progress: 35%

Step 4: query-chatgpt
├── Query ChatGPT for all 7 prompts
├── Save llm_responses to DB
└── Update progress: 50%

Step 5: query-claude
├── Query Claude for all 7 prompts
├── Save llm_responses to DB
└── Update progress: 62%

Step 6: query-gemini
├── Query Gemini for all 7 prompts
├── Save llm_responses to DB
└── Update progress: 75%

Step 7: query-perplexity
├── Query Perplexity for all 7 prompts
├── Save llm_responses to DB
└── Update progress: 87%

Step 8: finalize-report
├── calculateSearchVisibilityScore()
├── extractTopCompetitors()
├── Save report to DB
├── Record score_history (for subscribers)
├── Send email (verification or completion)
└── Update progress: 100%
```

#### 2.2 Key Implementation Details

**Per-step retries**: Each step retries independently. If ChatGPT fails, only ChatGPT retries - Claude results are preserved.

**Progress updates**: Must update `scan_runs` table in each step so polling continues to work.

**Error handling**: Failed steps surface in Inngest dashboard. Final step marks scan as `failed` if any platform queries failed completely.

---

### Phase 3: Update Trigger Points (~30 min)

#### 3.1 Update `/api/scan/route.ts`

Replace fire-and-forget fetch with Inngest event:

```typescript
// OLD (remove this)
fetch(`${appUrl}/api/process`, { ... })

// NEW
import { inngest } from "@/inngest/client"

await inngest.send({
  name: "scan/process",
  data: {
    scanId: scanRun.id,
    domain: cleanDomain,
    email: normalizedEmail,
    verificationToken,
    leadId: lead.id,
  },
})
```

#### 3.2 Update `/api/admin/rescan/route.ts`

Same pattern - replace fetch with `inngest.send()`.

#### 3.3 Keep `/api/process/route.ts` (Temporarily)

Keep the existing endpoint for:
- Local development without Inngest dev server
- Fallback if Inngest has issues
- Reference for step logic extraction

Mark with comment: `// DEPRECATED: Use Inngest functions instead`

---

### Phase 4: Weekly CRON Scans (~45 min)

#### 4.1 User-Configurable Schedule

Subscribers can choose when their weekly scan runs via their dashboard.

**Database Schema:**

Add columns to `leads` table (new migration `020_scan_schedule.sql`):

```sql
ALTER TABLE leads ADD COLUMN scan_schedule_day INTEGER DEFAULT 1;  -- 0=Sun, 1=Mon, ..., 6=Sat
ALTER TABLE leads ADD COLUMN scan_schedule_hour INTEGER DEFAULT 9; -- 0-23 (local time)
ALTER TABLE leads ADD COLUMN scan_timezone TEXT DEFAULT 'Australia/Sydney';

-- Index for efficient querying by schedule
CREATE INDEX idx_leads_scan_schedule ON leads(tier, scan_schedule_day, scan_schedule_hour, scan_timezone)
  WHERE tier IN ('starter', 'pro', 'agency');
```

**Default:** Monday 9am in user's timezone (detected on signup, editable in dashboard)

#### 4.2 Dashboard Schedule Settings

Add to `/dashboard` page:

```
┌─────────────────────────────────────────────────────────────┐
│  WEEKLY SCAN SCHEDULE                                       │
│                                                             │
│  Your report refreshes automatically every week.            │
│                                                             │
│  Day:  [Monday ▼]     Time: [9:00 AM ▼]                    │
│                                                             │
│  Timezone: [Australia/Sydney ▼]                             │
│                                                             │
│  Next scan: Monday, Jan 13 at 9:00 AM AEDT                 │
│                                                             │
│                                        [Save Changes]       │
└─────────────────────────────────────────────────────────────┘
```

**API Endpoint:** `PATCH /api/user/schedule`

```typescript
// Request body
{
  scan_schedule_day: 1,    // Monday
  scan_schedule_hour: 9,   // 9am
  scan_timezone: "Australia/Sydney"
}
```

**Timezone Detection:**
- Auto-detect from browser on first visit: `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Store in `leads.scan_timezone` when lead is created
- User can override in dashboard

#### 4.3 Hourly CRON Dispatcher

Instead of one Monday 6am UTC cron, run an **hourly dispatcher** that checks who needs scanning NOW.

Create `src/inngest/functions/hourly-scan-dispatcher.ts`:

**Trigger:** Cron schedule `0 * * * *` (every hour on the hour)

```typescript
export const hourlyScanDispatcher = inngest.createFunction(
  { id: "hourly-scan-dispatcher" },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    const now = new Date()
    const currentUtcHour = now.getUTCHours()
    const currentUtcDay = now.getUTCDay() // 0=Sun, 1=Mon, etc.

    // Find all subscribers whose local time matches their schedule
    const subscribersToScan = await step.run("find-due-subscribers", async () => {
      const supabase = createServiceClient()

      // Query subscribers and filter by timezone-adjusted schedule
      const { data: subscribers } = await supabase
        .from("leads")
        .select("id, email, domain, scan_schedule_day, scan_schedule_hour, scan_timezone")
        .in("tier", ["starter", "pro", "agency"])

      if (!subscribers) return []

      // Filter to those whose local time matches their schedule
      return subscribers.filter(sub => {
        const localTime = getLocalTime(now, sub.scan_timezone)
        return (
          localTime.day === sub.scan_schedule_day &&
          localTime.hour === sub.scan_schedule_hour
        )
      })
    })

    if (subscribersToScan.length === 0) {
      return { queued: 0, message: "No scans due this hour" }
    }

    // Queue scans for matching subscribers
    await step.run("queue-scans", async () => {
      await inngest.send(
        subscribersToScan.map(sub => ({
          name: "scan/process",
          data: {
            scanId: null,
            domain: sub.domain,
            email: sub.email,
            leadId: sub.id,
            skipEmail: false,
          },
        }))
      )
    })

    return {
      queued: subscribersToScan.length,
      subscribers: subscribersToScan.map(s => s.email)
    }
  }
)

// Helper to get local day/hour from UTC time and timezone
function getLocalTime(utcDate: Date, timezone: string): { day: number; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })

  const parts = formatter.formatToParts(utcDate)
  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

  const dayPart = parts.find(p => p.type === 'weekday')?.value || 'Mon'
  const hourPart = parts.find(p => p.type === 'hour')?.value || '9'

  return {
    day: dayMap[dayPart] ?? 1,
    hour: parseInt(hourPart, 10),
  }
}
```

**Why hourly instead of single Monday cron:**
- Supports users in different timezones
- Users can choose any day/time, not just Monday
- More even load distribution (not all scans at once)

#### 4.4 Update Process Scan to Handle Missing scanId

For weekly scans, the `scanId` won't exist yet. Update step 1 to create it:

```typescript
// In process-scan function, step 1:
const scanId = await step.run("setup-scan", async () => {
  if (event.data.scanId) {
    return event.data.scanId // Use existing (from /api/scan)
  }

  // Create new scan run (for weekly crons)
  const { data } = await supabase
    .from("scan_runs")
    .insert({ lead_id: event.data.leadId, status: "pending", progress: 0 })
    .select("id")
    .single()

  return data.id
})
```

#### 4.5 Files for Schedule Feature

| File | Purpose |
|------|---------|
| `supabase/migrations/020_scan_schedule.sql` | Add schedule columns to leads |
| `src/app/api/user/schedule/route.ts` | PATCH endpoint for updating schedule |
| `src/app/dashboard/ScheduleSettings.tsx` | Schedule picker component |
| `src/inngest/functions/hourly-scan-dispatcher.ts` | Hourly cron that dispatches due scans |
| `src/lib/timezone.ts` | Timezone helpers (detection, conversion) |

---

### Phase 5: Cleanup & Deprecation (~15 min)

#### 5.1 Remove from vercel.json

Current `vercel.json` sets 300s max duration for `/api/process`. This can be removed since Inngest handles timeouts.

#### 5.2 Add Inngest Dev Server Script

Update `package.json`:

```json
{
  "scripts": {
    "dev": "next dev --turbopack",
    "dev:inngest": "inngest-cli dev",
    "dev:all": "concurrently \"npm run dev\" \"npm run dev:inngest\""
  }
}
```

Optional: Install `concurrently` for parallel dev servers.

#### 5.3 Update Documentation

Update `CLAUDE.md` and `SUBSCRIPTION_PLAN.md` to reflect:
- Inngest handles all scan processing
- Weekly CRON now implemented
- `/api/process` deprecated

---

## File Changes Summary

### New Files

| File | Purpose |
|------|---------|
| `src/inngest/client.ts` | Inngest client singleton |
| `src/inngest/functions/process-scan.ts` | Main scan processing function |
| `src/inngest/functions/hourly-scan-dispatcher.ts` | Hourly cron for scheduled scans |
| `src/app/api/inngest/route.ts` | Inngest webhook handler |
| `src/app/api/user/schedule/route.ts` | PATCH endpoint for schedule settings |
| `src/app/dashboard/ScheduleSettings.tsx` | Schedule picker UI component |
| `src/lib/timezone.ts` | Timezone detection and conversion helpers |
| `supabase/migrations/020_scan_schedule.sql` | Add schedule columns to leads |

### Modified Files

| File | Changes |
|------|---------|
| `src/app/api/scan/route.ts` | Replace fetch with inngest.send(), detect timezone |
| `src/app/api/admin/rescan/route.ts` | Replace fetch with inngest.send() |
| `src/app/api/process/route.ts` | Add deprecation comment |
| `src/app/dashboard/page.tsx` | Add ScheduleSettings component |
| `package.json` | Add inngest dependency + scripts |
| `vercel.json` | Remove maxDuration override |

### Environment Variables (Vercel)

| Variable | Source |
|----------|--------|
| `INNGEST_SIGNING_KEY` | Inngest dashboard → Signing Keys |
| `INNGEST_EVENT_KEY` | Inngest dashboard → Event Keys |

---

## Testing Plan

### Local Development

1. Start Next.js: `npm run dev`
2. Start Inngest dev server: `npx inngest-cli dev`
3. Open Inngest dashboard: http://localhost:8288
4. Trigger scan via homepage form
5. Watch function execution in Inngest dashboard

### Production Testing

1. Deploy to Vercel (will auto-register with Inngest cloud)
2. Trigger admin rescan via API
3. Verify scan completes in Inngest dashboard
4. Check scan results in report

### Failure Testing

1. Kill dev server mid-scan
2. Restart dev server
3. Verify scan resumes from last completed step

---

## Rollback Plan

If Inngest integration causes issues:

1. Revert `src/app/api/scan/route.ts` to use fetch()
2. Revert `src/app/api/admin/rescan/route.ts` to use fetch()
3. `/api/process` still works as before
4. Remove Inngest env vars from Vercel

The `/api/process` endpoint remains functional throughout migration.

---

## Concurrency Considerations

### Free Tier (5 concurrent steps)

With sequential LLM queries, each scan uses 1 step at a time:

| Active Scans | Steps in Use | Queue Behavior |
|--------------|--------------|----------------|
| 1 | 1 | No queuing |
| 5 | 5 | At limit |
| 10 | 5 active, 5 queued | FIFO queue |

**Estimated capacity**: ~30 scans/hour on free tier (assuming 12 min per scan)

### Weekly CRON Load

If you have 100 subscribers:
- 100 `scan/process` events sent
- 5 run concurrently, 95 queued
- All complete within ~4 hours

This is acceptable since weekly scans run overnight (6am UTC = early morning in Australia).

---

## Future Enhancements

### When to Upgrade to Pro ($75/mo)

Upgrade when:
- >500 active subscribers (weekly queue exceeds 8 hours)
- Users complain about scan duration
- Need real-time monitoring features

### Pro Tier Benefits

- 100+ concurrent steps → parallel LLM queries
- Scan time drops from ~12 min to ~5 min
- Weekly 100 subscribers completes in ~1 hour

### Potential Improvements

1. **User-configurable schedule**: Store preferred day/time in `leads` table
2. **Priority queue**: Process Pro/Agency scans before Starter
3. **Retry notifications**: Email user if scan fails after all retries

---

## Monitoring & Observability

### Option A: Use Existing Dashboards (Recommended to Start)

**Pros**: No development time, already built, maintained by vendors
**Cons**: Requires switching between tools

| Tool | What It Shows | Access |
|------|---------------|--------|
| **Inngest Dashboard** | Function runs, step status, retries, failures, queued jobs | https://app.inngest.com |
| **Vercel Logs** | HTTP requests, function execution logs, errors | https://vercel.com/dashboard |
| **Supabase Dashboard** | Database queries, row counts, table activity | https://supabase.com/dashboard |

**Workflow for debugging a stuck scan:**
1. Check Inngest dashboard → Is the function running? Which step failed?
2. Click into failed step → See error message and stack trace
3. Check Vercel logs → Any API errors?
4. Check Supabase → Is the scan_run record updated?

**Inngest Dashboard Features:**
- Real-time function execution view
- Step-by-step progress visualization
- Retry history with error messages
- Manual replay of failed functions
- Bulk cancellation tools
- 7-day trace retention (free tier)

### Option B: Custom Admin Dashboard (Future Enhancement)

If you find yourself checking multiple dashboards frequently, build a simple admin page.

**Estimated time**: 2-3 hours
**Trigger**: When you're checking dashboards >3x per week

#### Proposed Admin Page: `/admin/scans`

**Access Control:**
```typescript
// Simple: Check for admin emails
const ADMIN_EMAILS = ['kevin.morrell@journ3y.com.au']
const session = await getSession()
if (!ADMIN_EMAILS.includes(session?.email)) {
  return redirect('/404')
}
```

**Dashboard Components:**

```
┌─────────────────────────────────────────────────────────────────┐
│  SCAN PROCESSING MONITOR                      [Refresh] [Export]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TODAY'S STATS                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │    12    │ │     2    │ │     1    │ │     0    │          │
│  │ Complete │ │ Running  │ │  Queued  │ │  Failed  │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                 │
│  RECENT SCANS                                     Filter: [All] │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Domain          │ Status   │ Progress │ Started    │ Action ││
│  ├─────────────────────────────────────────────────────────────┤│
│  │ example.com     │ ✅ Done  │ 100%     │ 2 hrs ago  │ [View] ││
│  │ test.com.au     │ 🔄 Query │  62%     │ 5 min ago  │ [View] ││
│  │ broken.io       │ ❌ Failed│  35%     │ 1 hr ago   │ [Retry]││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  WEEKLY CRON STATUS                                             │
│  Last run: Mon Jan 6, 6:00 AM UTC                               │
│  Scans queued: 47  │  Completed: 45  │  Failed: 2               │
│  Next run: Mon Jan 13, 6:00 AM UTC                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Data Sources:**

```typescript
// All from your existing database - no Inngest API needed
const stats = await supabase.rpc('get_scan_stats', { since: '24 hours' })

// Recent scans query
const { data: recentScans } = await supabase
  .from('scan_runs')
  .select(`
    id, status, progress, created_at, completed_at, error_message,
    leads (email, domain, tier)
  `)
  .order('created_at', { ascending: false })
  .limit(50)
```

**Admin Actions:**
- **[Retry]**: Calls `/api/admin/rescan` with the lead's email
- **[View]**: Links to `/report/{token}`
- **[Cancel]**: Updates scan_runs.status = 'cancelled'

#### Files to Create (if building admin dashboard)

| File | Purpose |
|------|---------|
| `src/app/admin/layout.tsx` | Admin auth wrapper |
| `src/app/admin/scans/page.tsx` | Scan monitor dashboard |
| `src/app/api/admin/stats/route.ts` | Stats aggregation API |
| `src/lib/admin.ts` | Admin permission helpers |

### Recommendation

**Start with Option A** (existing dashboards). Inngest's dashboard is excellent and shows everything you need. Only build a custom admin page if:

1. You're checking dashboards multiple times per week
2. You need to give non-technical team members access
3. You want integrated actions (retry, view report) in one place

The Inngest dashboard will be your primary monitoring tool - it's purpose-built for exactly this use case.

---

## Notes

- Inngest functions run on YOUR infrastructure (Vercel), not theirs
- They only orchestrate - your data never passes through Inngest servers
- Free tier is sufficient until 500+ subscribers
- Dashboard at https://app.inngest.com shows all function runs
