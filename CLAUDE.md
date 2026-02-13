# CLAUDE.md - outrankllm.io

## Overview

SaaS platform for Generative Engine Optimization (GEO) - helping businesses improve visibility in AI assistants (ChatGPT, Claude, Gemini).

## Tech Stack

Next.js 14+ (App Router) | Tailwind CSS v4 | Supabase | Vercel | Resend | Vercel AI SDK | Stripe | Inngest

## Capabilities

### Git Operations
You can commit, push, create branches, and create PRs. Use standard git workflow for all code changes.

### Supabase MCP
The **Supabase MCP is connected** - use it for all database operations:
- `mcp__supabase__execute_sql` - Run queries, inspect data
- `mcp__supabase__apply_migration` - Apply schema changes (DDL)
- `mcp__supabase__list_tables` - See table structure
- `mcp__supabase__get_logs` - Debug issues

**Project ID**: Use `mcp__supabase__list_projects` to find it.

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

| Tier | AU (AUD) | INTL (USD) | Features |
|------|----------|------------|----------|
| Free | $0 | $0 | One report, 7-day expiry |
| Starter | A$39/mo | $24.99/mo | Full report, weekly updates, Action Plans |
| Pro | A$59/mo | $39.99/mo | + Competitors, Brand Awareness, PRD |
| Agency | A$199/mo | $139/mo | + Multiple domains |

## HiringBrand (Employer Reputation Scanner)

Separate product at `/hiringbrand` — scans how AI platforms describe employers to job seekers. Target user: VP of People / Head of Talent Acquisition.

### Three Pillar Scores (0-100)
- **Desirability** — How positively AI describes the employer (sentiment-based)
- **AI Awareness** — How much AI knows about the employer (researchability)
- **Differentiation** — How uniquely AI positions the employer vs competitors

These are shaped by **7 employer dimensions** (0-10 scale): compensation, culture, growth, balance, leadership, tech, mission. Dimensions are explored on the Competitors tab.

### Report Tabs (Narrative Arc)
The report reads as a consulting-style story, left to right:

| # | Tab | Story | Content |
|---|-----|-------|---------|
| 1 | Summary | "Here's where you stand" | 3 score rings, sentiment distribution, topic coverage, methodology |
| 2 | AI Responses | "Here's what AI actually says" | Per-platform response cards with sentiment, category filters |
| 3 | Competitors | "Here's how you compare" | Radar chart, dimension drill-downs (0-10 scale) |
| 4 | Trends | "Here's where you're heading" | Score history charts, competitive position over time |
| 5 | Action Plan | "Here's what to do about it" | Brand health, strengths/gaps, 90-day plan timeline |

No premium/free tier distinction — all tabs are available to all users.

Tab-to-tab `HBTabFooter` connectors guide users through the narrative. Summary has deep-link navigation (clicking sentiment segments, topic chips, platform cards navigates to AI Responses with pre-applied filters).

