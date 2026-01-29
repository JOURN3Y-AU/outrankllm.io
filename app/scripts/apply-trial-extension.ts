/**
 * Apply Trial Extension to Existing Free Users
 *
 * This script applies the 7-day trial (Starter features) to existing free users
 * as part of the initial marketing push.
 *
 * What it does:
 * 1. Finds all free users (no active subscriptions, no existing trial)
 * 2. Sets trial_tier = 'starter' and trial_expires_at = Feb 7th midnight AEDT
 * 3. Extends reports.expires_at to Feb 7th
 * 4. Dispatches enrichment jobs via Inngest (batched to avoid overwhelming APIs)
 *
 * Usage:
 *   npx tsx scripts/apply-trial-extension.ts
 *
 * Options:
 *   --dry-run       Show what would be done without making changes
 *   --limit=N       Only process N users (default: all)
 *   --skip-enrich   Skip triggering enrichment (just set trial fields)
 */

import { createClient } from '@supabase/supabase-js'
import { Inngest } from 'inngest'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const INNGEST_EVENT_KEY = process.env.INNGEST_EVENT_KEY!

// Feb 7th 2026 at midnight Sydney time (AEDT = UTC+11)
// midnight AEDT = 13:00 UTC on Feb 6th
const PROMO_TRIAL_EXPIRY = '2026-02-07T13:00:00.000Z'

// Batch settings
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 5000 // 5 seconds between batches

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// Inngest client for sending enrichment events
const inngest = new Inngest({
  id: 'outrankllm',
  eventKey: INNGEST_EVENT_KEY,
})

interface EligibleLead {
  id: string
  email: string
  domain: string | null
  tier: string | null
  trial_tier: string | null
  latestScanId: string | null
}

async function getEligibleLeads(limit?: number): Promise<EligibleLead[]> {
  console.log('🔍 Finding eligible free users...\n')

  // Get all leads with their subscription status and latest completed scan
  let query = supabase
    .from('leads')
    .select(`
      id,
      email,
      domain,
      tier,
      trial_tier,
      domain_subscriptions (
        id,
        status
      ),
      subscriptions (
        id,
        status
      ),
      scan_runs (
        id,
        status,
        created_at
      )
    `)
    .is('trial_tier', null) // No existing trial
    .order('created_at', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data: leads, error } = await query

  if (error) {
    console.error('Error fetching leads:', error)
    throw error
  }

  // Filter to eligible leads
  const eligible = (leads || [])
    .filter((lead: any) => {
      // Check no active domain subscriptions
      const hasActiveDomainSub = lead.domain_subscriptions?.some(
        (ds: any) => ds.status === 'active'
      )
      if (hasActiveDomainSub) return false

      // Check no active legacy subscriptions
      const hasActiveLegacySub = lead.subscriptions?.some(
        (s: any) => s.status === 'active'
      )
      if (hasActiveLegacySub) return false

      // Must have at least one completed scan
      const hasCompletedScan = lead.scan_runs?.some(
        (sr: any) => sr.status === 'complete'
      )
      if (!hasCompletedScan) return false

      return true
    })
    .map((lead: any) => {
      // Find the most recent completed scan
      const completedScans = (lead.scan_runs || [])
        .filter((sr: any) => sr.status === 'complete')
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      return {
        id: lead.id,
        email: lead.email,
        domain: lead.domain,
        tier: lead.tier,
        trial_tier: lead.trial_tier,
        latestScanId: completedScans[0]?.id || null,
      }
    })
    .filter((lead: EligibleLead) => lead.latestScanId !== null)

  return eligible
}

