import { Inngest } from "inngest"

// Inngest client singleton
// Used to send events and define functions
export const inngest = new Inngest({
  id: "outrankllm",
})

// Event type definitions for type-safe event handling
/**
 * Inngest registers every function under `<appId>-<functionId>`, and that
 * prefixed value — not the bare id — is what `inngest/function.failed` and
 * `inngest/function.cancelled` carry in `event.data.function_id`.
 *
 * Matching on the bare id compiles, deploys, and silently never fires. Three
 * handlers did exactly that. Between 2026-08-07 and 2026-08-31 not one of 57
 * scan failures was recorded by its own handler: every row was swept up to six
 * hours later by the health monitor with "Auto-recovered by health monitor:
 * scan stuck for >30 minutes", a message that describes the sweeper rather than
 * the cause. Ten runs from the 2026-08-30 batch sat untouched for hours.
 *
 * Build the expression from the client id so a rename cannot reintroduce it.
 */
export function whenFunctionIs(functionId: string): string {
  return `event.data.function_id == "${inngest.id}-${functionId}"`
}

export type ScanProcessEvent = {
  name: "scan/process"
  data: {
    scanId: string | null // null for weekly cron scans (will be created in first step)
    domain: string
    email: string
    leadId: string
    domainSubscriptionId?: string // For subscriber scans - links scan_run to domain_subscription
    verificationToken?: string
    skipEmail?: boolean
  }
}

export type SubscriberEnrichEvent = {
  name: "subscriber/enrich"
  data: {
    leadId: string
    scanRunId: string
    domainSubscriptionId?: string // For multi-domain isolation
  }
}

// HiringBrand employer reputation scan
export type HiringBrandScanEvent = {
  name: "hiringbrand/scan"
  data: {
    domain: string
    organizationId: string
    monitoredDomainId: string
  }
}

// Union type of all events for type inference
export type InngestEvents = ScanProcessEvent | SubscriberEnrichEvent | HiringBrandScanEvent
