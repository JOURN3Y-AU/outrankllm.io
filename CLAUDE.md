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
| Starter | $49/mo | Full report, no expiry, weekly updates, Action Plans |
| Pro | $79/mo | + Competitors, Brand Awareness, Action Plans |
| Agency | $199/mo | + Multiple domains, Action Plans, PRD |

## Report Tabs

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
```

### Key Files

- `src/lib/ai/generate-actions.ts` - AI generation with extended thinking + web search
- `src/inngest/functions/enrich-subscriber.ts` - Enrichment pipeline (step 4)
- `src/components/report/tabs/ActionsTab.tsx` - UI with collapsible sections

### Completed Action Archival

When weekly scans regenerate action plans:
1. Completed/dismissed actions are archived to `action_items_history`
2. New actions are generated based on current scan data
3. Similar previously-completed actions are NOT re-added as pending
4. Users see their progress preserved in a "Completed History" section

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
├── ReportTabs.tsx           # Tab navigation
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

## Design Notes

- Green (#22c55e) = primary accent
- Gold (#d4a574) = premium/subscriber features
- Monospace font for labels, buttons, technical elements
- Ghost mascot on landing page only
