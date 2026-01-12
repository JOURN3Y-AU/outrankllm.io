# Multi-Domain Subscriptions Implementation Plan

## Overview

Enable users to subscribe to monitor multiple domains, each with its own subscription (Starter or Pro tier). Each subscription has its own weekly scan schedule and report history.

## Data Model Changes

### New Table: `domain_subscriptions`

Replaces the current `subscriptions` table. Each row = one domain being monitored.

```sql
CREATE TABLE domain_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro')),

  -- Stripe
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Weekly scan schedule (moved from leads)
  scan_schedule_day INTEGER DEFAULT 1 CHECK (scan_schedule_day >= 0 AND scan_schedule_day <= 6),
  scan_schedule_hour INTEGER DEFAULT 9 CHECK (scan_schedule_hour >= 0 AND scan_schedule_hour <= 23),
  scan_timezone TEXT DEFAULT 'Australia/Sydney',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One domain per lead (for now - can relax for Agency later)
  UNIQUE(lead_id, domain)
);

CREATE INDEX idx_domain_subscriptions_lead ON domain_subscriptions(lead_id);
CREATE INDEX idx_domain_subscriptions_stripe ON domain_subscriptions(stripe_subscription_id);
CREATE INDEX idx_domain_subscriptions_status ON domain_subscriptions(status);
```

### Modify `leads` table

Remove domain-specific fields (they move to domain_subscriptions):

```sql
-- These columns become deprecated (can drop later):
-- leads.domain
-- leads.tier
-- leads.scan_schedule_day
-- leads.scan_schedule_hour
-- leads.scan_timezone

-- Add computed tier helper (or compute in application)
-- The "account tier" = highest tier among active subscriptions, or 'free'
```

### Modify `scan_runs` table

Add link to domain_subscription:

```sql
ALTER TABLE scan_runs
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE SET NULL;

-- Keep lead_id for free scans (no subscription)
-- For subscriber scans, both lead_id AND domain_subscription_id are set
```

### Tables that need domain_subscription_id added

These currently use `lead_id` but should link to specific subscription:

- `scan_runs` - the root of all scan data
- `score_history` - links via run_id, so OK
- `action_plans` - links via run_id, so OK
- `subscriber_questions` - needs `domain_subscription_id` (questions are per-domain)
- `prd_documents` - links via run_id, so OK

## Migration SQL

```sql
-- 030_domain_subscriptions.sql

-- 1. Create new table
CREATE TABLE domain_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro')),
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  scan_schedule_day INTEGER DEFAULT 1,
  scan_schedule_hour INTEGER DEFAULT 9,
  scan_timezone TEXT DEFAULT 'Australia/Sydney',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lead_id, domain)
);

CREATE INDEX idx_domain_subscriptions_lead ON domain_subscriptions(lead_id);
CREATE INDEX idx_domain_subscriptions_stripe ON domain_subscriptions(stripe_subscription_id);
CREATE INDEX idx_domain_subscriptions_status ON domain_subscriptions(status) WHERE status = 'active';

-- 2. Add domain_subscription_id to scan_runs
ALTER TABLE scan_runs
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE SET NULL;

-- 3. Add domain_subscription_id to subscriber_questions
ALTER TABLE subscriber_questions
ADD COLUMN domain_subscription_id UUID REFERENCES domain_subscriptions(id) ON DELETE CASCADE;

-- 4. Migrate existing subscriptions (if any exist)
-- This creates domain_subscriptions from the old subscriptions + leads tables
INSERT INTO domain_subscriptions (
  lead_id, domain, tier, stripe_subscription_id, stripe_price_id,
  status, current_period_start, current_period_end, cancel_at_period_end,
  scan_schedule_day, scan_schedule_hour, scan_timezone, created_at
)
SELECT
  l.id as lead_id,
  l.domain,
  COALESCE(s.tier, l.tier) as tier,
  s.stripe_subscription_id,
  s.stripe_price_id,
  COALESCE(s.status, 'active') as status,
  s.current_period_start,
  s.current_period_end,
  COALESCE(s.cancel_at_period_end, false),
  COALESCE(l.scan_schedule_day, 1),
  COALESCE(l.scan_schedule_hour, 9),
  COALESCE(l.scan_timezone, 'Australia/Sydney'),
  COALESCE(s.created_at, NOW())
FROM leads l
LEFT JOIN subscriptions s ON s.lead_id = l.id
WHERE l.tier IN ('starter', 'pro', 'agency')
  AND l.domain IS NOT NULL;

-- 5. Update scan_runs to link to new domain_subscriptions
UPDATE scan_runs sr
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
WHERE sr.lead_id = ds.lead_id;

-- 6. Update subscriber_questions to link to new domain_subscriptions
UPDATE subscriber_questions sq
SET domain_subscription_id = ds.id
FROM domain_subscriptions ds
WHERE sq.lead_id = ds.lead_id;
```

