import { inngest } from "../client"
import { createServiceClient } from "@/lib/supabase/server"
import { Resend } from "resend"

const ALERT_EMAIL = "kevin.morrell@journ3y.com.au"
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "reports@outrankllm.io"

interface StuckScan {
  id: string
  domain: string
  status: string
  progress: number
  created_at: string
  started_at: string | null
  brand: string | null
  lead_id: string | null
  domain_subscription_id: string | null
  organization_id: string | null
  monitored_domain_id: string | null
}

interface IncompleteSub {
  id: string
  domain: string
  created_at: string
  leads: { email: string } | { email: string }[] | null
}

// How long a scan can be in a non-terminal state before we consider it stuck.
// Must stay above the longest Inngest `timeouts.finish` across the scan
// functions (currently 30m for HiringBrand, 20m for outrankllm) — otherwise
// this monitor marks scans failed while Inngest is still legitimately running
// them, and the recovery races the run it is supposed to be recovering.
const STUCK_THRESHOLD_MINUTES = 40

// How long a domain_subscription can remain "incomplete" before alerting
const INCOMPLETE_SUB_THRESHOLD_HOURS = 1

/**
 * Scan Health Monitor
 *
 * Runs hourly and checks for:
 * 1. Stuck scans (not complete/failed after STUCK_THRESHOLD_MINUTES)
 * 2. Domain subscriptions stuck in "incomplete" state (signup flow failures)
 * 3. High failure rate in recent scans
 *
 * Sends an alert email to the admin when issues are detected.
 */
