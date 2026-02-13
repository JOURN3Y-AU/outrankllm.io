# Bug Fix History & Migration Notes

Reference documentation for past bug fixes and important migrations. Read this file when debugging similar issues.

---

## 2025-01-12: Multi-Domain Data Isolation Fix

### Problem
When subscribers added a second domain (e.g., j4rvis.com after mantel.com.au):
1. First domain's report "disappeared" from dashboard
2. Second domain got brand awareness but NO action plans or PRDs
3. Data from first domain contaminated second domain

### Root Cause
System assumed single domain per user via `leads.domain` field. The Stripe webhook was linking ALL scans to any new domain subscription, and enrichment was using `lead.domain` instead of the actual domain being enriched.

### Fix (Migration 032 + code changes)

| Component | Issue | Fix |
|-----------|-------|-----|
| `scan_runs` table | No domain column | Added `domain` TEXT column |
| Stripe webhook | Linked ALL scans to new subscription | Filter by `.eq('domain', domain)` |
| `enrich-subscriber.ts` | Used `lead.domain` | Resolve from subscription → scan_run → lead |
| `process-scan.ts` | Didn't store domain | Store `domain` on insert/update |
| `/api/scan` | Free user check was per-lead | Added domain filter to queries |
| `/api/user/report` | Returned `lead.domain` | Return `scanRun.domain` |
| `/api/prd` | Used `lead.domain` for PRD | Resolve domain like enrichment |

### Migration 032 Data Repair
- Backfills `domain` from `domain_subscriptions` or `leads`
- Unlinks scans from wrong `domain_subscription_id`
- Re-links scans to correct subscription by matching domain

### Files Modified
- `src/app/api/stripe/webhook/route.ts`
- `src/inngest/functions/enrich-subscriber.ts`
- `src/inngest/functions/process-scan.ts`
- `src/app/api/scan/route.ts`
- `src/app/api/user/report/route.ts`
- `src/app/api/prd/route.ts`
- `src/app/api/admin/rescan/route.ts`

### Validation Script
`app/scripts/validate-multi-domain-fix.ts`

---

## Key Migrations Reference

| Migration | Description |
|-----------|-------------|
| 015 | PRD documents base schema |
| 021 | Subscriber questions |
| 027 | PRD content prompts (content/code separation) |
| 029 | Feedback system |
| 030 | Domain subscriptions schema |
| 031 | Add domain_subscription_id to all tables |
| 032 | Fix scan domain tracking (add domain to scan_runs) |

---

## Common Debugging Patterns

### Domain Resolution
When working with multi-domain features, always resolve domain in this order:
1. `domain_subscriptions.domain` (if `domainSubscriptionId` provided)
2. `scan_runs.domain` (added in migration 032)
3. `lead.domain` (legacy fallback only)

**Never** use `lead.domain` directly for subscriber features.

### Enrichment Issues
If enrichment data (brand awareness, action plans, PRD) is missing:
1. Check `domain_subscription_id` is set on `scan_runs`
2. Verify domain resolution in `enrich-subscriber.ts`
3. Check Inngest dashboard for step failures

### Report Access Issues
If reports aren't showing for correct user:
1. Check `scan_runs.domain` matches `domain_subscriptions.domain`
2. Verify `domain_subscription_id` linkage
3. Check `/api/user/report` is returning correct domain's scan
