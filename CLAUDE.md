# CLAUDE.md - outrankllm.io

## Overview

SaaS platform for Generative Engine Optimization (GEO) - helping businesses improve visibility in AI assistants (ChatGPT, Claude, Gemini).

## Tech Stack

Next.js 14+ (App Router) | Tailwind CSS v4 | Supabase | Vercel | Resend | Vercel AI SDK

## Critical: Tailwind CSS v4 Quirk

**Arbitrary value classes don't compile.** Always use inline styles:

```tsx
// ❌ DON'T
<div className="max-w-xl mx-auto gap-4">

// ✅ DO
<div style={{ maxWidth: '576px', marginLeft: 'auto', marginRight: 'auto', gap: '16px' }}>
```

Affects: `max-w-*`, `mx-auto`, `gap-*`, `p-*` with custom values.

## Report Tabs

1. **Start Here** - Persona selection + tailored guide
2. **Setup** - Business identity, services, questions
3. **AI Readiness** - Technical SEO/GEO indicators (sticky upsell)
4. **AI Responses** - LLM query responses (sticky upsell)
5. **Measurements** - Visibility score breakdown (sticky upsell)
6. **Competitors** - Detected competitors (teased/locked)
7. **Brand Awareness** - Direct brand recognition (premium, locked)
8. **Actions** - Action plans (locked)
9. **PRD** - PRD generation (locked)

## Scoring System

Reach-weighted scoring based on AI traffic share:

| Platform   | Weight |
|------------|--------|
| ChatGPT    | 10     |
| Perplexity | 4      |
| Gemini     | 2      |
| Claude     | 1      |

Formula: `(chatgpt% × 10 + perplexity% × 4 + gemini% × 2 + claude% × 1) / 17 × 100`

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

## API Routes

- `POST /api/scan` - Initiate scan
- `POST /api/process` - Process scan (crawl, analyze, query LLMs)
- `GET /api/scan/status` - Poll progress
- `GET /api/verify` - Email verification (magic link)
- `POST /api/waitlist` - Coming soon signup

## Key Files

- `src/app/globals.css` - CSS variables (colors, fonts)
- `src/lib/ai/search-providers.ts` - LLM queries + scoring
- `supabase/migrations/` - Database schema
- `.env.example` - Required env vars

## Report Component Structure

```
src/components/report/
├── ReportTabs.tsx           # Tab navigation (207 lines)
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
    ├── MeasurementsTab.tsx  # Score gauges
    ├── CompetitorsTab.tsx   # Competitor analysis
    ├── BrandAwarenessTab.tsx # Brand recognition
    └── LockedTab.tsx        # Generic locked state
```

Each tab is 200-600 lines. Import from `./shared` for types/constants/utils.

## Design Notes

- Green (#22c55e) = primary accent
- Gold (#d4a574) = premium/subscriber features
- Monospace font for labels, buttons, technical elements
- Ghost mascot on landing page only