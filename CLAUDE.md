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

Pricing varies by region (Australian vs International):

| Tier | AU (AUD) | INTL (USD) | Features |
|------|----------|------------|----------|
| Free | $0 | $0 | One report, 7-day expiry, limited features |
| Starter | A$39/mo | $24.99/mo | Full report, no expiry, weekly updates, Action Plans |
| Pro | A$59/mo | $39.99/mo | + Competitors, Brand Awareness, Action Plans, PRD |
| Agency | A$199/mo | $139/mo | + Multiple domains, Action Plans, PRD |

## Region-Based Pricing

Australian customers see AUD pricing; all others see USD. Detection uses multiple signals:

### Detection Priority
1. **Query param override** (`?region=AU` or `?region=US`) - for testing
2. **Cookie preference** - set when user clicks region toggle
3. **ABN detected** - Australian Business Number in website content
4. **Domain TLD** - `.com.au`, `.net.au`, etc.
5. **Australian phone** - `+61`, `04xx` patterns
6. **IP geolocation** - Vercel `x-vercel-ip-country` header
7. **Default** - INTL (USD) in production, AU in development

### Key Files
- `src/lib/stripe-config.ts` - Client-safe pricing constants (TIER_PRICES, CURRENCY_SYMBOL)
- `src/lib/stripe.ts` - Server-side Stripe client + price ID mapping
- `src/lib/geo/pricing-region.ts` - Region detection logic
- `src/app/api/pricing/region-context/route.ts` - Fetch Australian signals from lead data
- `src/middleware.ts` - Sets `pricing_region` cookie from Vercel geo headers

### Environment Variables
```
# Australian pricing (AUD)
STRIPE_PRICE_STARTER_AU=price_xxx
STRIPE_PRICE_PRO_AU=price_xxx
STRIPE_PRICE_AGENCY_AU=price_xxx

# International pricing (USD)
STRIPE_PRICE_STARTER_USD=price_xxx
STRIPE_PRICE_PRO_USD=price_xxx
STRIPE_PRICE_AGENCY_USD=price_xxx
```

### Testing
- `http://localhost:3000/pricing?region=AU` - Force Australian pricing
- `http://localhost:3000/pricing?region=US` - Force USD pricing
- Clear `pricing_region` cookie to reset detection

## Report Tabs

The tab navigation bar is **sticky** - it stays fixed at the top of the viewport as users scroll down, making it easy to switch between tabs without scrolling back up.

1. **Start Here** - Persona selection + tailored guide
2. **Setup** - Business identity, services, questions
3. **AI Readiness** - Technical SEO/GEO indicators (sticky upsell)
4. **AI Responses** - LLM query responses + Export button (sticky upsell)
5. **Measurements** - Visibility score breakdown (sticky upsell)
6. **Competitors** - Detected competitors + Competitive Intelligence + Export button (Pro+)
7. **Brand Awareness** - Direct brand recognition (Pro+)
8. **Actions** - Action plans (Subscribers only)
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

- Free reports expire 7 days after creation
- `ExpiryCountdown` component shows countdown timer
- After expiry: Report locked, prompt to subscribe
- Subscribers: No expiry, timer hidden

## Homepage Demo Video

Product demo video autoplays (muted) between the tagline and email form for first-time visitors.

### Features
- **Autoplay muted loop** - Plays automatically, browsers allow this for muted videos
- **Click to expand** - Opens fullscreen modal with synced playback position
- **Landscape mobile** - Fills screen edge-to-edge when phone rotated
- **Close options** - X button, click outside, or Escape key

### Key Files
- `src/components/landing/DemoVideo.tsx` - Video component with modal
- `public/images/website-vid.mp4` - Product demo video (~8MB)

### Updating the Video
Replace `public/images/website-vid.mp4` with a new recording:
- **Format**: MP4 (not GIF - much smaller file size)
- **Resolution**: 720p or 1080p
- **Frame rate**: 30fps is sufficient
- **Aspect ratio**: 16:9 or 16:10 works best

## Homepage Smart Form

When logged in, the email form shows different states:

