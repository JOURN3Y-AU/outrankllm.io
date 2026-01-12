import { Inngest } from "inngest"

// Inngest client singleton
// Used to send events and define functions
export const inngest = new Inngest({
  id: "outrankllm",
})

// Event type definitions for type-safe event handling
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

// Union type of all events for type inference
export type InngestEvents = ScanProcessEvent | SubscriberEnrichEvent
