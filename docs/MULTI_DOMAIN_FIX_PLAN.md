# Multi-Domain Subscription Fix Plan

## Problem Summary

When a subscriber adds a second domain (e.g., j4rvis.com after mantel.com.au), the following breaks:
1. First domain's report "disappears" from dashboard
2. Second domain gets brand awareness but NO action plans or PRDs
3. Data from first domain contaminates second domain

## Root Causes

The system was designed for single-domain users with `leads.domain` as the identifier. Multi-domain support added `domain_subscription_id` but several code paths still assume single-domain.

---

## Complete Audit: All `lead.domain` Usages

I performed an exhaustive search for ALL uses of `lead.domain`. Here's the complete list:

| File | Line | Usage | Status |
|------|------|-------|--------|
| `enrich-subscriber.ts` | 132 | `domain: lead.domain` | ❌ **BUG** - Uses first domain for enrichment |
| `report/[token]/page.tsx` | 129-130 | `domainSubscription?.domain \|\| lead.domain` | ✅ OK - Has fallback logic |
| `/api/user/report/route.ts` | 45, 57 | `domain: lead.domain` | ❌ **BUG** - Always returns first domain |
| `/api/admin/rescan/route.ts` | 72, 92 | `domain \|\| lead.domain` | ⚠️ PARTIAL - Uses param if provided, else lead.domain |
| `/api/pricing/region-context/route.ts` | 88 | `domain: lead.domain` | ⚠️ OK for now - Pricing is account-level |
| `/api/trends/competitors/route.ts` | 56-61 | Fallback if no domainSubscriptionId | ✅ OK - Has proper fallback |
| `/api/prd/route.ts` | 258-262, 304 | Gets domain for siteContext | ❌ **BUG** - Uses lead.domain for PRD generation |
| `/api/stripe/verify-session/route.ts` | 64 | Gets domain from domain_subscription | ✅ OK - Already fixed |

### NEW BUG IDENTIFIED: /api/prd/route.ts (BUG 10)

**File**: `src/app/api/prd/route.ts` (lines 258-262, 304)
**Problem**: When manually regenerating a PRD, uses `lead.domain` instead of getting domain from the domain_subscription or scan
**Code**:
```typescript
// Line 258-262
const { data: lead } = await supabase
  .from('leads')
  .select('domain')
  .eq('id', session.lead_id)
  .single()

// Line 304
const siteContext: SiteContext = {
  domain: lead?.domain || 'unknown',  // ← WRONG for second domain!
  ...
}
```
**Fix**: Get domain from domain_subscription if available, or from scan_run

---

## Bugs Identified (10 Total: 7 Critical, 3 Moderate)

### BUG 1: scan_runs has no domain column (CRITICAL)
**File**: Database schema
**Problem**: Cannot tell which domain a scan belongs to without joining to leads.domain (legacy single-value field)
**Fix**: Migration 032 adds `domain` column to scan_runs

### BUG 2: Webhook links ALL scans to new subscription (CRITICAL)
**File**: `src/app/api/stripe/webhook/route.ts` (lines 191-209)
**Problem**: When user subscribes to domain B, webhook links ALL their scans (including domain A) to domain B's subscription
**Code**:
```typescript
// WRONG: Gets ALL scans for this lead
const { data: leadScans } = await supabase
  .from('scan_runs')
  .select('id')
  .eq('lead_id', leadId)  // ← Should also filter by domain!
  .eq('status', 'complete')

// Links ALL of them to new subscription
await supabase
  .from('scan_runs')
  .update({ domain_subscription_id: domainSubscriptionId })
  .in('id', scanIds)  // ← BREAKS domain A's data!
```
**Fix**: Add domain filter to only link scans matching the subscribed domain

### BUG 3: Enrichment uses leads.domain (CRITICAL)
**File**: `src/inngest/functions/enrich-subscriber.ts` (lines 70-78, 132)
**Problem**: Enrichment fetches `lead.domain` which is the FIRST domain, not the domain being enriched
**Code**:
```typescript
const { data: lead } = await supabase
  .from("leads")
  .select("domain, email")  // ← leads.domain is FIRST domain only!
  .eq("id", leadId)
  .single()

return {
  domain: lead.domain,  // ← WRONG for second domain!
  ...
}
```
**Fix**: Get domain from domain_subscriptions table using domainSubscriptionId, or from scan_runs.domain