| User State | Display |
|------------|---------|
| Not logged in | Standard email + domain form + T&Cs checkbox |
| Logged in (Free/Starter/Pro) | "Welcome back!" + "View Your Report" button |
| Logged in (Agency) | Form with email locked, "Scan New Domain" button |

### Terms & Conditions Consent

Users must agree to T&Cs before submitting the homepage form:
- Checkbox required before "Get Free Report" button enables
- Consent timestamp stored in `leads.terms_accepted_at`
- Links to `/terms` page (opens in new tab)

### Key Pages
- `/terms` - Full Terms & Conditions
- `/about` - Company info (OutrankLLM by JOURN3Y)

Footer contains links to About and Terms pages.

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
2. `process-scan` function runs steps with **parallel platform queries** (DAG pattern)
3. Each platform runs as its own step with independent retry/timeout
4. Progress updates written to `scan_runs` table for polling

### Parallel Processing Architecture

Both `process-scan` and `enrich-subscriber` use Inngest's DAG pattern for parallel execution:

```
process-scan (10m timeout):
  setup → crawl → analyze → research-queries (per platform) → save-prompts
    ↓
  ┌─ query-platform-chatgpt ─┐
  ├─ query-platform-claude   ├─ ALL RUN IN PARALLEL (~4x faster)
  ├─ query-platform-gemini   │
  └─ query-platform-perplexity┘
    ↓
  update-progress → finalize-report → invoke-enrichment (step.invoke) → send-email
                                             │
                                             ↓ (synchronous call)
                                    enrich-subscriber (15m timeout):
                                      setup-enrichment → brand-awareness-setup
                                        ↓
                                      ┌─ brand-awareness-chatgpt ─┐
                                      ├─ brand-awareness-claude   ├─ PARALLEL
                                      ├─ brand-awareness-gemini   │
                                      └─ brand-awareness-perplexity┘
                                        ↓
                                      brand-awareness-save → competitive-summary
                                        → generate-action-plan → generate-prd → finalize
```

**Benefits**:
- ~4x faster scan times (parallel vs sequential platform queries)
- Independent retries per platform (if Gemini fails, only Gemini retries)
- Better observability in Inngest dashboard
- Each step has its own timeout budget
- `step.invoke` ensures enrichment only starts after scan data is committed (no race conditions)

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
- `POST /api/stripe/checkout` - Create checkout session (supports promotion codes)
- `POST /api/stripe/webhook` - Handle Stripe events
- `POST /api/stripe/portal` - Create billing portal session

### Promotion Codes / Vouchers

Stripe Checkout has `allow_promotion_codes: true` enabled, so users see an "Add promotion code" field during checkout.

**Creating vouchers** (Stripe Dashboard only, no code changes needed):
1. Products → Coupons → Create coupon (set % off, $ off, duration)
2. Click Promotion codes tab → Create code (e.g., `WELCOME50`)
3. Set restrictions: max redemptions, expiry date, first-time customers only

**No webhook changes needed** - Stripe sends the same subscription events; discounts are tracked automatically.

### User
- `GET /api/user/report` - Get user's latest report token
- `GET /api/user/schedule` - Get scan schedule settings
- `PATCH /api/user/schedule` - Update scan schedule (day, hour, timezone)

### Questions (Subscribers)
- `GET /api/questions` - Get subscriber's editable questions
- `POST /api/questions` - Create new question
- `PUT /api/questions/[id]` - Update question text/category
- `DELETE /api/questions/[id]` - Archive question (soft delete)

### Feedback
- `POST /api/feedback` - Submit bug report or feedback (sends email alert)

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

# Stripe Price IDs - Australian (AUD)
STRIPE_PRICE_STARTER_AU=price_...
STRIPE_PRICE_PRO_AU=price_...
STRIPE_PRICE_AGENCY_AU=price_...

# Stripe Price IDs - International (USD)
STRIPE_PRICE_STARTER_USD=price_...
STRIPE_PRICE_PRO_USD=price_...
STRIPE_PRICE_AGENCY_USD=price_...

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

## AI-Powered Action Plans (Subscribers)

Subscribers get comprehensive, AI-generated action plans with:

### How It Works

