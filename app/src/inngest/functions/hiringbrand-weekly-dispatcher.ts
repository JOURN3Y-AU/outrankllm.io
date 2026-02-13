import { inngest } from '../client'
import { createServiceClient } from '@/lib/supabase/server'

/**
 * HiringBrand Weekly Scan Dispatcher
 *
 * Runs daily at 6am UTC. Finds all primary monitored_domains
 * belonging to active organizations that haven't been scanned
 * in 7+ days, and triggers a scan for each.
 */
export const hiringBrandWeeklyDispatcher = inngest.createFunction(
  {
    id: 'hiringbrand-weekly-scan-dispatcher',
    retries: 2,
  },
  { cron: '0 6 * * *' },
  async ({ step }) => {
    const brandsToScan = await step.run('find-due-brands', async () => {
      const supabase = createServiceClient()

      // Find primary monitored_domains in active orgs
      const { data: domains, error } = await supabase
        .from('monitored_domains')
        .select('id, domain, organization_id, organizations!inner(id, status)')
        .eq('is_primary', true)

      if (error || !domains) {
        console.error('HB weekly dispatcher: error fetching domains:', error)
        return []
      }

      // Filter to active orgs only
      const activeDomains = domains.filter((d: Record<string, unknown>) => {
        const org = d.organizations as { id: string; status: string } | null
        return org?.status === 'active'
      })

      // For each domain, check if last completed scan was 7+ days ago
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const dueDomains: { monitoredDomainId: string; domain: string; organizationId: string }[] = []

      for (const d of activeDomains) {
        const { data: lastScan } = await supabase
          .from('scan_runs')
          .select('completed_at')
          .eq('monitored_domain_id', d.id as string)
          .eq('brand', 'hiringbrand')
          .eq('status', 'complete')
          .order('completed_at', { ascending: false })
          .limit(1)
          .single()

        if (!lastScan || !lastScan.completed_at || new Date(lastScan.completed_at) < sevenDaysAgo) {
          dueDomains.push({
            monitoredDomainId: d.id as string,
            domain: d.domain as string,
            organizationId: d.organization_id as string,
          })
        }
      }

      return dueDomains
    })

    if (brandsToScan.length === 0) {
      return { queued: 0, message: 'No HiringBrand scans due today' }
    }

    // Queue scans
    await step.run('queue-scans', async () => {
      await inngest.send(
        brandsToScan.map((brand) => ({
          name: 'hiringbrand/scan' as const,
          data: {
            domain: brand.domain,
            organizationId: brand.organizationId,
            monitoredDomainId: brand.monitoredDomainId,
          },
        }))
      )
    })

    return {
      queued: brandsToScan.length,
      brands: brandsToScan.map((b) => b.domain),
    }
  }
)
