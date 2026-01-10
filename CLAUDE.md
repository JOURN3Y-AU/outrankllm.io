# CLAUDE.md - outrankllm.io

## Overview

SaaS platform for Generative Engine Optimization (GEO) - helping businesses improve visibility in AI assistants (ChatGPT, Claude, Gemini).

## Tech Stack

Next.js 14+ (App Router) | Tailwind CSS v4 | Supabase | Vercel | Resend | Vercel AI SDK | Stripe | Inngest

## Critical: Tailwind CSS v4 Quirk

**Arbitrary value classes don't compile.** Always use inline styles:

```tsx
// DON'T
<div className="max-w-xl mx-auto gap-4">

// DO
<div style={{ maxWidth: '576px', marginLeft: 'auto', marginRight: 'auto', gap: '16px' }}>
```

Affects: `max-w-*`, `mx-auto`, `gap-*`, `p-*` with custom values.

## Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| Free | $0 | One report, 3-day expiry, limited features |
| Starter | $49/mo | Full report, no expiry, weekly updates |
| Pro | $79/mo | + Competitors, Brand Awareness |
| Agency | $199/mo | + Multiple domains, Action Plans, PRD |

## Report Tabs

1. **Start Here** - Persona selection + tailored guide
2. **Setup** - Business identity, services, questions
3. **AI Readiness** - Technical SEO/GEO indicators (sticky upsell)
4. **AI Responses** - LLM query responses + Export button (sticky upsell)
5. **Measurements** - Visibility score breakdown (sticky upsell)
6. **Competitors** - Detected competitors + Competitive Intelligence + Export button (Pro+)
7. **Brand Awareness** - Direct brand recognition (Pro+)
8. **Actions** - Action plans (Agency)
9. **PRD** - PRD generation (Agency)

## Markdown Export

Both AI Responses and Competitors tabs have an **Export** button that downloads data as markdown files for use in external AI assistants.

### AI Responses Export (`ai-responses-{domain}.md`)
- Summary: total responses and mention count/percentage
- Grouped by platform (ChatGPT, Claude, Gemini, Perplexity)
- Each response shows: question, mention status, full response text

### Competitive Intelligence Export (`competitive-analysis-{domain}.md`)
- Competitive Summary: overall position, strengths, weaknesses, opportunities
- Per-competitor analysis from each AI platform
- Positioning status (STRONGER/WEAKER/EQUAL) per platform

Export buttons are styled consistently with platform filter buttons and appear next to them in the filter bar.

## Authentication

Password-based auth with JWT sessions:

- `src/lib/auth.ts` - Server-side session helpers (`getSession`, `requireSession`)
- `src/lib/auth-client.ts` - Client-side hook (`useSession`)
- Sessions stored in HTTP-only cookies, 7-day expiry
- Account creation happens post-Stripe checkout on success page

### Protected Routes

- `/dashboard/*` - Requires login (middleware redirect)
- `/report/[token]` - If owner is subscriber, requires login as owner

## Report Access Control

```
Free user report: Public via URL token
Subscriber report: Login required, must be report owner
```

When a subscriber tries to access their report:
1. Not logged in → Redirect to `/login?redirect=/report/{token}`
2. Logged in, wrong user → 404 (prevents snooping)
3. Logged in, correct user → Show report

## Report Expiry (Free Users)

- Free reports expire 3 days after creation
- `ExpiryCountdown` component shows countdown timer
- After expiry: Report locked, prompt to subscribe
- Subscribers: No expiry, timer hidden

## Homepage Smart Form

When logged in, the email form shows different states:

| User State | Display |
|------------|---------|
| Not logged in | Standard email + domain form |
| Logged in (Free/Starter/Pro) | "Welcome back!" + "View Your Report" button |
| Logged in (Agency) | Form with email locked, "Scan New Domain" button |

## Scoring System

Reach-weighted scoring based on AI traffic share:

| Platform   | Weight |
|------------|--------|
| ChatGPT    | 10     |
| Perplexity | 4      |
| Gemini     | 2      |
| Claude     | 1      |

