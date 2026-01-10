# Subscription System Implementation Plan

**Status:** Sprint 4 Complete (Editable Questions), Sprint 5 Ready
**Last Updated:** 2026-01-10

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

## Phase 4: Weekly CRON Updates ✅ COMPLETE (via Inngest)

**Goal:** Run weekly scans for subscribers with trend tracking.

### Implementation (Inngest)

Replaced Vercel Cron with Inngest for reliable background job processing. See `docs/INNGEST_PLAN.md` for full details.

**Key Benefits:**
- Automatic retries per step (if Claude fails, only Claude retries)
- Full visibility in Inngest dashboard
- User-configurable schedules (day, time, timezone)
- No 60-second timeout issues

### User-Configurable Schedule ✅
Subscribers can choose their preferred day and time for weekly report updates:
- **Day of week:** Monday through Sunday selection
- **Time of day:** Hour selection (0-23)
- **Timezone:** Auto-detect from browser, manual override available
- Stored in `leads` table: `scan_schedule_day`, `scan_schedule_hour`, `scan_timezone`
- Hourly CRON dispatcher checks which subscribers are due

### How It Works
1. `hourly-scan-dispatcher` runs every hour (`0 * * * *`)
2. Checks which subscribers' local time matches their configured schedule
3. Dispatches `scan/process` events to Inngest for due subscribers
4. Each scan runs the same 10-step process as manual scans
5. Subscribers receive email when scan completes

### Files Created ✅
- `src/inngest/client.ts` - Inngest client singleton
- `src/inngest/functions/process-scan.ts` - Main scan processing (10 steps)
- `src/inngest/functions/hourly-scan-dispatcher.ts` - Hourly CRON scheduler
- `src/app/api/inngest/route.ts` - Inngest webhook handler
- `src/app/api/user/schedule/route.ts` - GET/PATCH schedule settings
- `src/app/dashboard/ScheduleSettings.tsx` - Schedule picker UI
- `supabase/migrations/020_scan_schedule.sql` - Schedule columns on leads

---

## Phase 5: Subscriber Features ⏳ IN PROGRESS

### 5A: Editable Questions (Setup Tab) ✅ COMPLETE

**Goal:** Let subscribers customize scan questions.

- Add/edit/delete questions
- Archive old questions (can restore)
- Questions stored per-lead in `subscriber_questions` table
- Weekly scans automatically use subscriber's custom questions

### Files
- `supabase/migrations/021_subscriber_questions.sql` ✅
- `src/app/api/questions/route.ts` ✅
- `src/app/api/questions/[id]/route.ts` ✅
- `src/components/report/tabs/SetupTab.tsx` ✅

---

### 5E: Brand Awareness (Pro+) ⏳ PENDING

**Goal:** Test what AI assistants actually know about a business.

Brand Awareness runs 5 queries across 4 platforms:
- 1x Brand Recall: "What do you know about [Company]?"
- 3x Service Check: "Does [Company] offer [service]?" (top 3 services)
- 1x Competitor Compare: "How does [Company] compare to [competitor]?"

**Status:** Logic fully built, disabled in pipeline to save API costs for free users.

### Enrichment Pipeline Approach

Brand Awareness (and Action Plans) use an **enrichment pipeline** separate from the main scan:

1. **Free users**: Core scan only (no brand awareness)
2. **Subscriber weekly scans**: Full pipeline including brand awareness
3. **New subscriber (post-checkout)**: Trigger enrichment job on existing report
4. **Manual rescan**: Include brand awareness for subscribers

This keeps the free tier fast while giving subscribers premium insights.

### Enrichment UX

When enrichment is in progress, premium tabs show a loading state:

```
┌─────────────────────────────────────────┐
│  ⏳ Generating Brand Analysis...        │
│                                         │
│  We're asking AI assistants what they   │
│  know about your brand. ~1 minute.      │
│                                         │
│  [━━━━━━━━━━━━░░░░░░] 60%               │
└─────────────────────────────────────────┘
```

### Files
- `src/lib/ai/brand-awareness.ts` ✅ (logic complete)
- `src/components/report/tabs/BrandAwarenessTab.tsx` ✅ (UI complete)
- `src/inngest/functions/enrich-subscriber.ts` (pending - enrichment job)
- `supabase/migrations/003_brand_awareness.sql` ✅ (needs perplexity fix)

---

### 5B: Trend Charts (Measurements) ✅ COMPLETE

**Goal:** Show historical visibility data over time.

### Implementation ✅
Dual-axis trend chart in Measurements tab:
- **Left axis**: AI Visibility Score (0-100)
- **Right axis**: Per-platform mention counts (ChatGPT, Perplexity, Gemini, Claude)
- **Legend**: Grouped by axis type for clarity
- **Free users**: Locked "Subscribers Only" overlay

### Database ✅
- `score_history` table stores per-run snapshots
- Migration `019_add_platform_mentions.sql` adds per-platform columns
- Backfill query populates existing data from `llm_responses`