### BUG 4: /api/scan doesn't link incomplete subscriptions (CRITICAL)
**File**: `src/app/api/scan/route.ts` (lines 168-181)
**Problem**: Only checks for `status = 'active'` subscriptions. If scan starts before checkout completes, scan is orphaned.
**Code**:
```typescript
const { data: domainSub } = await supabase
  .from('domain_subscriptions')
  .select('id')
  .eq('lead_id', lead.id)
  .eq('domain', cleanDomain)
  .eq('status', 'active')  // ← Won't find 'incomplete' subscriptions!
  .single()
```
**Fix**: Check for any non-canceled subscription status, or link after checkout

### BUG 5: /api/user/report returns wrong domain (CRITICAL)
**File**: `src/app/api/user/report/route.ts` (lines 31-59)
**Problem**: Always returns `lead.domain` (first domain) even when latest report is for different domain
**Code**:
```typescript
return NextResponse.json({
  domain: lead.domain,  // ← ALWAYS returns first domain!
  tier: lead.tier,
  reportToken: reportData?.url_token || null
})
```
**Fix**: Return domain from the scan_run that was fetched, or from its domain_subscription

### BUG 6: Free users can't scan second domain (CRITICAL)
**File**: `src/app/api/scan/route.ts` (lines 57-108)
**Problem**: Free user check is per-lead, not per-domain. Can't scan a second domain even as free.
**Code**:
```typescript
const { data: existingRun } = await supabase
  .from('scan_runs')
  .select(...)
  .eq('lead_id', existingLead.id)  // ← Finds ANY domain's scan!
  .eq('status', 'complete')

if (existingRun) {
  return "already scanned"  // ← Blocks second domain scan!
}
```
**Fix**: Add domain filter to free user check

### BUG 7: In-progress scan check is per-lead (MODERATE)
**File**: `src/app/api/scan/route.ts` (lines 43-56)
**Problem**: Checks for ANY in-progress scan, blocks second domain scan
**Fix**: Add domain filter to in-progress check

### BUG 8: Subscriber questions not copied to new domain (MODERATE)
**File**: `src/inngest/functions/process-scan.ts` (lines 338-369)
**Problem**: Second domain regenerates questions from AI instead of copying from first domain
**Fix**: Optional optimization - copy questions from existing domain_subscription

### BUG 9: Competitors may use wrong domain context (MODERATE)
**File**: `src/inngest/functions/enrich-subscriber.ts` (lines 114-129)
**Problem**: If no competitors for new domain, fallback uses report.top_competitors which may be from wrong scan
**Fix**: Ensure report lookup is scoped to correct scanRunId (currently correct, but domain context from Bug 3 affects analysis)

### BUG 10: /api/prd uses lead.domain for PRD generation (CRITICAL)
**File**: `src/app/api/prd/route.ts` (lines 258-262, 304)
**Problem**: When manually regenerating a PRD, uses `lead.domain` instead of getting domain from the scan or domain_subscription
**Code**:
```typescript
const { data: lead } = await supabase
  .from('leads')
  .select('domain')
  .eq('id', session.lead_id)
  .single()

const siteContext: SiteContext = {
  domain: lead?.domain || 'unknown',  // ← WRONG for second domain!
  ...
}
```
**Fix**: Get domain from the scan_run or domain_subscription being used for PRD generation

---

## Fix Implementation Order

### Phase 1: Database (Migration 032) ✅
- [x] Add `domain` column to `scan_runs`
- [x] Backfill from domain_subscriptions and leads
- [x] Repair incorrectly linked scans
- [x] Create composite index

### Phase 2: Webhook Fix ✅
**File**: `src/app/api/stripe/webhook/route.ts`

Changes needed in `handleDomainSubscriptionCheckout()`:
1. Get the domain from the checkout metadata
2. Only link scans where `scan_runs.domain = subscribed_domain`
3. Use new `domain` column for matching

```typescript
// AFTER FIX:
const { data: leadScans } = await supabase
  .from('scan_runs')
  .select('id')
  .eq('lead_id', leadId)
  .eq('domain', domain)  // ← ADD THIS: Only link matching domain!
  .eq('status', 'complete')
  .order('created_at', { ascending: false })
```

### Phase 3: Enrichment Fix ✅
**File**: `src/inngest/functions/enrich-subscriber.ts`

Changes needed in step 1 (setup-enrichment):
1. Get domain from domain_subscriptions table if domainSubscriptionId provided
2. Fallback to scan_runs.domain
3. Only use leads.domain as last resort