### HiringBrand Design System
Completely separate from outrankllm styling. All design tokens in `shared/constants.ts`:
- **Primary**: Teal (#4ABDAC), Deep Teal (#2D8A7C)
- **Accent**: Coral (#FC4A1A) for CTAs
- **Highlight**: Gold (#F7B733) for premium elements
- **Fonts**: Outfit (display), Source Sans 3 (body), JetBrains Mono (mono)
- **All styling is inline** (no Tailwind) — consistent with the CSS v4 quirk

### HiringBrand Key Files

| Area | Files |
|------|-------|
| Report UI | `src/app/hiringbrand/report/[token]/ReportClient.tsx` (main report, all tabs) |
| Report Page | `src/app/hiringbrand/report/[token]/page.tsx` (server component, data fetching) |
| Shared Types | `src/app/hiringbrand/report/components/shared/types.ts` |
| Design Tokens | `src/app/hiringbrand/report/components/shared/constants.ts` |
| Components | `src/app/hiringbrand/report/components/HB*.tsx` |
| Scan Processing | `src/inngest/functions/process-hiringbrand-scan.ts` |
| AI Research | `src/lib/ai/employer-research.ts`, `src/lib/ai/compare-employers.ts` |
| Strategic Summary | `src/lib/ai/generate-strategic-summary.ts` |
| Stripe | `src/lib/hiringbrand-stripe.ts`, `src/lib/hiringbrand-webhook.ts` |
| Signup/Success | `src/app/hiringbrand/signup/page.tsx`, `src/app/hiringbrand/success/page.tsx` |
| API Routes | `src/app/api/hiringbrand/` |

### HiringBrand Database Tables

| Table | Purpose |
|-------|---------|
| `hb_organizations` | Customer orgs (tier, status, Stripe refs) |
| `hb_scan_runs` | Scan execution with brand-specific columns |
| `hb_reports` | Reports with url_token, 3 pillar scores, competitor/strategic analysis |
| `hb_llm_responses` | AI responses with sentiment scores/phrases, researchability |
| `hb_prompts` | Scan questions by category |
| `hb_score_history` | Pillar + dimension scores per scan for trends |
| `hb_competitor_history` | Competitor scores per scan for competitive tracking |

### Platforms Scanned
ChatGPT (weight 10), Perplexity (weight 4), Gemini (weight 2), Claude (weight 1) — weighted by AI market share for job seekers.

---

## Key Database Tables

| Table | Purpose |
|-------|---------|
| `leads` | User accounts (email, tier, stripe_customer_id) |
| `domain_subscriptions` | Multi-domain support (one per monitored domain) |
| `scan_runs` | Scan execution (status, progress, domain) |
| `reports` | Generated reports (token for URL access) |
| `llm_responses` | AI responses per platform |
| `action_plans` / `action_items` | AI-generated action plans |
| `prd_documents` / `prd_tasks` | PRD generation (Pro/Agency) |
| `subscriber_questions` | Editable scan questions |
| `score_history` | Trend data for charts |

**Critical**: For multi-domain features, use `domain_subscriptions.domain` or `scan_runs.domain`, NOT `leads.domain` (legacy field).

## Key Files

| Area | Files |
|------|-------|
| Auth | `src/lib/auth.ts`, `src/lib/auth-client.ts` |
| Stripe | `src/lib/stripe.ts`, `src/lib/stripe-config.ts` |
| Scans | `src/inngest/functions/process-scan.ts` |
| Enrichment | `src/inngest/functions/enrich-subscriber.ts` |
| AI Generation | `src/lib/ai/generate-actions.ts`, `src/lib/ai/generate-prd.ts` |
| Scoring | `src/lib/ai/search-providers.ts` |
| Features | `src/lib/features/flags.ts` |
| Pricing | `src/lib/geo/pricing-region.ts` |

## Scoring Formula

Reach-weighted by AI traffic share:
```
(chatgpt% × 10 + perplexity% × 4 + gemini% × 2 + claude% × 1) / 17 × 100
```

## Design Notes

- **Brand**: outrankllm.io (`.io` white, `llm` green)
- **Colors**: Green (#22c55e) primary, Gold (#d4a574) premium
- **Font**: Monospace for labels, buttons, technical elements

## Reference Documentation

For detailed information, read these files as needed:

| File | Content |
|------|---------|
| [docs/CLAUDE-FEATURES.md](docs/CLAUDE-FEATURES.md) | Feature docs (Actions, PRD, Multi-domain, A/B tests) |
| [docs/CLAUDE-API.md](docs/CLAUDE-API.md) | API routes, database schemas, env vars |
| [docs/CLAUDE-HISTORY.md](docs/CLAUDE-HISTORY.md) | Bug fix history, migration notes |

## Local Development

```bash
npm run dev          # Next.js
npm run dev:inngest  # Inngest (Terminal 2)
```

Inngest dashboard: http://localhost:8288