1. **Automatic generation**: Action plans are generated during subscriber enrichment (after checkout or weekly scans)
2. **Extended thinking**: Uses Claude with extended thinking for deep analysis
3. **Web search**: Searches for current SEO/GEO best practices before generating
4. **Page-level data**: Recommends specific fixes like "/services missing H1 tag"
5. **Source insights**: Each action links back to specific scan data (AI Responses, AI Readiness, Brand Awareness, Competitive Intelligence)

### Generated Content

- **Executive Summary**: 2-3 sentence overview of current state and top opportunity
- **Priority Actions** (10-15): Ranked by impact/effort with implementation steps
- **Source Insight**: Links each action to specific scan findings ("Based on your AI Responses...")
- **Page Edits**: Copy-paste ready meta titles, descriptions, and content
- **Keyword Map**: Where to add keywords, which pages, priority level
- **Key Takeaways**: Data-backed insights

### Content Quality Guidelines

The AI follows strict guidelines to avoid search engine penalties:
- No unsubstantiated superlatives ("best", "top", "#1")
- No keyword stuffing in URLs or meta tags
- Professional URL patterns: `/services/digital-marketing` not `/best-cheap-seo-2024`
- Focus on E-E-A-T (Experience, Expertise, Authority, Trust)
- Honest claims only - proof points over boasts

### Database Schema

```sql
crawled_pages
├── path, url              -- Page identification
├── title, h1              -- SEO elements
├── meta_description       -- Meta tag
├── headings[]             -- H2/H3 structure
├── word_count             -- Content depth
├── schema_types[]         -- JSON-LD types found
└── schema_data            -- Full structured data

action_plans
├── executive_summary      -- AI-generated summary
├── page_edits             -- JSONB of page-specific edits
├── keyword_map            -- JSONB keyword recommendations
├── key_takeaways          -- JSONB insights
└── quick_win_count, strategic_count, backlog_count

action_items
├── title, description     -- Action details
├── source_insight         -- Links to scan data ("Based on your AI Responses...")
├── priority               -- 'quick_win' | 'strategic' | 'backlog'
├── consensus[]            -- Which AI platforms support this
├── implementation_steps[] -- Step-by-step guide
├── expected_outcome       -- What improvement this drives
└── status                 -- 'pending' | 'completed' | 'dismissed'

action_items_history       -- Archive of completed actions (preserved across rescans)
├── original_action_id     -- Reference to original action (for deduplication)
├── lead_id                -- Owner
├── domain_subscription_id -- For multi-domain isolation
├── title, description     -- Action details (for display)
├── category               -- Action category
└── completed_at           -- When action was completed
```

### Key Files

- `src/lib/ai/generate-actions.ts` - AI generation with extended thinking + web search
- `src/inngest/functions/enrich-subscriber.ts` - Enrichment pipeline (step 4)
- `src/components/report/tabs/ActionsTab.tsx` - UI with collapsible sections

### Completed Action Tracking

Users can tick actions as complete, and their progress is preserved:

**UI Behavior**:
1. User ticks checkbox → action marked complete + immediately added to "Completed Actions" section
2. User unticks → action reverted to pending + removed from history
3. Progress persists across page refreshes

**Backend Flow** (PATCH `/api/actions/[id]`):
- `status: 'completed'` → Insert to `action_items_history` (check-then-insert to avoid duplicates)
- `status: 'pending'` → Delete from `action_items_history`

**Frontend Flow** (ActionsTab.tsx):
- Optimistically update local state for immediate UI feedback
- Track both `id` and `original_action_id` to handle DB vs locally-added items
- Deduplication: `prev.some(h => h.id === actionId || h.original_action_id === actionId)`

