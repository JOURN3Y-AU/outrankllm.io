import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import { MAX_SCANS_PER_SLOT, DEFAULT_SCAN_TIMEZONE } from "@/lib/scan-slots"
import { getLocalTime } from "@/lib/local-time"

/** Gap between scans dispatched in the same slot. */
const STAGGER_SECONDS = 300

/** Dispatching stays inside the hour so runs never overlap the next cron tick. */
const DISPATCH_WINDOW_SECONDS = 55 * 60

interface DomainSubscriptionSchedule {
  id: string
  lead_id: string
  domain: string
  scan_schedule_day: number | null
  scan_schedule_hour: number | null
  scan_timezone: string | null
  leads: {
    email: string
  } | null
}

/**
 * Hourly Scan Dispatcher
 *
 * Runs every hour and dispatches scan/process events for domain subscriptions
 * whose local time matches their configured schedule.
 *
 * This approach allows users in different timezones to have their
 * weekly scans run at their preferred local time.
 *
 * Now queries domain_subscriptions table instead of leads, to support
 * multiple domains per user with independent schedules.
 */
export const hourlyScanDispatcher = inngest.createFunction(
  {
    id: "hourly-scan-dispatcher",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour on the hour
  async ({ step }) => {
    const now = new Date()

    // Find all active domain subscriptions whose local time matches their schedule
    const subscriptionsToScan = await step.run("find-due-subscriptions", async () => {
      const supabase = createServiceClient()

      // Query active domain subscriptions with their lead's email
      const { data: subscriptions, error } = await supabase
        .from("domain_subscriptions")
        .select(`
          id,
          lead_id,
          domain,
          scan_schedule_day,
          scan_schedule_hour,
          scan_timezone,
          leads (
            email
          )
        `)
        .eq("status", "active")

      if (error) {
        console.error("Error fetching domain subscriptions:", error)
        return []
      }

      if (!subscriptions || subscriptions.length === 0) {
        return []
      }

      // Filter to those whose local time matches their schedule
      return subscriptions.filter((sub: DomainSubscriptionSchedule) => {
        // Use defaults if not set
        const scheduleDay = sub.scan_schedule_day ?? 1 // Default: Monday
        const scheduleHour = sub.scan_schedule_hour ?? 9 // Default: 9am
        const timezone = sub.scan_timezone ?? DEFAULT_SCAN_TIMEZONE

        const localTime = getLocalTime(now, timezone)
        return localTime.day === scheduleDay && localTime.hour === scheduleHour
      })
    })

    if (subscriptionsToScan.length === 0) {
      return { queued: 0, message: "No scans due this hour" }
    }

    // Dispatch order is deterministic so a retry of this run re-sends the same
    // events in the same order against the same step ids.
    const due = [...subscriptionsToScan].sort((a, b) =>
      (a as DomainSubscriptionSchedule).domain.localeCompare((b as DomainSubscriptionSchedule).domain)
    ) as DomainSubscriptionSchedule[]

    // Every scan due in the same hour shares one slot, and the slot is what has
    // to fit through process-scan's step-concurrency gate. Each scan holds four
    // long query-platform steps against a 12-step limit, so three scans running
    // at once saturate it. Anything past that queues, and a queued run burns its
    // 20-minute timeouts.finish waiting.
    //
    // That is what happened every Sunday from 2026-08-30: ten domains defaulted
    // to Monday 09:00 Sydney, landed in one slot 30 seconds apart, and all but
    // the last-dispatched one was cancelled mid-query at 35% progress.
    //
    // Spacing them keeps the gate clear without touching the limit. A scan takes
    // about three minutes, plus roughly eight more for enrichment, so five
    // minutes apart means a slot holds at most one scan in flight at a time.
    if (due.length > MAX_SCANS_PER_SLOT) {
      console.error(
        `[hourly-scan-dispatcher] Slot over capacity: ${due.length} scans due this hour ` +
          `(limit ${MAX_SCANS_PER_SLOT}). Spacing compressed to fit the hour, which risks ` +
          `queueing on the process-scan concurrency gate. Spread these across slots: ` +
          due.map((s) => s.domain).join(", ")
      )
    }

    // Always finish dispatching inside the hour, so this run cannot overlap the
    // next cron tick no matter how many scans are due.
    const spacingSeconds =
      due.length > 1
        ? Math.min(STAGGER_SECONDS, Math.floor(DISPATCH_WINDOW_SECONDS / (due.length - 1)))
        : 0

    // Send events individually with step.sendEvent for better observability.
    for (let i = 0; i < due.length; i++) {
      const sub = due[i]

      if (i > 0 && spacingSeconds > 0) {
        await step.sleep(`stagger-${i}`, `${spacingSeconds}s`)
      }

      await step.sendEvent(`queue-scan-${sub.domain}`, {
        name: "scan/process",
        data: {
          scanId: null,
          domain: sub.domain,
          email: sub.leads?.email || "",
          leadId: sub.lead_id,
          domainSubscriptionId: sub.id,
          skipEmail: false,
          // The Monday digest tells the client, not this scan. That is what
          // lets a slot sit anywhere in the week.
          notify: "weekly_digest",
        },
      })
    }

    return {
      queued: due.length,
      spacingSeconds,
      overCapacity: due.length > MAX_SCANS_PER_SLOT,
      subscriptions: due.map((s: DomainSubscriptionSchedule) => ({
        domain: s.domain,
        email: s.leads?.email,
      })),
    }
  }
)