async function applyTrialToLead(
  lead: EligibleLead,
  options: { skipEnrich: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Set trial fields on lead
    const { error: leadError } = await supabase
      .from('leads')
      .update({
        trial_tier: 'starter',
        trial_expires_at: PROMO_TRIAL_EXPIRY,
      })
      .eq('id', lead.id)

    if (leadError) {
      return { success: false, error: `Failed to update lead: ${leadError.message}` }
    }

    // 2. Extend report expiry
    const { error: reportError } = await supabase
      .from('reports')
      .update({ expires_at: PROMO_TRIAL_EXPIRY })
      .eq('run_id', lead.latestScanId)

    if (reportError) {
      return { success: false, error: `Failed to update report: ${reportError.message}` }
    }

    // 3. Trigger enrichment (if not skipped)
    if (!options.skipEnrich) {
      await inngest.send({
        name: 'subscriber/enrich',
        data: {
          leadId: lead.id,
          scanRunId: lead.latestScanId!,
          // NOTE: No domainSubscriptionId for trial users
        },
      })
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const skipEnrich = args.includes('--skip-enrich')
  const limitArg = args.find(a => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined

  console.log('🚀 Trial Extension Script')
  console.log('========================\n')
  console.log(`📅 Trial expires: ${new Date(PROMO_TRIAL_EXPIRY).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })} AEDT`)
  console.log(`🔄 Batch size: ${BATCH_SIZE}`)
  console.log(`⏱️  Batch delay: ${BATCH_DELAY_MS}ms`)
  if (limit) console.log(`📊 Limit: ${limit}`)
  if (dryRun) console.log(`🏃 Mode: DRY RUN`)
  if (skipEnrich) console.log(`⏭️  Skip enrichment: YES`)
  console.log('')

  // Check Inngest key if we're going to trigger enrichment
  if (!skipEnrich && !dryRun && !INNGEST_EVENT_KEY) {
    console.error('❌ Missing INNGEST_EVENT_KEY - required for triggering enrichment')
    console.error('   Add to .env.local or use --skip-enrich flag')
    process.exit(1)
  }

  const eligibleLeads = await getEligibleLeads(limit)

  if (eligibleLeads.length === 0) {
    console.log('✅ No eligible users found!')
    return
  }

  console.log(`📊 Found ${eligibleLeads.length} eligible users:\n`)

  if (dryRun) {
    console.log('🏃 DRY RUN - Would apply trial to:\n')
    eligibleLeads.forEach((lead, i) => {
      console.log(`${i + 1}. ${lead.email} (${lead.domain || 'no domain'})`)
      console.log(`   Lead ID: ${lead.id}`)
      console.log(`   Scan ID: ${lead.latestScanId}`)
    })
    console.log('\nRun without --dry-run to execute.')
    return
  }

  console.log('🚀 Starting trial application...\n')

  let successCount = 0
  let failCount = 0
  const failures: { email: string; error: string }[] = []

  for (let i = 0; i < eligibleLeads.length; i++) {
    const lead = eligibleLeads[i]
    const progress = `[${i + 1}/${eligibleLeads.length}]`

    process.stdout.write(`${progress} Applying trial to ${lead.email}... `)

    const result = await applyTrialToLead(lead, { skipEnrich })

    if (result.success) {
      console.log(skipEnrich ? '✅ (no enrichment)' : '✅')
      successCount++
    } else {
      console.log(`❌ ${result.error}`)
      failCount++
      failures.push({ email: lead.email, error: result.error || 'Unknown error' })
    }

    // Batch delay
    if ((i + 1) % BATCH_SIZE === 0 && i < eligibleLeads.length - 1) {
      console.log(`\n⏳ Waiting ${BATCH_DELAY_MS / 1000}s before next batch...\n`)
      await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS))
    }
  }

  console.log('\n📊 Trial Extension Complete')
  console.log('===========================')
  console.log(`✅ Success: ${successCount}`)
  console.log(`❌ Failed: ${failCount}`)

  if (failures.length > 0) {
    console.log('\n❌ Failures:')
    failures.forEach(f => {
      console.log(`   - ${f.email}: ${f.error}`)
    })
  }

  if (!skipEnrich && successCount > 0) {
    console.log('\n📡 Enrichment jobs dispatched to Inngest')
    console.log('   Monitor progress at: https://app.inngest.com')
  }
}

main().catch(console.error)