### Files ✅
- `supabase/migrations/013_score_history.sql` (base schema)
- `supabase/migrations/019_add_platform_mentions.sql` (platform mentions)
- `src/app/api/trends/route.ts` (GET/POST endpoints)
- `src/app/api/process/route.ts` (records platform mentions)
- `src/components/report/TrendChart.tsx` (dual-axis chart)
- `src/components/report/tabs/MeasurementsTab.tsx` (integration)

---

### 5C: Action Plans (Actions Tab) ⏳ PENDING

**Goal:** Generate actionable recommendations from analysis.

Based on reference implementation, action plans should:
- Be grounded in actual analysis data (AI Readiness + AI Responses)
- Categorize by effort/impact
- NOT invent work - only suggest fixes for detected issues

**Access:** Starter, Pro, and Agency tiers (locked teaser for Free)

### Structure

See `docs/PHASE5_PLAN.md` for full schema. Key components:
- Executive Summary
- Top 10 Priority Actions (with effort/impact/consensus)
- Page-by-Page Edit Guide
- Content Creation Priorities
- Keyword Integration Map
- Key Takeaways

### Implementation
- Generate from `site_analyses` + `llm_responses` + `brand_awareness_results` data
- Use Claude to synthesize
- Store in `action_plans` table
- Generated via enrichment pipeline (same as brand awareness)
- UI with collapsible sections

### Files
- `supabase/migrations/022_action_plans.sql`
- `src/lib/ai/generate-actions.ts`
- `src/app/api/actions/route.ts`
- `src/components/report/tabs/ActionsTab.tsx`

---

### 5D: PRD Generation (PRD Tab) ⏳ PENDING

**Goal:** Generate detailed specs for vibe coding platforms.

**Access:** Pro and Agency tiers only (locked teaser for Starter/Free)

Based on reference implementation:
- Take action plan items
- Generate rich PRD with acceptance criteria
- Copy-paste ready format for Claude Code / Cursor

### Structure

See `docs/PHASE5_PLAN.md` for full schema. Key components:
- Organized by priority (Quick Wins, Strategic, Backlog)
- Problem/Solution format
- Implementation steps with code snippets
- Acceptance criteria checklist
- Technical notes

### Implementation
- Generate from action plans
- Claude-powered generation
- Store in `action_plans.prd_outputs` JSONB column
- Copy-to-clipboard with visual feedback
- Generated on-demand per action (not batch)

### Files
- `src/lib/ai/generate-prd.ts`
- `src/app/api/prd/route.ts`
- `src/app/api/prd/[actionId]/route.ts`
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

### Sprint 3: Subscriber Value & Automation ✅ COMPLETE
4. Phase 4: Weekly CRON Updates ✅ COMPLETE (via Inngest)
5. Phase 5B: Trend Charts ✅ COMPLETE

*Outcome: Subscribers get ongoing value with automated weekly scans*

### Sprint 4: Subscriber Features ✅ COMPLETE
6. Phase 5A: Editable Questions ✅ COMPLETE

*Outcome: Subscribers can customize their scan questions*

### Sprint 5: Premium Features ⏳ IN PROGRESS

**Enrichment Pipeline Architecture:**
Premium features (Brand Awareness, Action Plans) run via a separate "enrichment" Inngest job:
- Triggered after subscription checkout (enrich existing report)
- Included in weekly subscriber scans
- ~1-2 minutes additional processing
- Tabs show loading state while enrichment runs

7. Phase 5E: Brand Awareness + Enrichment Pipeline
   - Create `enrich-subscriber` Inngest function
   - Enable brand awareness for subscribers
   - Fix database schema (add perplexity platform)
   - Add loading state to BrandAwarenessTab

8. Phase 5C: Action Plans
   - Add action plan generation to enrichment pipeline
   - Create ActionsTab UI

9. Phase 5D: PRD Generation
   - On-demand PRD generation from actions
   - Create PRDTab UI

*Outcome: Full premium feature set with smart cost optimization*

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

-- Phase 4: CRON ✅ (via Inngest)
ALTER TABLE leads ADD COLUMN scan_schedule_day INTEGER DEFAULT 1;
ALTER TABLE leads ADD COLUMN scan_schedule_hour INTEGER DEFAULT 9;
ALTER TABLE leads ADD COLUMN scan_timezone TEXT DEFAULT 'Australia/Sydney';

-- Phase 5A: Questions ✅
CREATE TABLE subscriber_questions (...);
CREATE TABLE question_history (...);

-- Phase 5B: Trend Charts ✅
CREATE TABLE score_history (...);
-- Migration 019 adds: chatgpt_mentions, claude_mentions, gemini_mentions, perplexity_mentions

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

# Inngest (from https://app.inngest.com)
INNGEST_SIGNING_KEY=signkey-...
INNGEST_EVENT_KEY=...

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

### Weekly Updates ✅ (via Inngest)
- [x] Inngest functions deployed and synced
- [x] Hourly dispatcher runs correctly
- [x] Scans process with retries per step
- [x] Historical data stored in score_history
- [x] Trends display correctly
- [x] Schedule settings UI in dashboard
- [x] Admin ad-hoc rescan works via Inngest

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
