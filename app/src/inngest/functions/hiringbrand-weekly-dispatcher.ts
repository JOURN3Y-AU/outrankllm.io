import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * HiringBrand Weekly Scan Dispatcher
 *
 * Refreshes each primary monitored domain about once a week, ONE AT A TIME.
 *
 * It used to run daily at 06:00 UTC and send every due domain in a single
 * `inngest.send(array)`. On 2026-10-11 that fired five scans within the same
 * second: four finished in 12-18 minutes instead of their usual few, and
 * therecruitmentcompany.ie was cancelled against its 30m `timeouts.finish`.
 *
 * The cost is account-wide, not per product. The Inngest plan caps concurrency
 * at 5 and process-scan shares that budget, so an HB pile-up starves outrankllm
 * too — on 2026-10-11 an outrankllm slot ran at 06:01:01 and the HB flood
 * landed at 06:01:06, five seconds from taking it out.
 *
 * Rather than give HB fixed (day, hour) slots like outrankllm's scan-slots, this
 * drains a queue: every hour, dispatch at most one domain, the most overdue.
 * HB sends no email when a scan completes, so no client cares which hour it
 * runs in, and that frees the design from storing a schedule at all. Three
 * things fall out of it:
 *
 *   - One scan at a time, so HB can never saturate the shared budget.
 *   - A failed scan stays overdue and is retried the next hour, where fixed
 *     weekly slots would have made it wait another week.
 *   - Domains self-spread. Each one re-qualifies seven days after its own
 *     completion, so they stay an hour or so apart once drained.
 *
 * Sunday UTC is skipped. outrankllm's thirteen weekly slots sit between 06:00
 * and 22:00 UTC that day, and they shift an hour with Sydney DST, so the whole
 * day is reserved rather than tracked.
 */

/** A domain is due this long after its last COMPLETE scan. */
const REFRESH_INTERVAL_DAYS = 7

/**
 * Hours a week available to drain the queue: every hour except Sunday UTC.
 * One domain per hour means this is also the ceiling on how many HB domains
 * can be kept on a weekly cadence.
 */
const DRAIN_HOURS_PER_WEEK = 6 * 24

interface DueDomain {
  monitoredDomainId: string
  domain: string
  organizationId: string
  lastCompletedAt: string | null
}

export const hiringBrandWeeklyDispatcher = inngest.createFunction(
  {
    id: 'hiringbrand-weekly-scan-dispatcher',
    retries: 2,
  },
  { cron: '0 * * * *' },
  async ({ step }) => {
    // Sunday UTC belongs to outrankllm's weekly batch; see the note above.
    if (new Date().getUTCDay() === 0) {
      return { queued: 0, message: 'Sunday UTC is reserved for the outrankllm batch' }
    }

    const next = await step.run('find-next-due-brand', async () => {
      const supabase = createServiceClient()

      const { data: domains, error } = await supabase
        .from('monitored_domains')
        .select('id, domain, organization_id, schedule_paused, organizations!inner(id, status)')
        .eq('is_primary', true)

      if (error || !domains) {
        console.error('HB dispatcher: error fetching domains:', error)
        return { due: [] as DueDomain[], picked: null as DueDomain | null }
      }

      const activeDomains = domains.filter((d: Record<string, unknown>) => {
        const org = d.organizations as { id: string; status: string } | null
        return org?.status === 'active' && !d.schedule_paused
      })

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - REFRESH_INTERVAL_DAYS)

      const due: DueDomain[] = []

      for (const d of activeDomains) {
        const monitoredDomainId = d.id as string

        // A scan already running makes this domain ineligible, however overdue
        // it looks. The staleness check reads the last COMPLETE scan, so an
        // in-flight one still reads as due — and cancelOn matches
        // data.monitoredDomainId, so re-dispatching would cancel the running
        // scan and the domain would never finish one. Hourly dispatch is what
        // makes this reachable; at daily it never came up.
        const { data: inFlight } = await supabase
          .from('scan_runs')
          .select('id')
          .eq('monitored_domain_id', monitoredDomainId)
          .eq('brand', 'hiringbrand')
          .not('status', 'in', '("complete","failed")')
          .limit(1)
          .maybeSingle()

        if (inFlight) continue

        const { data: lastScan } = await supabase
          .from('scan_runs')
          .select('completed_at')
          .eq('monitored_domain_id', monitoredDomainId)
          .eq('brand', 'hiringbrand')
          .eq('status', 'complete')
          .order('completed_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const lastCompletedAt = lastScan?.completed_at ?? null

        if (!lastCompletedAt || new Date(lastCompletedAt) < cutoff) {
          due.push({
            monitoredDomainId,
            domain: d.domain as string,
            organizationId: d.organization_id as string,
            lastCompletedAt,
          })
        }
      }

      // Most overdue first; a domain that has never completed a scan goes first.
      due.sort((a, b) => {
        if (a.lastCompletedAt === b.lastCompletedAt) return a.domain.localeCompare(b.domain)
        if (!a.lastCompletedAt) return -1
        if (!b.lastCompletedAt) return 1
        return a.lastCompletedAt < b.lastCompletedAt ? -1 : 1
      })

      return { due, picked: due[0] ?? null }
    })

    if (!next.picked) {
      return { queued: 0, message: 'No HiringBrand scans due this hour' }
    }

    // A backlog longer than the week can drain means domains silently slip past
    // their weekly cadence. Raising the cadence needs more drain hours or more
    // concurrency, and concurrency is a plan change.
    if (next.due.length > DRAIN_HOURS_PER_WEEK) {
      console.error(
        `[hb-dispatcher] ${next.due.length} domains due but only ${DRAIN_HOURS_PER_WEEK} ` +
          `drain hours a week. Some will miss their weekly refresh.`
      )
    }

    const picked = next.picked

    await step.sendEvent(`queue-hb-scan-${picked.monitoredDomainId}`, {
      name: 'hiringbrand/scan',
      data: {
        domain: picked.domain,
        organizationId: picked.organizationId,
        monitoredDomainId: picked.monitoredDomainId,
      },
    })

    return {
      queued: 1,
      domain: picked.domain,
      lastCompletedAt: picked.lastCompletedAt,
      stillDue: next.due.length - 1,
    }
  }
)