## API Changes

### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/subscriptions` | GET | List all domain subscriptions for current user |
| `/api/subscriptions` | POST | Create new domain subscription (initiates Stripe checkout) |
| `/api/subscriptions/[id]` | GET | Get single subscription details + report history |
| `/api/subscriptions/[id]` | PATCH | Update subscription (schedule settings) |
| `/api/subscriptions/[id]/upgrade` | POST | Upgrade to Pro |
| `/api/subscriptions/[id]/downgrade` | POST | Downgrade to Starter |
| `/api/subscriptions/[id]/cancel` | POST | Cancel this domain subscription |
| `/api/account/cancel` | POST | Cancel entire account (all subscriptions) |

### Modified Endpoints

| Endpoint | Changes |
|----------|---------|
| `/api/stripe/checkout` | Accept `domain` param, create domain_subscription on success |
| `/api/stripe/webhook` | Handle subscription events, update domain_subscriptions |
| `/api/scan` | Accept `domain_subscription_id`, link scan_run |
| `/api/user/schedule` | Deprecate or redirect to `/api/subscriptions/[id]` |
| `/api/user/report` | Return reports grouped by domain_subscription |

## Stripe Integration

### Checkout Flow (Add Domain)

1. User enters domain on dashboard
2. `POST /api/subscriptions` with `{ domain, tier }`
3. Create Stripe Checkout Session with:
   - `metadata.domain_subscription_id` (pre-create row with status 'incomplete')
   - `metadata.domain`
   - `metadata.lead_id`
4. On `checkout.session.completed` webhook:
   - Update domain_subscription status to 'active'
   - Set stripe_subscription_id

### Upgrade/Downgrade Flow

1. User clicks "Upgrade to Pro" on domain card
2. `POST /api/subscriptions/[id]/upgrade`
3. Call `stripe.subscriptions.update()` with new price_id
4. Stripe prorates automatically
5. On `customer.subscription.updated` webhook:
   - Update domain_subscription.tier and stripe_price_id

### Cancel Domain Flow

1. User clicks "Cancel" on domain card
2. `POST /api/subscriptions/[id]/cancel`
3. Call `stripe.subscriptions.update({ cancel_at_period_end: true })`
4. On `customer.subscription.updated` webhook:
   - Update domain_subscription.cancel_at_period_end = true
5. On `customer.subscription.deleted` webhook:
   - Update domain_subscription.status = 'canceled'

## UI Changes

### Dashboard Page (`/dashboard`)

**Layout: Master-Detail with Inline Expansion**

Users typically have 1-3 domains max. Use a master-detail layout where clicking a domain card shows its details below.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard                                          [Manage Billing] │
│ kevin.morrell@journey.com.au                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│ DOMAIN CARDS (compact, selectable)                                  │
│ ┌─────────────────────────┐  ┌─────────────────────────┐           │
│ │ isonic.com.au    [PRO]  │  │ domain2.com.au [STARTER]│           │
│ │ ● Selected              │  │                         │           │
│ └─────────────────────────┘  └─────────────────────────┘           │
│                                                                     │
│ ┌─ [+ Monitor Another Domain] ─────────────────────────────────────┐│
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│ SELECTED DOMAIN DETAILS (inline expansion)                          │
│                                                                     │
│ ┌─ Latest Report ──────────────────────────────────────────────────┐│
│ │ Visibility Score: 45%        [View Full Report →]                ││
│ │ GPT 3/7 | Perp 2/7 | Gem 4/7 | Claude 1/7                       ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Weekly Scan Schedule ───────────────────────────────────────────┐│
│ │ [Monday ▼]  [9:00 AM ▼]  [Sydney (AEDT) ▼]     [Save Changes]   ││
│ │ Next scan: Monday, Jan 19 at 9:00 AM                             ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Report History ─────────────────────────────────────────────────┐│
│ │ ✓ Jan 12, 2026  Score: 45%  GPT 3/7  Perp 2/7  [View →]         ││
│ │   Jan 5, 2026   Score: 42%  GPT 2/7  Perp 2/7  [View →]         ││
│ │   Dec 29, 2025  Score: 38%  GPT 2/7  Perp 1/7  [View →]         ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
│ ┌─ Subscription ───────────────────────────────────────────────────┐│
│ │ Pro Plan • Renews Jan 19, 2026                                   ││
│ │ [Downgrade to Starter]              [Cancel Domain Subscription] ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Add Domain Modal:**

Opens when user clicks "Monitor Another Domain". Simple flow: enter domain → select tier → checkout.

