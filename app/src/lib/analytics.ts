/**
 * Google Analytics 4 event tracking utility
 *
 * Provides both client-side and server-side event tracking for the conversion funnel:
 * 1. get_free_report_click - Button clicked on homepage
 * 2. scan_submitted - Form successfully submitted (API call succeeded)
 * 3. report_email_sent - Email sent to user (server-side, in Inngest)
 * 4. report_viewed - User opens report page (first view tracked)
 * 5. pricing_page_viewed - User visits pricing page
 * 6. checkout_started - User clicks subscribe button
 * 7. subscription_completed - Stripe webhook confirms payment (server-side)
 */

// Extend Window type for gtag (client-side only)
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'js' | 'set',
      action: string,
      params?: Record<string, unknown>
    ) => void
  }
}

// Event parameter types for type safety
export type AnalyticsEventParams = Record<string, string | number | boolean | undefined>

/**
 * Track an event to Google Analytics (client-side)
 * Safe to call server-side (will be a no-op)
 */
export function trackEvent(
  eventName: string,
  params?: AnalyticsEventParams
): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params)
  }
}

/**
 * Track events that should only fire once per session
 * Uses sessionStorage to prevent duplicate events
 */
export function trackEventOnce(
  eventName: string,
  uniqueKey: string,
  params?: AnalyticsEventParams
): boolean {
  if (typeof window === 'undefined') return false

  const storageKey = `ga_event_${eventName}_${uniqueKey}`

  // Check if already tracked this session
  if (sessionStorage.getItem(storageKey)) {
    return false
  }

  // Track the event
  trackEvent(eventName, params)

  // Mark as tracked
  sessionStorage.setItem(storageKey, 'true')

  return true
}

/**
 * Server-side analytics tracking via Measurement Protocol
 * Used for events that happen on the server (email sent, subscription completed)
 *
 * Note: This sends events to GA4 via the Measurement Protocol.
 * Requires GOOGLE_ANALYTICS_MEASUREMENT_ID and GOOGLE_ANALYTICS_API_SECRET env vars.
 */
export async function trackServerEvent(
  clientId: string,
  eventName: string,
  params?: Record<string, string | number | boolean>
): Promise<boolean> {
  const measurementId = process.env.GOOGLE_ANALYTICS_MEASUREMENT_ID
  const apiSecret = process.env.GOOGLE_ANALYTICS_API_SECRET

  // If not configured, log and skip (non-blocking)
  if (!measurementId || !apiSecret) {
    console.log(`[Analytics] Server event skipped (not configured): ${eventName}`)
    return false
  }

  try {
    const response = await fetch(
      `https://www.google-analytics.com/mp/collect?measurement_id=${measurementId}&api_secret=${apiSecret}`,
      {
        method: 'POST',
        body: JSON.stringify({
          client_id: clientId,
          events: [
            {
              name: eventName,
              params: {
                ...params,
                engagement_time_msec: 100,
              },
            },
          ],
        }),
      }
    )

    if (!response.ok) {
      console.error(`[Analytics] Server event failed: ${eventName}`, response.status)
      return false
    }

    console.log(`[Analytics] Server event tracked: ${eventName}`)
    return true
  } catch (error) {
    console.error(`[Analytics] Server event error: ${eventName}`, error)
    return false
  }
}

// Pre-defined event names for consistency
export const ANALYTICS_EVENTS = {
  // Funnel events
  GET_FREE_REPORT_CLICK: 'get_free_report_click',
  SCAN_SUBMITTED: 'scan_submitted',
  REPORT_EMAIL_SENT: 'report_email_sent',
  REPORT_VIEWED: 'report_viewed',
  PRICING_PAGE_VIEWED: 'pricing_page_viewed',
  CHECKOUT_STARTED: 'checkout_started',
  SUBSCRIPTION_COMPLETED: 'subscription_completed',

  // Modal events (Variant C)
  SCAN_MODAL_OPENED: 'scan_modal_opened',
  SCAN_MODAL_CLOSED: 'scan_modal_closed',

  // Engagement events
  REPORT_TAB_CLICK: 'report_tab_click',
  UPSELL_CTA_CLICKED: 'upsell_cta_clicked',
  EXPORT_DOWNLOADED: 'export_downloaded',

  // A/B Testing events
  EXPERIMENT_IMPRESSION: 'experiment_impression',
} as const

/**
 * Set a user property for GA4 (used for A/B test variant tracking)
 * User properties persist across events for the session
 */
export function setUserProperty(name: string, value: string): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('set', 'user_properties', { [name]: value })
  }
}

/**
 * Track A/B experiment impression
 * Sets user property and fires impression event for GA4 reporting
 */
export function trackExperimentImpression(
  experimentId: string,
  variantId: string
): void {
  // Set as user property (persists across all events in session)
  setUserProperty('ab_variant', variantId)

  // Also fire as event for easier funnel analysis
  trackEventOnce(
    ANALYTICS_EVENTS.EXPERIMENT_IMPRESSION,
    `${experimentId}_${variantId}`,
    {
      experiment_id: experimentId,
      variant_id: variantId,
    }
  )
}

/**
 * Get experiment variant from cookie (client-side)
 */
export function getExperimentVariant(cookieName: string): string | null {
  if (typeof document === 'undefined') return null

  const match = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${cookieName}=`))

  return match ? match.split('=')[1] : null
}