Formula: `(chatgpt% x 10 + perplexity% x 4 + gemini% x 2 + claude% x 1) / 17 x 100`

See `src/lib/ai/search-providers.ts` for implementation.

## Upsell CTAs

Sticky CTAs on report tabs link to `/pricing?from=report`:

| Condition | CTA Text |
|-----------|----------|
| Issues detected | "Get Fixes & Action Plans" |
| All passing | "Subscribe for Weekly Monitoring" |

Pricing page shows "Back to Report" button when `?from=report` param present.

## Scroll/Tab Preservation

When users click pricing CTAs and return via back button, scroll position and active tab are restored:

- `sessionStorage.report_scroll_position` - Saved on CTA click, restored on mount
- `sessionStorage.report_active_tab` - Saved on tab change, restored after hydration
- Both cleared after one-time use to prevent stale state

**Hydration note**: Tab restoration must happen in `useEffect`, not `useState` initializer, to avoid SSR mismatch.

## Background Jobs (Inngest)

Inngest handles all background job processing with retries, monitoring, and reliable execution.

### Key Files
- `src/inngest/client.ts` - Inngest client singleton
- `src/inngest/functions/process-scan.ts` - Main scan processing (8 steps)
- `src/inngest/functions/hourly-scan-dispatcher.ts` - Weekly CRON scheduler
- `src/app/api/inngest/route.ts` - Inngest webhook handler

### How Scans Work
1. `/api/scan` or `/api/admin/rescan` sends `scan/process` event to Inngest
2. `process-scan` function runs 8 sequential steps (crawl, analyze, query each platform, finalize)
3. Each step retries independently - if Claude fails, only Claude retries
4. Progress updates written to `scan_runs` table for polling

### Weekly CRON Scans
- `hourly-scan-dispatcher` runs every hour (`0 * * * *`)
- Checks which subscribers' local time matches their schedule
- Dispatches `scan/process` events for due subscribers
- Subscribers configure schedule in dashboard (day, time, timezone)

### Local Development
```bash
# Terminal 1: Next.js
npm run dev

# Terminal 2: Inngest dev server
npm run dev:inngest
```

Inngest dashboard: http://localhost:8288

### Environment Variables (Vercel)
- `INNGEST_SIGNING_KEY` - From Inngest dashboard
- `INNGEST_EVENT_KEY` - From Inngest dashboard

## API Routes

### Scan & Processing
- `POST /api/scan` - Initiate scan (sends to Inngest)
- `POST /api/process` - DEPRECATED: Use Inngest functions instead
- `GET /api/scan/status` - Poll progress
- `GET /api/verify` - Email verification (magic link)
- `GET /api/trends` - Get score history for trend charts (subscribers only)
- `GET /api/inngest` - Inngest webhook handler

### Authentication
- `POST /api/auth/login` - Email/password login
- `POST /api/auth/logout` - Clear session
- `GET /api/auth/session` - Get current session (client-side)
- `POST /api/auth/set-password` - Set initial password after checkout
- `POST /api/auth/forgot-password` - Request reset email
- `POST /api/auth/reset-password` - Reset with token

### Stripe
- `POST /api/stripe/checkout` - Create checkout session
- `POST /api/stripe/webhook` - Handle Stripe events
- `POST /api/stripe/portal` - Create billing portal session

### User
- `GET /api/user/report` - Get user's latest report token
- `GET /api/user/schedule` - Get scan schedule settings
- `PATCH /api/user/schedule` - Update scan schedule (day, hour, timezone)

### Questions (Subscribers)
- `GET /api/questions` - Get subscriber's editable questions
- `POST /api/questions` - Create new question
- `PUT /api/questions/[id]` - Update question text/category
- `DELETE /api/questions/[id]` - Archive question (soft delete)

## Key Files

