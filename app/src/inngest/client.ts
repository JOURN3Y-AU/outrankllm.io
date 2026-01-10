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
    verificationToken?: string
    skipEmail?: boolean
  }
}

// Union type of all events for type inference
export type InngestEvents = ScanProcessEvent
