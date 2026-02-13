# Feature Documentation

Reference documentation for outrankllm.io features. Read this file when working on specific features.

## Table of Contents
- [Region-Based Pricing](#region-based-pricing)
- [Report Tabs](#report-tabs)
- [Authentication & Access Control](#authentication--access-control)
- [Homepage Features](#homepage-features)
- [Background Jobs (Inngest)](#background-jobs-inngest)
- [Editable Questions](#editable-questions-subscribers)
- [Action Plans](#ai-powered-action-plans-subscribers)
- [PRD Generation](#prd-generation-proagency)
- [Multi-Domain Subscriptions](#multi-domain-subscriptions)
- [A/B Testing](#ab-testing)
- [User Feedback System](#user-feedback-system)

---

## Region-Based Pricing

Australian customers see AUD pricing; all others see USD.

### Detection Priority
1. Query param override (`?region=AU` or `?region=US`)
2. Cookie preference
3. ABN detected in website content
4. Domain TLD (`.com.au`, `.net.au`)
5. Australian phone (`+61`, `04xx`)
6. IP geolocation (Vercel header)
7. Default: INTL (USD) in production, AU in dev

### Key Files
- `src/lib/stripe-config.ts` - Client-safe pricing constants
- `src/lib/stripe.ts` - Server-side Stripe client
- `src/lib/geo/pricing-region.ts` - Region detection
- `src/middleware.ts` - Sets `pricing_region` cookie

### Testing
- `?region=AU` - Force Australian pricing
- `?region=US` - Force USD pricing
- Clear `pricing_region` cookie to reset

---

## Report Tabs

Tab navigation is **sticky** at viewport top.

1. **Start Here** - Persona selection + guide
2. **Setup** - Business identity, services, questions
3. **AI Readiness** - Technical SEO/GEO indicators
4. **AI Responses** - LLM responses + Export
5. **Measurements** - Visibility score + trends
6. **Competitors** - Competitor analysis (Pro+)
7. **Brand Awareness** - Brand recognition (Pro+)
8. **Actions** - Action plans (Subscribers)
9. **PRD** - PRD generation (Pro/Agency)

### Markdown Export
Both AI Responses and Competitors tabs have Export buttons for markdown download.

### Scroll/Tab Preservation
When returning from pricing page:
- `sessionStorage.report_scroll_position`
- `sessionStorage.report_active_tab`

---

## Authentication & Access Control

Password-based auth with JWT sessions (7-day expiry).

### Key Files
- `src/lib/auth.ts` - Server-side (`getSession`, `requireSession`)
- `src/lib/auth-client.ts` - Client hook (`useSession`)

### Protected Routes
- `/dashboard/*` - Requires login
- `/report/[token]` - Subscriber reports require owner login

### Report Access
```
Free user: Public via URL token
Subscriber: Login required, must be owner
```

### Report Expiry (Free Users)
- 7-day expiry from creation
- `ExpiryCountdown` component shows timer
- After expiry: locked, prompt to subscribe

---

## Homepage Features

### Demo Video
- Autoplays muted between tagline and form
- Click to expand fullscreen modal
- Files: `src/components/landing/DemoVideo.tsx`, `public/images/website-vid.mp4`

### Smart Form States
| User State | Display |
|------------|---------|
| Not logged in | Email + domain form + T&Cs |
| Free/Starter/Pro | "View Your Report" button |
| Agency | "Scan New Domain" form |

### Terms Consent
- Checkbox required before submit
- Stored in `leads.terms_accepted_at`

---

## Background Jobs (Inngest)

### Key Files
- `src/inngest/client.ts` - Client singleton
- `src/inngest/functions/process-scan.ts` - Main scan (8 steps)
- `src/inngest/functions/hourly-scan-dispatcher.ts` - Weekly CRON

### Parallel Processing Architecture
```
process-scan (10m timeout):
  setup → crawl → analyze → research-queries → save-prompts
    ↓
  ┌─ query-platform-chatgpt ─┐
  ├─ query-platform-claude   ├─ PARALLEL
  ├─ query-platform-gemini   │
  └─ query-platform-perplexity┘
    ↓
  finalize-report → invoke-enrichment → send-email
         │
         ↓ (step.invoke)
  enrich-subscriber (15m timeout):
    brand-awareness (parallel) → competitive-summary
      → generate-action-plan → generate-prd → finalize
```

### Weekly CRON
- `hourly-scan-dispatcher` runs every hour
- Checks subscriber schedules by local time
- Dispatches `scan/process` events

### Local Dev
```bash
npm run dev          # Terminal 1: Next.js
npm run dev:inngest  # Terminal 2: Inngest
```
Dashboard: http://localhost:8288

---

## Editable Questions (Subscribers)

Subscribers customize scan questions via Setup tab.

### Flow
1. Initial scan: AI questions copied to `subscriber_questions`
2. Subscriber edits in SetupTab
3. Weekly scans use `subscriber_questions`

### Data Source
- Free users: `scan_prompts` (read-only)
- Subscribers: `subscriber_questions` (editable)

### Key Files
- `src/app/api/questions/route.ts`
- `src/components/report/tabs/SetupTab.tsx`

---

## AI-Powered Action Plans (Subscribers)

### Generation
1. Auto-generated during enrichment
2. Uses Claude with extended thinking
3. Web search for current SEO/GEO practices
4. Page-level recommendations

### Content
- Executive Summary
- Priority Actions (10-15) with implementation steps
- Source Insights linking to scan data
- Page Edits (copy-paste ready)
- Keyword Map
- Key Takeaways

### Content Guidelines
- No unsubstantiated superlatives
- No keyword stuffing
- Professional URL patterns
- Focus on E-E-A-T

### Completed Action Tracking
- Checkbox marks complete → saved to `action_items_history`
- Progress preserved across rescans
- Untick reverts to pending

### Key Files
- `src/lib/ai/generate-actions.ts`
- `src/inngest/functions/enrich-subscriber.ts`
- `src/components/report/tabs/ActionsTab.tsx`

---

## PRD Generation (Pro/Agency)

Claude Code / Cursor-ready PRD documents.

### Generation
1. Auto-generated after action plans
2. Extended thinking for technical detail
3. Content/code separation for tasks needing content first

### Content/Code Separation
Tasks with `requiresContent: true` include `contentPrompts`:
```typescript
interface ContentPrompt {
  type: string       // "FAQ Answer", "Case Study"
  prompt: string     // Writing prompt
  usedIn: string     // Target file/component
  wordCount: number
}
```

### Standard Tasks (Service Businesses)
1. FAQ Schema (with content prompts)
2. LocalBusiness Schema

### History Filtering
Completed tasks archived to `prd_tasks_history`, not regenerated.

### Key Files
- `src/lib/ai/generate-prd.ts`
- `src/app/api/prd/route.ts`
- `src/components/report/tabs/PrdTab.tsx`

---

## Multi-Domain Subscriptions

All subscribers can monitor multiple domains.

### Data Model
```
leads (user account)
  └─→ domain_subscriptions (one per domain)
        ├── scan_runs, reports
        ├── subscriber_questions
        ├── action_plans
        └── prd_documents
```

### Critical: Domain Isolation
**NEVER use `lead.domain`** for multi-domain features.

**Domain Resolution Priority:**
1. `domain_subscriptions.domain`
2. `scan_runs.domain`
3. `lead.domain` (legacy fallback only)

### Key Files
- `src/lib/subscriptions.ts`
- `src/app/api/subscriptions/route.ts`

---

## A/B Testing

Config-file based with GA4 tracking.

### How It Works
1. Middleware assigns variant via cookie
2. Config defines experiments/weights
3. ExperimentTracker sends to GA4

### Key Files
- `src/lib/experiments/config.ts`
- `src/middleware.ts` (in `addExperimentCookies`)
- `src/components/experiments/ExperimentTracker.tsx`

### Usage
```typescript
const variant = cookies().get(experiments.homepage.cookieName)?.value || 'control'
switch (variant) {
  case 'variant-b': return <HomePageNew />
  default: return <HomePageControl />
}
```

---

## User Feedback System

Help icon (?) opens dropdown for bug reports/feedback.

### Flow
1. User clicks help → dropdown
2. Modal with type selection
3. Saved to `feedback` table + email alert

### Key Files
- `src/components/feedback/HelpMenu.tsx`
- `src/components/feedback/FeedbackModal.tsx`
- `src/app/api/feedback/route.ts`