export const scanHealthMonitor = inngest.createFunction(
  {
    id: "scan-health-monitor",
    retries: 1,
  },
  // Hourly, not six-hourly. STUCK_THRESHOLD_MINUTES already keeps this off runs
  // that are still legitimately executing, so the only thing a six-hour gap
  // bought was a six-hour blind spot: ten scans from the 2026-08-30 batch sat
  // in a non-terminal state for hours with nothing recorded anywhere. This is a
  // backstop for runs that hang without emitting any event — the failure and
  // cancellation handlers cover the rest, now that they match.
  { cron: "0 * * * *" },
  async ({ step }) => {
    const issues: string[] = []

    // Stuck scans are discrete events: this run recovers them, so they are gone
    // by the next sweep and alerting every time is correct. The other two checks
    // describe standing conditions that persist for hours, so at an hourly cron
    // they would mail the same thing 24 times a day. Report those on the old
    // six-hourly cadence.
    const isDigestHour = [23, 5, 11, 17].includes(new Date().getUTCHours())

    // Check 1: Stuck scans
    const stuckScans = await step.run("check-stuck-scans", async () => {
      const supabase = createServiceClient()

      const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from("scan_runs")
        .select("id, domain, status, progress, created_at, started_at, brand, lead_id, domain_subscription_id, organization_id, monitored_domain_id")
        .not("status", "in", '("complete","failed")')
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[HealthMonitor] Error checking stuck scans:", error)
        return []
      }

      return data || []
    })

    if (stuckScans.length > 0) {
      const outrankScans = stuckScans.filter((s: StuckScan) => !s.brand || s.brand === "outrankllm")
      const hbScans = stuckScans.filter((s: StuckScan) => s.brand === "hiringbrand")

      if (outrankScans.length > 0) {
        issues.push(
          `**${outrankScans.length} stuck outrankllm scan(s) (auto-recovered):**\n` +
            outrankScans
              .map((s: StuckScan) => `  - ${s.domain} (${s.status}, ${s.progress}%, started ${s.created_at})`)
              .join("\n")
        )
      }
      if (hbScans.length > 0) {
        issues.push(
          `**${hbScans.length} stuck HiringBrand scan(s) (auto-recovered):**\n` +
            hbScans
              .map((s: StuckScan) => `  - ${s.domain} (${s.status}, ${s.progress}%, started ${s.created_at})`)
              .join("\n")
        )
      }
    }

    /**
     * Guards the re-queue against an infinite retry loop.
     *
     * Re-queueing was unconditional, so a scan that fails for a deterministic
     * reason got retried every 6 hours forever. Each attempt pays for the full
     * ChatGPT search phase before dying, at roughly $0.046 per query — a
     * HiringBrand sentiment bug quietly burned ~$45 of OpenAI credit across 32
     * failed runs this way. Retry once, then leave it failed and let the alert
     * do its job: a scan failing repeatedly needs a human, not another attempt.
     */
    async function alreadyRetried(scan: StuckScan): Promise<boolean> {
      const supabase = createServiceClient()
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      let query = supabase
        .from("scan_runs")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .eq("domain", scan.domain)
        .gt("created_at", since)
        .like("error_message", "Auto-recovered by health monitor%")

      query = scan.monitored_domain_id
        ? query.eq("monitored_domain_id", scan.monitored_domain_id)
        : query.eq("lead_id", scan.lead_id)

      const { count } = await query
      return (count ?? 0) > 0
    }

    // Auto-recover: Mark stuck scans as failed and re-queue them
    if (stuckScans.length > 0) {
      const outrankRecoverable = stuckScans.filter((s: StuckScan) => !s.brand || s.brand === "outrankllm")
      const hbRecoverable = stuckScans.filter((s: StuckScan) => s.brand === "hiringbrand")

      if (outrankRecoverable.length > 0) {
        await step.run("auto-recover-stuck-scans", async () => {
          const supabase = createServiceClient()

          for (const scan of outrankRecoverable) {
            // Mark as failed
            await supabase
              .from("scan_runs")
              .update({
                status: "failed",
                error_message: "Auto-recovered by health monitor: scan stuck for >30 minutes",
              })
              .eq("id", scan.id)

            // Re-queue if we have the lead_id (scheduled scans always do),
            // but only if this domain hasn't already been retried today.
            if (scan.lead_id && scan.domain && !(await alreadyRetried(scan))) {
              // Look up lead email for the scan event
              const { data: lead } = await supabase
                .from("leads")
                .select("email")
                .eq("id", scan.lead_id)
                .single()

              if (lead) {
                await inngest.send({
                  name: "scan/process",
                  data: {
                    scanId: null,
                    domain: scan.domain,
                    email: lead.email,
                    leadId: scan.lead_id,
                    domainSubscriptionId: scan.domain_subscription_id || undefined,
                    skipEmail: false,
                  },
                })
              }
            }
          }

          console.log(`[HealthMonitor] Auto-recovered ${outrankRecoverable.length} stuck outrankllm scan(s)`)
        })
      }

      if (hbRecoverable.length > 0) {
        await step.run("auto-recover-stuck-hb-scans", async () => {
          const supabase = createServiceClient()

          for (const scan of hbRecoverable) {
            // Mark as failed
            await supabase
              .from("scan_runs")
              .update({
                status: "failed",
                error_message: "Auto-recovered by health monitor: scan stuck for >30 minutes",
                completed_at: new Date().toISOString(),
              })
              .eq("id", scan.id)

            // Re-queue if we have the organization_id and monitored_domain_id,
            // but only if this brand hasn't already been retried today.
            if (
              scan.organization_id &&
              scan.monitored_domain_id &&
              scan.domain &&
              !(await alreadyRetried(scan))
            ) {
              await inngest.send({
                name: "hiringbrand/scan" as const,
                data: {
                  domain: scan.domain,
                  organizationId: scan.organization_id,
                  monitoredDomainId: scan.monitored_domain_id,
                },
              })
            }
          }

          console.log(`[HealthMonitor] Auto-recovered ${hbRecoverable.length} stuck HiringBrand scan(s)`)
        })
      }
    }

    // Check 2: Incomplete domain subscriptions (signup flow failures)
    const incompleteSubscriptions = await step.run("check-incomplete-subs", async () => {
      const supabase = createServiceClient()

      const cutoff = new Date(
        Date.now() - INCOMPLETE_SUB_THRESHOLD_HOURS * 60 * 60 * 1000
      ).toISOString()

      const { data, error } = await supabase
        .from("domain_subscriptions")
        .select("id, domain, created_at, leads(email)")
        .eq("status", "incomplete")
        .lt("created_at", cutoff)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[HealthMonitor] Error checking incomplete subs:", error)
        return []
      }

      // Only alert for subscriptions that have NO associated scan_runs
      // (ones with scan_runs are just awaiting Stripe payment)
      const subsWithoutScans = []
      for (const sub of data || []) {
        const { count } = await supabase
          .from("scan_runs")
          .select("id", { count: "exact", head: true })
          .eq("domain", sub.domain)

        if (!count || count === 0) {
          subsWithoutScans.push(sub)
        }
      }

      return subsWithoutScans
    })

    if (incompleteSubscriptions.length > 0 && isDigestHour) {
      issues.push(
        `**${incompleteSubscriptions.length} incomplete subscription(s) with no scan:**\n` +
          incompleteSubscriptions
            .map((s: IncompleteSub) => {
              const email =
                Array.isArray(s.leads) ? s.leads[0]?.email : (s.leads as { email: string } | null)?.email
              return `  - ${s.domain} (${email || "unknown"}, signed up ${s.created_at})`
            })
            .join("\n")
      )
    }

    // Check 3: Recent failure rate
    const failureRate = await step.run("check-failure-rate", async () => {
      const supabase = createServiceClient()

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      const { data: recentScans, error } = await supabase
        .from("scan_runs")
        .select("status")
        .gt("created_at", since)

      if (error || !recentScans || recentScans.length === 0) {
        return { total: 0, failed: 0, rate: 0 }
      }

      const failed = recentScans.filter((s: { status: string }) => s.status === "failed").length
      return {
        total: recentScans.length,
        failed,
        rate: Math.round((failed / recentScans.length) * 100),
      }
    })

    if (failureRate.total > 0 && failureRate.rate > 50 && isDigestHour) {
      issues.push(
        `**High failure rate in last 24h:** ${failureRate.failed}/${failureRate.total} scans failed (${failureRate.rate}%)`
      )
    }

    // Send alert if any issues found
    if (issues.length > 0) {
      await step.run("send-alert-email", async () => {
        const resend = new Resend(process.env.RESEND_API_KEY)

        const issueList = issues.join("\n\n")

        await resend.emails.send({
          from: `outrankllm alerts <${FROM_EMAIL}>`,
          to: ALERT_EMAIL,
          subject: `[outrankllm] Platform health alert — ${issues.length} issue(s) detected`,
          html: generateAlertEmailHtml(issues),
          text: `outrankllm Health Alert\n\n${issueList}\n\nCheck the admin dashboard for details.`,
        })

        console.log(`[HealthMonitor] Alert sent to ${ALERT_EMAIL}: ${issues.length} issue(s)`)
      })
    }

    return {
      issues: issues.length,
      stuckScans: stuckScans.length,
      incompleteSubscriptions: incompleteSubscriptions.length,
      failureRate,
    }
  }
)

function generateAlertEmailHtml(issues: string[]): string {
  const issueRows = issues
    .map(
      (issue) => `
      <tr>
        <td style="padding: 12px 16px; border-bottom: 1px solid #1e293b;">
          <p style="margin: 0; color: #e2e8f0; font-size: 14px; white-space: pre-line;">${issue.replace(/\*\*/g, "").replace(/\n/g, "<br/>")}</p>
        </td>
      </tr>`
    )
    .join("")

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>outrankllm Health Alert</title></head>
<body style="margin: 0; padding: 0; background-color: #0c1525; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0c1525;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color: #111827; border-radius: 8px; border: 1px solid #1e293b;">
          <tr>
            <td style="padding: 32px 24px; border-bottom: 1px solid #1e293b;">
              <h1 style="margin: 0; color: #ef4444; font-size: 20px;">Platform Health Alert</h1>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 14px;">${issues.length} issue(s) detected — ${new Date().toISOString()}</p>
            </td>
          </tr>
          ${issueRows}
          <tr>
            <td style="padding: 24px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">outrankllm.io — Automated Health Monitor</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
