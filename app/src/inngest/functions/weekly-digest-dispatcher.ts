import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import { sendScanCompleteEmail } from "@/lib/email/resend"
import { getPreviousScoreForDomain } from "@/lib/score-history"
import { DEFAULT_SCAN_TIMEZONE, DIGEST_DAY, DIGEST_HOUR } from "@/lib/scan-slots"
import { getLocalTime } from "@/lib/local-time"

/**
 * Weekly Digest Dispatcher
 *
 * Tells each subscriber their report is refreshed, once a week, at a civilised
 * local hour — regardless of when their scan actually ran.
 *
 * Scans used to email on completion, which tied every scan to an hour someone
 * would not mind hearing from us. That forced all the weekly scans into the same
 * few slots, and they then starved each other on process-scan's concurrency
 * gate. Splitting the email from the scan frees a scan to run in any of the
 * week's 168 hours (see `candidateSlots`), while the client still hears from us
 * on Monday morning.
 *
 * The digest reports the domain's most recent complete report. A scan that
 * failed this week means last week's figures go out again rather than nothing —
 * the health monitor is what escalates the failure.
 */

/** Don't send a second digest within this window, however often this retries. */
const DIGEST_COOLDOWN_HOURS = 72

interface DigestSubscription {
  id: string
  lead_id: string
  domain: string
  scan_timezone: string | null
  last_digest_sent_at: string | null
  leads: {
    email: string
    email_verified: boolean | null
  } | null
}

export const weeklyDigestDispatcher = inngest.createFunction(
  {
    id: "weekly-digest-dispatcher",
    retries: 2,
  },
  { cron: "0 * * * *" }, // Every hour; each subscription fires in its own timezone
  async ({ step }) => {
    const now = new Date()

    const due = await step.run("find-due-digests", async () => {
      const supabase = createServiceClient()

      const { data: subscriptions, error } = await supabase
        .from("domain_subscriptions")
        .select(`
          id,
          lead_id,
          domain,
          scan_timezone,
          last_digest_sent_at,
          leads (
            email,
            email_verified
          )
        `)
        .eq("status", "active")
        // A paused domain stops refreshing, so a digest would keep announcing
        // the same increasingly stale report every Monday.
        .eq("scan_paused", false)

      if (error) {
        console.error("[weekly-digest] Error fetching subscriptions:", error)
        return []
      }

      const cooldownCutoff = new Date(now.getTime() - DIGEST_COOLDOWN_HOURS * 3600_000)

      return (subscriptions ?? []).filter((sub: DigestSubscription) => {
        const timezone = sub.scan_timezone ?? DEFAULT_SCAN_TIMEZONE
        const localTime = getLocalTime(now, timezone)

        if (localTime.day !== DIGEST_DAY || localTime.hour !== DIGEST_HOUR) return false

        // An unverified subscriber cannot open the report, and process-scan has
        // already sent them a verification email.
        if (sub.leads?.email_verified !== true) return false

        if (sub.last_digest_sent_at && new Date(sub.last_digest_sent_at) > cooldownCutoff) {
          return false
        }

        return true
      })
    })

    if (due.length === 0) {
      return { sent: 0, message: "No digests due this hour" }
    }

    const results: Array<{ domain: string; sent: boolean; reason?: string }> = []

    // One step per subscription, so a single bad address cannot cost everyone
    // else their digest on a retry.
    for (const sub of due as DigestSubscription[]) {
      const result = await step.run(`digest-${sub.id}`, async () => {
        const supabase = createServiceClient()
        const email = sub.leads?.email

        if (!email) {
          return { domain: sub.domain, sent: false, reason: "no email on lead" }
        }

        // The domain's most recent complete report, whenever its slot ran.
        const { data: runs } = await supabase
          .from("scan_runs")
          .select("id, created_at, reports (url_token, visibility_score)")
          .eq("domain_subscription_id", sub.id)
          .eq("status", "complete")
          .order("created_at", { ascending: false })
          .limit(1)

        const run = runs?.[0]
        const report = Array.isArray(run?.reports) ? run?.reports[0] : run?.reports

        if (!run || !report?.url_token) {
          console.error(
            `[weekly-digest] No complete report for ${sub.domain}; skipping digest`
          )
          return { domain: sub.domain, sent: false, reason: "no complete report" }
        }

        const previousScore = await getPreviousScoreForDomain(
          supabase,
          sub.lead_id,
          sub.domain,
          run.id
        )

        const emailResult = await sendScanCompleteEmail(
          email,
          report.url_token,
          sub.domain,
          Number(report.visibility_score) || 0,
          previousScore
        )

        if (!emailResult.success) {
          console.error(
            `[weekly-digest] Failed to send digest for ${sub.domain}: ${emailResult.error}`
          )
          return { domain: sub.domain, sent: false, reason: emailResult.error }
        }

        await supabase.from("email_logs").insert({
          lead_id: sub.lead_id,
          run_id: run.id,
          email_type: "weekly_digest",
          recipient: email,
          resend_id: emailResult.messageId,
          status: "sent",
        })

        // Written after a successful send, so a retry re-sends only what failed.
        await supabase
          .from("domain_subscriptions")
          .update({ last_digest_sent_at: new Date().toISOString() })
          .eq("id", sub.id)

        return { domain: sub.domain, sent: true }
      })

      results.push(result)
    }

    return {
      sent: results.filter((r) => r.sent).length,
      skipped: results.filter((r) => !r.sent),
    }
  }
)
