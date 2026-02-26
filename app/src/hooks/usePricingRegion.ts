'use client'

import { useState, useEffect } from 'react'
import {
  detectPricingRegion,
  parseRegionCookie,
  parseRegionParam,
  REGION_COOKIE_NAME,
  type PricingRegion,
} from '@/lib/geo/pricing-region'

/**
 * Hook to detect pricing region on client-side.
 * Returns region and loading state — consumers look up prices via TIER_PRICES[region][tier].
 */
export function usePricingRegion(): {
  region: PricingRegion
  loading: boolean
} {
  const [region, setRegion] = useState<PricingRegion>('INTL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for query param override first
    const urlParams = new URLSearchParams(window.location.search)
    const queryRegion = parseRegionParam(urlParams.get('region'))

    if (queryRegion) {
      setRegion(queryRegion)
      setLoading(false)
      return
    }

    // Check cookie preference
    const cookieValue = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${REGION_COOKIE_NAME}=`))
      ?.split('=')[1]
    const cookieRegion = parseRegionCookie(cookieValue)

    if (cookieRegion) {
      setRegion(cookieRegion)
      setLoading(false)
      return
    }

    // Default detection - for pages without lead data,
    // rely on middleware having set the cookie from IP
    // If no cookie, default to INTL
    const result = detectPricingRegion({
      cookieRegion: null,
      queryParamRegion: null,
    })
    setRegion(result.region)
    setLoading(false)
  }, [])

  return { region, loading }
}
