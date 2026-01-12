import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { getSession } from '@/lib/auth'
import { Nav } from '@/components/nav/Nav'
import { Footer } from '@/components/landing/Footer'
import { DashboardClient } from '@/components/dashboard'
import { getSubscriptionsWithReports } from '@/lib/subscriptions'
import { stripe } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/server'
import {
  detectPricingRegion,
  parseRegionCookie,
  REGION_COOKIE_NAME,
  type PricingRegion,
} from '@/lib/geo/pricing-region'

export default async function DashboardPage() {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  // Get subscriptions with reports
  const subscriptions = await getSubscriptionsWithReports(session.lead_id)

  // Detect pricing region for the "Add Domain" modal
  // Priority: existing Stripe subscription currency > cookie > IP detection
  let region: PricingRegion = 'INTL'

  // First, check if customer has existing Stripe subscriptions (must use same currency)
  const supabase = createServiceClient()
  const { data: lead } = await supabase
    .from('leads')
    .select('stripe_customer_id')
    .eq('id', session.lead_id)
    .single()

  if (lead?.stripe_customer_id) {
    try {
      const existingSubscriptions = await stripe.subscriptions.list({
        customer: lead.stripe_customer_id,
        status: 'all',
        limit: 1,
      })

      if (existingSubscriptions.data.length > 0) {
        // Use the currency from existing subscriptions
        const existingCurrency = existingSubscriptions.data[0].currency
        region = existingCurrency === 'aud' ? 'AU' : 'INTL'
      }
    } catch (error) {
      console.error('Error checking Stripe subscriptions:', error)
    }
  }

  // If no existing subscriptions, fall back to standard detection
  if (!lead?.stripe_customer_id || region === 'INTL') {
    const cookieStore = await cookies()
    const headersList = await headers()
    const regionCookie = parseRegionCookie(cookieStore.get(REGION_COOKIE_NAME)?.value)
    const ipCountry = headersList.get('x-vercel-ip-country')

    const detected = detectPricingRegion({
      cookieRegion: regionCookie,
      ipCountry,
    })

    // Only use detected region if we don't have existing subscription data
    if (!lead?.stripe_customer_id) {
      region = detected.region as PricingRegion
    }
  }

  return (
    <>
      <div className="grid-bg" />
      <Nav />

      <main className="relative z-10 min-h-screen" style={{ paddingTop: '120px', paddingBottom: '80px' }}>
        <div style={{ maxWidth: '960px', marginLeft: 'auto', marginRight: 'auto', padding: '0 24px' }}>
          {/* Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 className="text-3xl font-medium" style={{ marginBottom: '8px' }}>
              Dashboard
            </h1>
            <p className="text-[var(--text-mid)]">{session.email}</p>
          </div>

          {/* Client Component for Interactive Dashboard */}
          <DashboardClient
            initialSubscriptions={subscriptions}
            email={session.email}
            region={region}
          />
        </div>
      </main>

      <Footer />
    </>
  )
}
