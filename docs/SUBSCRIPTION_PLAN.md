# Subscription System Implementation Plan

**Status:** Sprint 2 Complete (Auth & Accounts)
**Last Updated:** 2026-01-09

## Overview

Transform outrankLLM from a free report tool into a full SaaS with subscriptions, user accounts, and premium features.

---

## User Decisions

| Decision | Choice |
|----------|--------|
| Authentication | Password-based (after Stripe checkout) |
| CRON hosting | Vercel Cron (with chunking strategy) |
| AI generation | Hybrid (generate once, allow regenerate) |
| Currency | AUD |

---

## Phase 1: Report TTL & Urgency Timer ✅ COMPLETE

**Goal:** Create urgency for free users to subscribe by showing a countdown timer.

### Requirements
- [x] Reports expire after 3 days (configurable in code)
- [x] Prominent countdown timer on report page (days, hours, minutes)
- [x] Timer disappears for subscribed users
- [x] After expiry: report locked, prompt to subscribe

### Implementation Notes
- `ExpiryCountdown.tsx` component shows live countdown
- Expiry is set in `process/route.ts` when report is created
- Timer hidden when `featureFlags.isSubscriber` is true
- Locked state shows subscribe CTA overlay

### Files Created/Modified
- `src/components/report/ExpiryCountdown.tsx` ✅
- `src/app/report/[token]/ReportClient.tsx` (added expiry logic) ✅
- `supabase/migrations/010_subscription_enhancements.sql` (expires_at column) ✅

---

## Phase 2: Stripe Integration ✅ COMPLETE

**Goal:** Accept payments via Stripe Checkout for three subscription tiers.

### Stripe Products
| Tier | Product ID | Price (AUD) |
|------|-----------|-------------|
| Starter | `prod_TjsuOQ9exS5tbB` | $49/mo |
| Pro | `prod_TjsvNttBDEeReB` | $79/mo |
| Agency | `prod_Tjsw1pXBrPPFo3` | $199/mo |

### Implementation Notes
- Checkout creates session with `leadId` in metadata
- Webhook handles `checkout.session.completed` to update tier
- Success page prompts user to set password (account creation)
- Billing portal accessible from dashboard

### Files Created
- `src/lib/stripe.ts` ✅
- `src/app/api/stripe/checkout/route.ts` ✅
- `src/app/api/stripe/webhook/route.ts` ✅
- `src/app/api/stripe/portal/route.ts` ✅
- `src/app/api/stripe/verify-session/route.ts` ✅
- `src/app/subscribe/success/page.tsx` ✅
- `src/app/subscribe/cancel/page.tsx` ✅
- `src/app/pricing/page.tsx` (updated CTAs) ✅

### Environment Variables (Vercel)
```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
```

### Test Cards
| Scenario | Card Number |
|----------|-------------|
| Successful payment | 4242 4242 4242 4242 |
| Declined | 4000 0000 0000 0002 |
| Requires authentication | 4000 0025 0000 3155 |

---

## Phase 3: Authentication & Accounts ✅ COMPLETE

**Goal:** Password-based auth for subscribers with account management.

### Auth Flow (Implemented)
1. User gets free report (no account needed)
2. User subscribes → Stripe checkout
3. On success page → Prompt to set password (REQUIRED)
4. Password set → Account created, logged in
5. Future logins: email + password
6. Forgot password → Email reset link

### Account Features (Implemented)
- [x] Dashboard with subscription status
- [x] View tracked domain and latest report
- [x] Manage billing via Stripe portal
- [x] Password reset flow

### Report Security (Implemented)
- [x] Subscriber reports require login to view
- [x] Must be the report owner (lead_id match)
- [x] Non-owners get 404 (prevents snooping)
- [x] Free reports remain public via URL

### Homepage Smart Form (Implemented)
- [x] Not logged in: Standard email + domain form
- [x] Logged in (Free/Starter/Pro): "Welcome back!" + "View Your Report"
- [x] Logged in (Agency): Form with locked email, "Scan New Domain"

### Files Created
- `src/lib/auth.ts` (server-side session helpers) ✅
- `src/lib/auth-client.ts` (client useSession hook) ✅
- `src/app/api/auth/login/route.ts` ✅
- `src/app/api/auth/logout/route.ts` ✅
- `src/app/api/auth/session/route.ts` ✅
- `src/app/api/auth/set-password/route.ts` ✅
- `src/app/api/auth/forgot-password/route.ts` ✅
- `src/app/api/auth/reset-password/route.ts` ✅
- `src/app/api/user/report/route.ts` ✅
- `src/app/dashboard/page.tsx` ✅
- `src/app/forgot-password/page.tsx` ✅
- `src/app/reset-password/page.tsx` ✅
- `src/components/auth/SetPasswordForm.tsx` ✅
- `supabase/migrations/011_password_auth.sql` ✅

