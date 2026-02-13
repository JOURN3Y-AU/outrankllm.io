import { serve } from "inngest/next"
import { inngest } from "@/inngest/client"
import { processScan } from "@/inngest/functions/process-scan"
import { hourlyScanDispatcher } from "@/inngest/functions/hourly-scan-dispatcher"
import { enrichSubscriber } from "@/inngest/functions/enrich-subscriber"
import { processHiringBrandScan } from "@/inngest/functions/process-hiringbrand-scan"

// Allow up to 600 seconds (10 min) for Inngest to execute function steps
// Required for long-running steps like PRD generation with extended thinking
// Vercel Pro with Fluid Compute supports up to 800s max
export const maxDuration = 600

// Inngest webhook handler
// This route handles all Inngest events and cron triggers
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processScan, hourlyScanDispatcher, enrichSubscriber, processHiringBrandScan],
})
