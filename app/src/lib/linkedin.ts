/**
 * LinkedIn Insight Tag conversion tracking utility
 *
 * Tracks conversions for LinkedIn Ads campaigns:
 * - Page views (automatic via Insight Tag)
 * - Custom conversions (sign-ups, checkouts, etc.)
 *
 * Setup required in LinkedIn Campaign Manager:
 * 1. Create conversion actions for each event type
 * 2. Get the conversion_id for each action
 * 3. Call trackLinkedInConversion() with the conversion_id
 */

// Extend Window type for LinkedIn tracking
declare global {
  interface Window {
    lintrk?: (command: string, params: { conversion_id: number }) => void
  }
}

/**
 * Track a LinkedIn conversion event
 *
 * @param conversionId - The conversion ID from LinkedIn Campaign Manager
 *
 * Usage:
 * ```
 * // After user signs up for free report
 * trackLinkedInConversion(LINKEDIN_CONVERSIONS.FREE_REPORT_SIGNUP)
 * ```
 */
export function trackLinkedInConversion(conversionId: number): void {
  if (typeof window !== 'undefined' && window.lintrk) {
    window.lintrk('track', { conversion_id: conversionId })
  }
}

/**
 * Track conversion only once per session (prevents duplicate conversion tracking)
 * Uses sessionStorage to prevent firing the same conversion multiple times
 */
export function trackLinkedInConversionOnce(
  conversionId: number,
  uniqueKey: string
): boolean {
  if (typeof window === 'undefined') return false

  const storageKey = `li_conversion_${conversionId}_${uniqueKey}`

  // Check if already tracked this session
  if (sessionStorage.getItem(storageKey)) {
    return false
  }

  // Track the conversion
  trackLinkedInConversion(conversionId)

  // Mark as tracked
  sessionStorage.setItem(storageKey, 'true')

  return true
}

/**
 * LinkedIn Conversion IDs
 *
 * IMPORTANT: Replace these placeholder values with actual conversion IDs
 * from LinkedIn Campaign Manager after creating each conversion action.
 *
 * To get conversion IDs:
 * 1. Go to LinkedIn Campaign Manager > Account Assets > Conversions
 * 2. Create a new conversion for each event type
 * 3. Copy the conversion ID from the conversion details
 */
export const LINKEDIN_CONVERSIONS = {
  // Conversion IDs from LinkedIn Campaign Manager (outrankllm.io)
  FREE_REPORT_SIGNUP: 0,      // Not set up yet - add ID when needed
  REPORT_VIEWED: 23485596,    // User views their report
  PRICING_PAGE_VIEWED: 23485604, // User visits pricing page
  CHECKOUT_STARTED: 23485612, // User clicks subscribe button
  SUBSCRIPTION_COMPLETED: 23485620, // User completes Stripe checkout
} as const
