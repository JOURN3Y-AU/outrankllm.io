import { NextRequest, NextResponse } from 'next/server'
import { getFeatureFlags, type Tier } from '@/lib/features/flags'

/**
 * GET /api/feature-flags?tier=free
 * Returns feature flags for a specific tier
 */
export async function GET(request: NextRequest) {
  const tier = request.nextUrl.searchParams.get('tier') as Tier || 'free'

  // Validate tier
  if (!['free', 'pro', 'enterprise'].includes(tier)) {
    return NextResponse.json(
      { error: 'Invalid tier' },
      { status: 400 }
    )
  }

  try {
    const flags = await getFeatureFlags(tier)

    return NextResponse.json({
      tier,
      flags
    })
  } catch (error) {
    console.error('Feature flags error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feature flags' },
      { status: 500 }
    )
  }
}