```
┌─────────────────────────────────────────────────────────────────┐
│ Monitor a New Domain                                        [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Domain                                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ example.com.au                                              │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Select Plan                                                     │
│ ┌─────────────────────┐  ┌─────────────────────┐               │
│ │ ○ Starter           │  │ ● Pro (Recommended) │               │
│ │ $24.99/mo           │  │ $39.99/mo           │               │
│ │ Weekly scans        │  │ Action plans        │               │
│ │ Action plans        │  │ + Competitors       │               │
│ │                     │  │ + Brand Awareness   │               │
│ └─────────────────────┘  └─────────────────────┘               │
│                                                                 │
│              [Continue to Checkout →]                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### New Components Needed

1. `DomainCard.tsx` - Compact selectable card for each domain
2. `DomainDetails.tsx` - Inline detail view (schedule, reports, subscription)
3. `AddDomainModal.tsx` - Domain input + tier selection → checkout
4. `SubscriptionActions.tsx` - Upgrade/Downgrade/Cancel buttons with confirmation
5. `ReportHistory.tsx` - List of past scans with scores

## Inngest Changes

### `hourly-scan-dispatcher`

Currently queries `leads` for schedule. Change to query `domain_subscriptions`:

```typescript
// Before
const { data: subscribers } = await supabase
  .from('leads')
  .select('id, domain, scan_schedule_day, ...')
  .in('tier', ['starter', 'pro', 'agency'])

// After
const { data: subscriptions } = await supabase
  .from('domain_subscriptions')
  .select('id, lead_id, domain, scan_schedule_day, ...')
  .eq('status', 'active')
```

### `process-scan`

Add `domain_subscription_id` to event payload and store on scan_run:

```typescript
// Event payload
interface ScanProcessEvent {
  lead_id: string
  domain: string
  domain_subscription_id?: string  // NEW - for subscriber scans
  run_id: string
}
```

## Session & Auth Changes

### Current Session Shape
```typescript
interface Session {
  lead_id: string
  email: string
  tier: 'free' | 'starter' | 'pro' | 'agency'
}
```

### New Session Shape
```typescript
interface Session {
  lead_id: string
  email: string
  // tier removed - compute from subscriptions when needed
}
```

Or keep `tier` as "highest active tier" for quick feature flag checks.

### Feature Flags

Currently check `session.tier`. Options:
1. Keep computing "account tier" = max(subscription tiers)
2. Check features per-subscription where relevant

Recommendation: Compute account tier for simplicity. A user with one Pro subscription gets Pro-level features across the UI.

## Implementation Order

### Phase 1: Database & Types (Day 1)
- [ ] Create migration `030_domain_subscriptions.sql`
- [ ] Run migration locally
- [ ] Add TypeScript types for `DomainSubscription`
- [ ] Create `src/lib/subscriptions.ts` with CRUD helpers

### Phase 2: API Endpoints (Day 2)
- [ ] `GET /api/subscriptions` - List user's subscriptions
- [ ] `GET /api/subscriptions/[id]` - Single subscription + reports
- [ ] `PATCH /api/subscriptions/[id]` - Update schedule
- [ ] Update Stripe webhook to handle domain_subscriptions

### Phase 3: Dashboard UI (Day 3)
- [ ] Create `DomainCard` component
- [ ] Update dashboard page to show multiple domain cards
- [ ] Add "Monitor Another Domain" button
- [ ] Per-card actions: View Report, Schedule dropdown

### Phase 4: Checkout Flow (Day 4)
- [ ] Update `/api/stripe/checkout` to create domain_subscription
- [ ] Create `AddDomainForm` component
- [ ] Update success page for multi-domain context
- [ ] Handle `checkout.session.completed` webhook

### Phase 5: Upgrade/Downgrade/Cancel (Day 5)
- [ ] `POST /api/subscriptions/[id]/upgrade`
- [ ] `POST /api/subscriptions/[id]/downgrade`
- [ ] `POST /api/subscriptions/[id]/cancel`
- [ ] Create confirmation modals
- [ ] Handle Stripe webhooks for changes

### Phase 6: Inngest & Scanning (Day 6)
- [ ] Update `hourly-scan-dispatcher` to query domain_subscriptions
- [ ] Update `process-scan` to store domain_subscription_id
- [ ] Test weekly scan flow

### Phase 7: Cleanup & Testing (Day 7)
- [ ] Deprecate old `subscriptions` table references
- [ ] Update any remaining `leads.domain` references
- [ ] End-to-end testing of all flows
- [ ] Update CLAUDE.md documentation

## Questions Resolved

| Question | Decision |
|----------|----------|
| Agency tier | Park - don't break extensibility |
| Domain limit | 1 per subscription |
| Mixed tiers | Yes (Domain1=Starter, Domain2=Pro) |
| Cancel scope | Both: single domain + entire account |
| Weekly schedule | Per-subscription |
| Report history | Per-subscription |
| Billing history | Use Stripe Portal |

## Future Considerations (Not in Scope)

- Agency tier with unlimited domains
- "Additional domain" product at discounted price
- Domain transfer between accounts
- Team/organization features
