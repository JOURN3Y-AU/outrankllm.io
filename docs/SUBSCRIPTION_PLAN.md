# Subscription System Implementation Plan

**Status:** Sprint 1 Complete
**Last Updated:** 2026-01-09

## Overview

Transform outrankLLM from a free report tool into a full SaaS with subscriptions, user accounts, and premium features.

---

## User Decisions

| Decision | Choice |
|----------|--------|
| Authentication | Password-based (after email verification) |
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

### Implementation
1. Add `expires_at` column to `reports` table (default: `created_at + 3 days`)
2. Create `<ExpiryCountdown />` component
3. Add expiry check middleware to report page
4. Create expired report UI with subscribe CTA

### Files to Create/Modify
- `supabase/migrations/XXX_add_report_expiry.sql`
- `src/components/report/ExpiryCountdown.tsx`
- `src/app/report/[token]/page.tsx` (add expiry logic)
- `src/app/report/expired/page.tsx` (expired state UI)

---

## Phase 2: Stripe Integration ✅ COMPLETE

**Goal:** Accept payments via Stripe Checkout for three subscription tiers.

### Stripe Products
| Tier | Product ID | Price (AUD) |
|------|-----------|-------------|
| Starter | `prod_TjsuOQ9exS5tbB` | $49/mo |
| Pro | `prod_TjsvNttBDEeReB` | $79/mo |
| Agency | `prod_Tjsw1pXBrPPFo3` | $199/mo |

### Stripe Setup Steps (Test Mode)
1. Log into Stripe Dashboard → toggle "Test mode" (top-right)
2. Get test API keys from Developers → API keys:
   - `STRIPE_SECRET_KEY` (starts with `sk_test_`)
   - `STRIPE_PUBLISHABLE_KEY` (starts with `pk_test_`)
3. Create webhook endpoint in Stripe Dashboard:
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
   - Copy `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)
4. For each product, create a Price (monthly recurring, AUD)
5. Store Price IDs for checkout

### Environment Variables
```env
# Stripe (Test Mode)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Stripe Price IDs (created in dashboard)
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...
```

### Implementation
1. Install Stripe SDK: `npm install stripe`
2. Create checkout session API (redirects to Stripe)
3. Create webhook handler (processes Stripe events)
4. Update pricing page CTAs to initiate checkout
5. Handle success/cancel redirects

### Pricing Page Strategy
**Recommendation:** Keep prices manually aligned, not dynamically fetched.
- Simpler implementation
- Prices change rarely
- Avoid extra API calls on every page load
- If prices change in Stripe, update `src/app/pricing/page.tsx`

### Files to Create/Modify
- `src/lib/stripe.ts` (Stripe client + helpers)
- `src/app/api/stripe/checkout/route.ts` (create checkout session)
- `src/app/api/stripe/webhook/route.ts` (handle Stripe events)
- `src/app/pricing/page.tsx` (wire up CTAs)
- `src/app/subscribe/success/page.tsx` (post-checkout success)
- `src/app/subscribe/cancel/page.tsx` (checkout cancelled)

### Test Cards
| Scenario | Card Number |
|----------|-------------|
| Successful payment | 4242 4242 4242 4242 |
| Declined | 4000 0000 0000 0002 |
| Requires authentication | 4000 0025 0000 3155 |

---

## Phase 3: Authentication & Accounts

**Goal:** Password-based auth for subscribers with account management.

### Auth Flow
1. User has verified email (existing flow)
2. User subscribes → Stripe checkout
3. On success webhook: create password + send "Set your password" email
4. User sets password → account created
5. Future logins: email + password

### Account Features
- View/change subscription tier
- Cancel subscription (at period end)
- Update notification preferences
- Change alert frequency

### Report Security
- After subscribing, report URL returns "subscriber-only" message
- Must log in to view report
- `reports.subscriber_only` boolean flag

### Implementation
1. Add password fields to `leads` table (hashed)
2. Create auth utilities (hash, verify, session management)
3. Build login page
4. Build account dashboard
5. Create "set password" flow (email link)
6. Add session middleware for protected routes
7. Update report access logic

### Files to Create/Modify
- `supabase/migrations/XXX_add_auth_fields.sql`
- `src/lib/auth.ts` (password hashing, sessions)
- `src/app/login/page.tsx`
- `src/app/account/page.tsx` (dashboard)
- `src/app/account/subscription/page.tsx`
- `src/app/account/settings/page.tsx`
- `src/app/set-password/page.tsx`
- `src/middleware.ts` (protect account routes)
- `src/app/report/[token]/page.tsx` (subscriber check)
- `src/app/report/subscriber-only/page.tsx`

---

## Phase 4: Weekly CRON Updates

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

## Phase 5: Subscriber Features

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

### Sprint 1: Foundation (Stripe + TTL)
1. Phase 2: Stripe Integration
2. Phase 1: Report TTL Timer

*Outcome: Users can subscribe and see urgency*

### Sprint 2: Auth & Accounts
3. Phase 3: Authentication & Accounts

*Outcome: Full login system, account management*

### Sprint 3: Subscriber Value
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
-- Phase 1: Report TTL
ALTER TABLE reports ADD COLUMN expires_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN subscriber_only BOOLEAN DEFAULT FALSE;

-- Phase 3: Auth
ALTER TABLE leads ADD COLUMN password_hash TEXT;
ALTER TABLE leads ADD COLUMN password_set_at TIMESTAMPTZ;
CREATE TABLE sessions (...);

-- Phase 4: CRON
CREATE TABLE scan_queue (...);

-- Phase 5A: Questions
CREATE TABLE subscriber_questions (...);

-- Phase 5C: Action Plans
CREATE TABLE action_plans (...);

-- Phase 5D: PRD
ALTER TABLE action_plans ADD COLUMN prd_output JSONB;
```

---

## Environment Variables Needed

```env
# Stripe (add to .env.local)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_AGENCY=price_...

# Auth
SESSION_SECRET=... (generate 32-byte random string)

# CRON
CRON_SECRET=... (for manual testing)
```

---

## Testing Checklist

### Stripe Integration
- [ ] Checkout flow works with test card
- [ ] Webhook receives events
- [ ] Subscription created in database
- [ ] Feature flags update based on tier

### Authentication
- [ ] Set password email sends
- [ ] Login works
- [ ] Session persists
- [ ] Protected routes redirect to login

### Report TTL
- [ ] Timer displays correctly
- [ ] Expired reports show locked state
- [ ] Timer hidden for subscribers

### Weekly Updates
- [ ] CRON triggers correctly
- [ ] Queue processes in chunks
- [ ] Historical data stored
- [ ] Trends display correctly

---

## Notes

- All prices in AUD
- Test mode until launch-ready
- Feature flags already exist - just need tier updates
- Reference implementation in `/reference sources/ai-monitor/` for action plans/PRD patterns