```typescript
// AFTER FIX:
let resolvedDomain: string | null = null

// Try 1: Get from domain_subscription
if (domainSubscriptionId) {
  const { data: domainSub } = await supabase
    .from("domain_subscriptions")
    .select("domain")
    .eq("id", domainSubscriptionId)
    .single()
  if (domainSub) resolvedDomain = domainSub.domain
}

// Try 2: Get from scan_run
if (!resolvedDomain) {
  const { data: scanRun } = await supabase
    .from("scan_runs")
    .select("domain")
    .eq("id", scanRunId)
    .single()
  if (scanRun) resolvedDomain = scanRun.domain
}

// Try 3: Fallback to lead.domain (legacy)
if (!resolvedDomain) {
  resolvedDomain = lead.domain
}
```

### Phase 4: process-scan.ts Fix ✅
**File**: `src/inngest/functions/process-scan.ts`

Changes needed:
1. Store domain in scan_runs when creating new scan
2. Read domain from event.data or resolve from domain_subscription

```typescript
// In setup-scan step:
const insertData: Record<string, unknown> = {
  lead_id: resolvedLeadId,
  domain: domain,  // ← ADD THIS
  status: "crawling",
  ...
}
```

### Phase 5: /api/scan Fix ✅
**File**: `src/app/api/scan/route.ts`

Changes needed:
1. Add domain filter to free user checks
2. Check for incomplete subscriptions, not just active

```typescript
// Free user check - add domain filter:
const { data: existingRun } = await supabase
  .from('scan_runs')
  .select(...)
  .eq('lead_id', existingLead.id)
  .eq('domain', cleanDomain)  // ← ADD THIS
  .eq('status', 'complete')

// Subscription check - include incomplete:
const { data: domainSub } = await supabase
  .from('domain_subscriptions')
  .select('id')
  .eq('lead_id', lead.id)
  .eq('domain', cleanDomain)
  .neq('status', 'canceled')  // ← CHANGE THIS: Allow incomplete
  .single()
```

### Phase 6: /api/user/report Fix ✅
**File**: `src/app/api/user/report/route.ts`

Changes needed:
1. Return domain from scan_run, not leads.domain

```typescript
// AFTER FIX:
const { data: scanRun } = await supabase
  .from('scan_runs')
  .select(`
    id,
    domain,  // ← ADD THIS
    reports (url_token, visibility_score, ...)
  `)
  .eq('lead_id', lead.id)
  .eq('status', 'complete')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

return NextResponse.json({
  domain: scanRun?.domain || lead.domain,  // ← USE scan domain!
  ...
})
```

---

## Testing Plan

### Test Case 1: New Second Domain Subscription
1. User has existing subscription for mantel.com.au
2. User adds new domain j4rvis.com via /api/subscriptions
3. User completes Stripe checkout
4. Verify:
   - [ ] New scan created for j4rvis.com with correct domain
   - [ ] mantel.com.au report still visible in dashboard
   - [ ] j4rvis.com report appears in dashboard
   - [ ] j4rvis.com enrichment uses j4rvis data (not mantel)
   - [ ] Action plans generated for j4rvis
   - [ ] PRD generated for j4rvis

### Test Case 2: Free User Second Domain
1. Free user has report for domain A
2. Free user tries to scan domain B
3. Verify:
   - [ ] Scan allowed for domain B
   - [ ] Domain A report unaffected
   - [ ] Domain B gets its own report

### Test Case 3: Scan Before Checkout Completes
1. User starts checkout for new domain
2. Scan initiated before checkout completes
3. Checkout completes
4. Verify:
   - [ ] Scan correctly linked to domain_subscription
   - [ ] Enrichment runs with correct domain

---

## Files to Modify

| File | Changes | Priority |
|------|---------|----------|
| `supabase/migrations/032_fix_scan_domain_tracking.sql` | Add domain column, backfill, repair | P1 |
| `src/app/api/stripe/webhook/route.ts` | Filter scan linking by domain | P1 |
| `src/inngest/functions/enrich-subscriber.ts` | Get domain from subscription, not lead | P1 |
| `src/inngest/functions/process-scan.ts` | Store domain in scan_runs | P1 |
| `src/app/api/scan/route.ts` | Add domain filters to checks | P1 |
| `src/app/api/user/report/route.ts` | Return domain from scan, not lead | P1 |
| `src/app/api/prd/route.ts` | Get domain from subscription, not lead | P2 |
| `src/app/api/admin/rescan/route.ts` | Add domain param or get from subscription | P2 |

---

## Rollback Plan

If issues arise:
1. Migration 032 is additive (adds column, doesn't remove anything)
2. Code changes can be reverted without data loss
3. Old code will work with new schema (domain column is optional)