- `src/app/globals.css` - CSS variables (colors, fonts)
- `src/lib/ai/search-providers.ts` - LLM queries + scoring
- `src/lib/auth.ts` - Server auth helpers
- `src/lib/auth-client.ts` - Client auth hook
- `src/lib/stripe.ts` - Stripe client
- `src/lib/features/flags.ts` - Feature flags by tier
- `src/inngest/client.ts` - Inngest client + event types
- `src/inngest/functions/process-scan.ts` - Main scan processing
- `src/inngest/functions/hourly-scan-dispatcher.ts` - Weekly CRON
- `supabase/migrations/` - Database schema
- `.env.example` - Required env vars

## Environment Variables

```
# Required for auth
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
```

## Trend Charts (Subscribers Only)

Subscribers see historical visibility trends in the Measurements tab:

- **Left axis**: AI Visibility Score (0-100)
- **Right axis**: Per-platform mention counts (ChatGPT, Perplexity, Gemini, Claude)
- **Data source**: `score_history` table with per-run snapshots
- **API**: `GET /api/trends` returns historical snapshots

### Score History Schema

```sql
score_history
├── visibility_score     -- Overall score (left axis)
├── chatgpt_mentions     -- Per-platform mention counts (right axis)
├── claude_mentions
├── gemini_mentions
├── perplexity_mentions
└── recorded_at          -- Timestamp for x-axis
```

Free users see a locked "Subscribers Only" overlay on the trend chart.

## Editable Questions (Subscribers Only)

Subscribers can customize the questions used in their scans via the Setup tab.

### How It Works

1. **Initial setup**: When a subscriber first scans, AI-generated questions from `scan_prompts` are copied to `subscriber_questions`
2. **Edit flow**: Subscribers edit questions in SetupTab → changes saved to `subscriber_questions` table
3. **Next scan**: Weekly scans use questions from `subscriber_questions` instead of generating new ones

### Data Flow

```
Free users:  scan_prompts (read-only, per-scan)
Subscribers: subscriber_questions (editable, per-lead)
```

The report page checks `featureFlags.isSubscriber`:
- **Subscribers**: Fetch from `subscriber_questions` table (editable IDs)
- **Free users**: Fetch from `scan_prompts` table (read-only)

### Database Schema

```sql
subscriber_questions
├── id              -- Used by edit API
├── lead_id         -- Owner
├── prompt_text     -- The question text
├── category        -- 'general' | 'service' | 'location' | 'comparison'
├── source          -- 'ai_generated' | 'user_created'
├── is_active       -- Used in scans
├── is_archived     -- Soft delete
└── sort_order      -- Display order
```

### Key Files
- `src/app/api/questions/route.ts` - GET/POST for questions list
- `src/app/api/questions/[id]/route.ts` - PUT/DELETE for individual questions
- `src/components/report/tabs/SetupTab.tsx` - Editable UI
- `supabase/migrations/021_subscriber_questions.sql` - Schema

## Report Component Structure

```
src/components/report/
├── ReportTabs.tsx           # Tab navigation
├── ExpiryCountdown.tsx      # Free user countdown timer
├── TrendChart.tsx           # Multi-line trend chart (dual axis)
├── shared/
│   ├── types.ts             # Type definitions
│   ├── constants.ts         # Tab config, platformColors, platformNames
│   ├── utils.tsx            # formatResponseText, calculateReadinessScore
│   └── FilterButton.tsx     # Reusable filter button
└── tabs/
    ├── StartHereTab.tsx     # Persona selection + guide
    ├── SetupTab.tsx         # Business identity, services
    ├── AIReadinessTab.tsx   # Technical checks
    ├── ResponsesTab.tsx     # LLM responses
    ├── MeasurementsTab.tsx  # Score gauges + trend charts
    ├── CompetitorsTab.tsx   # Competitor analysis
    ├── BrandAwarenessTab.tsx # Brand recognition
    └── LockedTab.tsx        # Generic locked state
```

## Design Notes

- Green (#22c55e) = primary accent
- Gold (#d4a574) = premium/subscriber features
- Monospace font for labels, buttons, technical elements
- Ghost mascot on landing page only