### Files Modified
- `src/app/login/page.tsx` (wired to auth API) ✅
- `src/app/report/[token]/page.tsx` (subscriber protection) ✅
- `src/components/landing/EmailForm.tsx` (smart form) ✅
- `src/components/nav/Nav.tsx` (login/account state) ✅
- `src/middleware.ts` (protected routes) ✅

### Environment Variables
```env
JWT_SECRET=<openssl rand -base64 32>
```

---

## Phase 4: Weekly CRON Updates ⏳ PENDING

**Goal:** Run weekly scans for subscribers with trend tracking.

### Vercel Cron Strategy
- Vercel Pro plan: 60-second max execution
- Strategy: Chunk work into small batches
- Queue system: Store pending work in DB, process in chunks

### User-Configurable Schedule (TODO)
Allow subscribers to choose their preferred day and time for weekly report updates:
- **Day of week:** Monday through Sunday selection
- **Time of day:** Dropdown with timezone-aware options (e.g., "9:00 AM", "2:00 PM")
- **Timezone:** Auto-detect from browser, allow manual override
- Store in `leads` table: `report_schedule_day`, `report_schedule_hour`, `report_timezone`
- CRON job checks each subscriber's preferred schedule when processing queue

### CRON Schedule
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/weekly-scans",
      "schedule": "0 6 * * 1"  // Every Monday 6am UTC
    }
  ]
}
```

### Implementation
1. Create `scan_queue` table for pending scans
2. CRON job: Queue all active subscriber scans
3. CRON job: Process queue in chunks (10 at a time)
4. Store each scan result as new `scan_run` for trends
5. Email summary to subscribers

### Data Model
```sql
-- Each subscriber gets weekly scan runs
scan_runs (existing table)
  └── lead_id (subscriber)
  └── created_at (for trending)

-- Queue for pending work
scan_queue
  ├── id
  ├── lead_id
  ├── scheduled_for
  ├── status (pending, processing, completed, failed)
  └── created_at
```

### Files to Create/Modify
- `supabase/migrations/XXX_add_scan_queue.sql`
- `src/app/api/cron/weekly-scans/route.ts`
- `src/app/api/cron/process-queue/route.ts`
- `vercel.json` (cron config)

---

## Phase 5: Subscriber Features ⏳ PENDING

### 5A: Editable Questions (Setup Tab)

**Goal:** Let subscribers customize scan questions.

- Add/edit/delete questions
- Archive old questions (can restore)
- Questions stored per-lead

### Implementation
- `subscriber_questions` table (per-lead custom questions)
- CRUD API routes
- UI components in Setup tab

### Files
- `supabase/migrations/XXX_add_subscriber_questions.sql`
- `src/app/api/questions/route.ts` (CRUD)
- `src/components/report/tabs/SetupTab.tsx` (editable UI)

---

### 5B: Trend Charts (Measurements & Competitors)

**Goal:** Show historical data over time.

- Line charts showing score trends
- Compare current vs previous scans
- Competitor mention trends

### Implementation
- Query historical `scan_runs` for lead
- Aggregate scores by date
- Recharts or similar for visualization

### Files
- `src/lib/trends.ts` (data aggregation)
- `src/components/charts/TrendChart.tsx`
- `src/components/report/tabs/MeasurementsTab.tsx` (add trends)
- `src/components/report/tabs/CompetitorsTab.tsx` (add trends)

---

### 5C: Action Plans (Actions Tab)

**Goal:** Generate actionable recommendations from analysis.

Based on reference implementation, action plans should:
- Be grounded in actual analysis data (AI Readiness + AI Responses)
- Categorize by effort/impact
- NOT invent work - only suggest fixes for detected issues

### Structure
```typescript
interface ActionPlan {
  quickWins: Action[]     // Low effort, high impact
  strategic: Action[]     // Medium effort, high impact
  backlog: Action[]       // Lower priority
}