**GET /api/actions Merging**:
- Fetches from `action_items_history` table
- Also merges any completed actions from current plan not in history (handles edge cases)
- Uses `original_action_id` (not history table's `id`) for deduplication

**Weekly Scan Regeneration**:
1. Completed/dismissed actions are preserved in `action_items_history`
2. New actions are generated based on current scan data
3. Similar previously-completed actions are NOT re-added as pending
4. Users see their progress preserved in "Completed Actions" section

## PRD Generation (Pro/Agency)

Pro and Agency subscribers get Claude Code / Cursor-ready PRD documents with content/code separation.

### How It Works

1. **Automatic generation**: PRDs are generated during subscriber enrichment (step 5, after action plans)
2. **Extended thinking**: Uses Claude with extended thinking for detailed technical output
3. **Action plan based**: Transforms action items into implementation tasks with code snippets
4. **Content/code separation**: Tasks that need content (FAQs, case studies) are flagged with `requiresContent` and include `contentPrompts`
5. **Standard tasks**: FAQ Schema and LocalBusiness Schema are always included for service businesses
6. **History filtering**: Previously completed tasks are not regenerated

### Content/Code Separation

Some tasks require content to be written before code implementation (FAQ answers, testimonials, case studies). These tasks have:

- **`requiresContent: true`** - Flags the task as needing content first
- **`contentPrompts`** - Array of specific content pieces to write

```typescript
interface ContentPrompt {
  type: string          // "FAQ Answer", "Case Study", "Testimonial", etc.
  prompt: string        // Specific writing prompt for this content
  usedIn: string        // Where this content will be used (file/component)
  wordCount: number     // Target word count
}
```

Example task with content prompts:
```json
{
  "title": "Implement FAQ Schema for Service Pages",
  "requiresContent": true,
  "contentPrompts": [
    {
      "type": "FAQ Answer",
      "prompt": "Write answer for: What is GEO and how does it differ from SEO?",
      "usedIn": "components/FAQSchema.tsx",
      "wordCount": 150
    }
  ]
}
```

### Generated Content

- **Title & Overview**: Project context and goals
- **Tech Stack**: Detected or default (Next.js, React, TypeScript)
- **Tasks by Priority**: Quick Wins (1-4h), Strategic (4-16h), Backlog (16h+)
- **Acceptance Criteria**: Testable pass/fail conditions
- **File Paths**: Suggested files to modify
- **Code Snippets**: JSON-LD examples, component code (use `CONTENT_PLACEHOLDER` for dynamic content)
- **Prompt Context**: Ready-to-paste instructions for AI coding tools
- **Implementation Notes**: Integration considerations and gotchas
- **Content Prompts**: For tasks requiring content before code

### Standard Tasks

For service-based businesses, PRDs always include:
1. **FAQ Schema** (quick_wins, 2-3 hours) - With `requiresContent: true` for FAQ answers
2. **LocalBusiness Schema** (quick_wins, 1-2 hours) - If business has physical location

### Task History Filtering

Completed PRD tasks are archived to `prd_tasks_history`. On regeneration:
1. Query previously completed task titles
2. Pass to Claude with "DO NOT REGENERATE" instruction
3. Safety-net filter at insert time (normalized title matching)

### Database Schema

```sql
prd_documents
├── title, overview        -- Document metadata
├── goals[]                -- Key objectives
├── tech_stack[]           -- Detected tech stack
├── target_platforms[]     -- Web, mobile, etc.
└── generated_at           -- Generation timestamp

prd_tasks
├── title, description     -- Task details
├── acceptance_criteria[]  -- Testable criteria
├── section                -- 'quick_wins' | 'strategic' | 'backlog'
├── category               -- 'technical' | 'content' | 'schema' | 'seo'
├── estimated_hours        -- Time estimate
├── file_paths[]           -- Files to modify
├── code_snippets          -- JSONB with code examples
├── prompt_context         -- Instructions for AI coding tools
├── implementation_notes   -- Integration guidance
├── requires_content       -- Boolean: true if content needed before code
└── content_prompts        -- JSONB array of ContentPrompt objects

prd_tasks_history          -- Archive of completed tasks (preserved across rescans)
├── original_task_id       -- Reference to original task
├── title, description     -- Task details (for filtering)
└── completed_at           -- When task was completed
```

### Key Files

- `src/lib/ai/generate-prd.ts` - AI generation with extended thinking + content separation
- `src/app/api/prd/route.ts` - GET/POST endpoints
- `src/app/api/prd/[id]/route.ts` - PATCH for task status updates
- `src/inngest/functions/enrich-subscriber.ts` - Enrichment pipeline (step 5) with history filtering
- `src/components/report/tabs/PrdTab.tsx` - UI with loading states
- `supabase/migrations/015_prd_documents.sql` - Base schema
- `supabase/migrations/027_prd_content_prompts.sql` - Content separation columns

## Report Component Structure

```
src/components/report/
├── ReportTabs.tsx           # Tab navigation (sticky header)
├── ExpiryCountdown.tsx      # Free user countdown timer
├── TrendChart.tsx           # Multi-line trend chart (dual axis)
├── shared/
│   ├── types.ts             # Type definitions
│   ├── constants.ts         # Tab config, platformColors, platformNames
│   ├── utils.tsx            # formatResponseText, calculateReadinessScore
│   ├── FilterButton.tsx     # Reusable filter button
│   └── EnrichmentLoading.tsx # Loading states for async enrichment
└── tabs/
    ├── StartHereTab.tsx     # Persona selection + guide
    ├── SetupTab.tsx         # Business identity, services
    ├── AIReadinessTab.tsx   # Technical checks
    ├── ResponsesTab.tsx     # LLM responses
    ├── MeasurementsTab.tsx  # Score gauges + trend charts
    ├── CompetitorsTab.tsx   # Competitor analysis
    ├── BrandAwarenessTab.tsx # Brand recognition
    ├── ActionsTab.tsx       # AI-generated action plans
    ├── PrdTab.tsx           # Claude Code / Cursor PRDs (Pro/Agency)
    └── LockedTab.tsx        # Generic locked state
```

## User Feedback System

Help icon (?) in the nav opens a dropdown with options to report bugs or send feedback.

### How It Works

1. User clicks help icon → dropdown with "Report an Issue" / "Give Feedback"
2. Modal opens with type pre-selected (bug, feature, feedback, other)
3. User submits message → saved to `feedback` table
4. Email alert sent to team via Resend

### Key Files

- `src/components/feedback/HelpMenu.tsx` - Nav dropdown
- `src/components/feedback/FeedbackModal.tsx` - Modal with type selection (uses React Portal)
- `src/app/api/feedback/route.ts` - POST endpoint (save + send email)
- `supabase/migrations/029_feedback.sql` - Database schema

### Database Schema

```sql
feedback
├── type           -- 'bug' | 'feature' | 'feedback' | 'other'
├── message        -- User's message
├── page_url       -- Auto-captured
├── user_agent     -- Auto-captured
├── user_email     -- If logged in
├── user_tier      -- If logged in
├── status         -- 'new' | 'reviewed' | 'resolved' | 'wont_fix'
└── created_at
```

## Multi-Domain Subscriptions

All subscribers (Starter, Pro, Agency) can monitor multiple domains. Each domain has its own subscription, scans, and enrichment data.

### Data Model

```
leads (user account)
  │
  ├─→ domain_subscriptions (one per monitored domain)
  │     ├── domain, tier, stripe_subscription_id
  │     ├── scan_schedule_day/hour/timezone
  │     │
  │     ├─→ scan_runs (domain column links to this subscription)
  │     │     ├─→ site_analyses, scan_prompts, llm_responses
  │     │     └─→ reports
  │     │
  │     ├─→ subscriber_questions (per-domain)
  │     ├─→ subscriber_competitors (per-domain)
  │     ├─→ action_plans (per-domain)
  │     └─→ prd_documents (per-domain)
```

### Critical: Domain Isolation

**NEVER use `lead.domain`** for multi-domain features. The `leads.domain` field is a legacy single-value field from before multi-domain support.

**Domain Resolution Priority** (used in enrichment, PRD generation, etc.):
1. `domain_subscriptions.domain` (if `domainSubscriptionId` provided)
2. `scan_runs.domain` (added in migration 032)
3. `lead.domain` (legacy fallback only)

### Key Files
- `src/lib/subscriptions.ts` - Domain subscription CRUD
- `src/app/api/subscriptions/route.ts` - Create/list subscriptions
- `supabase/migrations/030_domain_subscriptions.sql` - Schema
- `supabase/migrations/031_domain_subscription_isolation.sql` - Add domain_subscription_id to all tables
- `supabase/migrations/032_fix_scan_domain_tracking.sql` - Add domain column to scan_runs

---

## Bug Fix History

### 2025-01-12: Multi-Domain Data Isolation Fix

**Problem**: When subscribers added a second domain (e.g., j4rvis.com after mantel.com.au):
1. First domain's report "disappeared" from dashboard
2. Second domain got brand awareness but NO action plans or PRDs
3. Data from first domain contaminated second domain

**Root Cause**: System assumed single domain per user via `leads.domain` field. The Stripe webhook was linking ALL scans to any new domain subscription, and enrichment was using `lead.domain` instead of the actual domain being enriched.

**Fix** (Migration 032 + code changes):

| Component | Issue | Fix |
|-----------|-------|-----|
| `scan_runs` table | No domain column | Added `domain` TEXT column |
| Stripe webhook | Linked ALL scans to new subscription | Filter by `.eq('domain', domain)` |
| `enrich-subscriber.ts` | Used `lead.domain` | Resolve from subscription → scan_run → lead |
| `process-scan.ts` | Didn't store domain | Store `domain` on insert/update |
| `/api/scan` | Free user check was per-lead | Added domain filter to queries |
| `/api/user/report` | Returned `lead.domain` | Return `scanRun.domain` |
| `/api/prd` | Used `lead.domain` for PRD | Resolve domain like enrichment |

**Migration 032 Data Repair**:
- Backfills `domain` from `domain_subscriptions` or `leads`
- Unlinks scans from wrong `domain_subscription_id`
- Re-links scans to correct subscription by matching domain

**Files Modified**:
- `src/app/api/stripe/webhook/route.ts`
- `src/inngest/functions/enrich-subscriber.ts`
- `src/inngest/functions/process-scan.ts`
- `src/app/api/scan/route.ts`
- `src/app/api/user/report/route.ts`
- `src/app/api/prd/route.ts`
- `src/app/api/admin/rescan/route.ts`

**Validation**: `app/scripts/validate-multi-domain-fix.ts`

---

## A/B Testing

Simple config-file based A/B testing with GA4 tracking.

### How It Works

1. **Middleware** assigns visitors to a variant via cookie on first visit
2. **Config file** defines experiments, variants, and weights
3. **ExperimentTracker** component sends variant to GA4 on page load
4. **GA4** tracks all events with `ab_variant` user property for filtering

### Key Files

- `src/lib/experiments/config.ts` - Experiment definitions and weights
- `src/middleware.ts` - Cookie assignment (in `addExperimentCookies`)
- `src/lib/analytics.ts` - GA4 tracking functions (`trackExperimentImpression`)
- `src/components/experiments/ExperimentTracker.tsx` - Client component for tracking

### Adding/Modifying Experiments

Edit `src/lib/experiments/config.ts`:

```typescript
// Add a third variant
variants: [
  { id: 'control', weight: 34 },
  { id: 'variant-b', weight: 33 },
  { id: 'variant-c', weight: 33 },
]

// End experiment (pick winner)
variants: [
  { id: 'variant-b', weight: 100 },
]
```

### Rendering Different Pages

In your page component:

```typescript
import { cookies } from 'next/headers'
import { experiments } from '@/lib/experiments/config'

export default function Home() {
  const variant = cookies().get(experiments.homepage.cookieName)?.value || 'control'

  switch (variant) {
    case 'variant-b':
      return <HomePageNew />
    default:
      return <HomePageControl />
  }
}
```

### GA4 Reporting

1. **User Properties** → Filter by `ab_variant` to see traffic split
2. **Events** → `experiment_impression` shows variant assignments
3. **Conversions** → All existing events (form submissions, checkouts) can be filtered by `ab_variant`

### Testing Locally

Clear the `exp-homepage` cookie to get re-assigned to a variant.

---

## Design Notes

- **Brand name**: outrankllm.io (with `.io` in white, `llm` in green)
- **Page title**: "outrankllm.io | See your visibility to AI"
- Green (#22c55e) = primary accent
- Gold (#d4a574) = premium/subscriber features
- Monospace font for labels, buttons, technical elements
- Ghost mascot on landing page only
