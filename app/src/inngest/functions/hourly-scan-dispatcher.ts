import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"

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
        const timezone = sub.scan_timezone ?? "Australia/Sydney" // Default timezone

        const localTime = getLocalTime(now, timezone)
        return localTime.day === scheduleDay && localTime.hour === scheduleHour
      })
    })

    if (subscriptionsToScan.length === 0) {
      return { queued: 0, message: "No scans due this hour" }
    }

    // Queue scans for matching subscriptions
    await step.run("queue-scans", async () => {
      await inngest.send(
        subscriptionsToScan.map((sub: DomainSubscriptionSchedule) => ({
          name: "scan/process" as const,
          data: {
            scanId: null, // Will be created in first step of process-scan
            domain: sub.domain,
            email: sub.leads?.email || "",
            leadId: sub.lead_id,
            domainSubscriptionId: sub.id, // NEW: Link to domain subscription
            skipEmail: false, // Send scan complete emails
          },
        }))
      )
    })

    return {
      queued: subscriptionsToScan.length,
      subscriptions: subscriptionsToScan.map((s: DomainSubscriptionSchedule) => ({
        domain: s.domain,
        email: s.leads?.email,
      })),
    }
  }
)

/**
 * Get local day of week and hour from a UTC date and timezone
 */
function getLocalTime(
  utcDate: Date,
  timezone: string
): { day: number; hour: number } {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "numeric",
      hour12: false,
    })

    const parts = formatter.formatToParts(utcDate)
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    }

    const dayPart = parts.find((p) => p.type === "weekday")?.value || "Mon"
    const hourPart = parts.find((p) => p.type === "hour")?.value || "9"

    return {
      day: dayMap[dayPart] ?? 1,
      hour: parseInt(hourPart, 10),
    }
  } catch {
    // If timezone is invalid, return Monday 9am
    console.error(`Invalid timezone: ${timezone}, using defaults`)
    return { day: 1, hour: 9 }
  }
}