interface Action {
  title: string
  category: 'seo' | 'geo' | 'content'
  effort: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  description: string
  implementation: string[]  // Step-by-step
  relatedIssue: string      // Link to specific finding
}
```

### Implementation
- Generate from `site_analyses` + `llm_responses` data
- Use Claude to synthesize (like reference implementation)
- Store in `action_plans` table (hybrid: generate once, allow regenerate)
- UI with filtering by category/effort

### Files
- `supabase/migrations/XXX_add_action_plans.sql`
- `src/lib/ai/generate-actions.ts`
- `src/app/api/actions/generate/route.ts`
- `src/components/report/tabs/ActionsTab.tsx`

---

### 5D: PRD Generation (PRD Tab)

**Goal:** Generate detailed specs for vibe coding platforms.

Based on reference implementation:
- Take action plan items
- Generate rich PRD with acceptance criteria
- Copy-paste ready format

### Structure
```typescript
interface PRDTask {
  title: string
  summary: string
  problem: string
  solution: string
  acceptanceCriteria: string[]
  technicalNotes: string
  estimatedEffort: string
  relatedAction: string  // Link to action plan item
}
```

### Implementation
- Generate from action plans
- Claude-powered generation
- Store in `prd_outputs` table
- Copy-to-clipboard functionality

### Files
- `supabase/migrations/XXX_add_prd_outputs.sql`
- `src/lib/ai/generate-prd.ts`
- `src/app/api/prd/generate/route.ts`
- `src/components/report/tabs/PRDTab.tsx`

---

## Implementation Order

### Sprint 1: Foundation (Stripe + TTL) ✅ COMPLETE
1. Phase 2: Stripe Integration ✅
2. Phase 1: Report TTL Timer ✅

*Outcome: Users can subscribe and see urgency*

### Sprint 2: Auth & Accounts ✅ COMPLETE
3. Phase 3: Authentication & Accounts ✅

*Outcome: Full login system, account management, report protection*

### Sprint 3: Subscriber Value ⏳ NEXT
4. Phase 5A: Editable Questions
5. Phase 5B: Trend Charts

*Outcome: Subscribers get ongoing value*

### Sprint 4: Premium Features
6. Phase 5C: Action Plans
7. Phase 5D: PRD Generation

*Outcome: Full premium feature set*

### Sprint 5: Automation
8. Phase 4: Weekly CRON Updates

*Outcome: Fully automated weekly monitoring*

---

## Database Schema Changes Summary

```sql
-- Phase 1: Report TTL ✅
ALTER TABLE reports ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN subscriber_only BOOLEAN DEFAULT FALSE;

-- Phase 2: Stripe ✅
CREATE TABLE subscriptions (...);

-- Phase 3: Auth ✅
ALTER TABLE leads ADD COLUMN password_hash TEXT;
ALTER TABLE leads ADD COLUMN password_set_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN last_login_at TIMESTAMPTZ;
CREATE TABLE password_reset_tokens (...);

-- Phase 4: CRON (pending)
CREATE TABLE scan_queue (...);

-- Phase 5A: Questions (pending)
CREATE TABLE subscriber_questions (...);

-- Phase 5C: Action Plans (pending)
CREATE TABLE action_plans (...);

-- Phase 5D: PRD (pending)
ALTER TABLE action_plans ADD COLUMN prd_output JSONB;
```

---

## Environment Variables Summary

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
JWT_SECRET=<openssl rand -base64 32>

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...

# Email
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=reports@outrankllm.io

# App
NEXT_PUBLIC_APP_URL=https://outrankllm.io
```

---

## Testing Checklist

### Stripe Integration ✅
- [x] Checkout flow works with test card
- [x] Webhook receives events
- [x] Subscription created in database
- [x] Feature flags update based on tier

### Authentication ✅
- [x] Set password works on success page
- [x] Login works
- [x] Session persists (7-day cookie)
- [x] Protected routes redirect to login
- [x] Forgot/reset password flow works

### Report TTL ✅
- [x] Timer displays correctly for free users
- [x] Expired reports show locked state
- [x] Timer hidden for subscribers

### Report Protection ✅
- [x] Free reports accessible via URL
- [x] Subscriber reports require login
- [x] Wrong user gets 404

### Homepage Smart Form ✅
- [x] Shows "Welcome back" for logged-in users
- [x] Shows "View Your Report" button
- [x] Agency users can scan new domains

### Weekly Updates (pending)
- [ ] CRON triggers correctly
- [ ] Queue processes in chunks
- [ ] Historical data stored
- [ ] Trends display correctly

---

## Known Issues / Tech Debt

1. **ChatGPT token truncation**: Some long responses hit the 4000 token limit. Not critical - responses are still saved, just truncated. Could increase limit if needed.

2. **Agency domain list**: Currently Agency users see the form but no list of their existing domains. Future enhancement: show domain picker/list.

3. **Email templates**: Password reset email is basic. Could improve styling to match report email.

---

## Notes

- All prices in AUD
- Currently using Stripe test mode - switch to live mode when ready
- Feature flags in `src/lib/features/flags.ts` control tier access
- Reference implementation in `/reference sources/ai-monitor/` for action plans/PRD patterns
