import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { processScan } from "@/inngest/functions/process-scan"
import { hourlyScanDispatcher } from "@/inngest/functions/hourly-scan-dispatcher"

// Inngest webhook handler
// This route handles all Inngest events and cron triggers
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processScan, hourlyScanDispatcher],
})
