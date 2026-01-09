# CLAUDE.md - outrankllm.io

## Overview

SaaS platform for Generative Engine Optimization (GEO) - helping businesses improve visibility in AI assistants (ChatGPT, Claude, Gemini).

## Tech Stack

Next.js 14+ (App Router) | Tailwind CSS v4 | Supabase | Vercel | Resend | Vercel AI SDK | Stripe

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
4. **AI Responses** - LLM query responses (sticky upsell)
5. **Measurements** - Visibility score breakdown (sticky upsell)
6. **Competitors** - Detected competitors (Pro+)
7. **Brand Awareness** - Direct brand recognition (Pro+)
8. **Actions** - Action plans (Agency)
9. **PRD** - PRD generation (Agency)

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

## API Routes

### Scan & Processing
- `POST /api/scan` - Initiate scan (enforces free report limit)
- `POST /api/process` - Process scan (crawl, analyze, query LLMs)
- `GET /api/scan/status` - Poll progress
- `GET /api/verify` - Email verification (magic link)

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

## Key Files

- `src/app/globals.css` - CSS variables (colors, fonts)
- `src/lib/ai/search-providers.ts` - LLM queries + scoring
- `src/lib/auth.ts` - Server auth helpers
- `src/lib/auth-client.ts` - Client auth hook
- `src/lib/stripe.ts` - Stripe client
- `src/lib/features/flags.ts` - Feature flags by tier
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
```

## Report Component Structure

```
src/components/report/
├── ReportTabs.tsx           # Tab navigation
├── ExpiryCountdown.tsx      # Free user countdown timer
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

## Design Notes

- Green (#22c55e) = primary accent
- Gold (#d4a574) = premium/subscriber features
- Monospace font for labels, buttons, technical elements
- Ghost mascot on landing page only
