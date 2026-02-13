import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'
import { experiments, selectVariant } from '@/lib/experiments/config'

// Preview mode configuration
const PREVIEW_SECRET = process.env.PREVIEW_SECRET || 'outrankllm-preview-2024'
const PREVIEW_COOKIE_NAME = 'outrankllm-preview'
const SESSION_COOKIE_NAME = 'outrankllm-session'
const COMING_SOON_ENABLED = process.env.COMING_SOON_ENABLED !== 'false' // Enabled by default

// Region detection for pricing
const REGION_COOKIE_NAME = 'pricing_region'
type PricingRegion = 'AU' | 'INTL'

// Referral URL tracking
const REFERRAL_COOKIE_NAME = 'referral_url'

// Paths that should always be accessible (even in coming soon mode)
const PUBLIC_PATHS = [
  '/coming-soon',
  '/api',
  '/_next',
  '/favicon.ico',
  '/images',
  '/opengraph-image', // Allow OG image for social media crawlers
  '/report', // Allow report pages for verified users
  '/verify-error', // Allow verification error page
  '/report-pending', // Allow report pending page
  '/login', // Allow login page
  '/forgot-password', // Allow forgot password page
  '/reset-password', // Allow reset password page
  '/subscribe', // Allow subscription pages
  '/pricing', // Allow pricing page
  '/hiringbrand', // Allow all HiringBrand routes (account protected via PROTECTED_PATHS)
]

// Paths that require authentication
const PROTECTED_PATHS = [
  '/dashboard',
  '/hiringbrand/account',
]

async function verifySession(token: string): Promise<boolean> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET)
    await jwtVerify(token, secret)
    return true
  } catch {
    return false
  }
}

/**
 * Detect pricing region from Vercel geo headers
 * Sets a cookie if not already present (user hasn't manually toggled)
 */
function detectRegionFromHeaders(request: NextRequest): PricingRegion | null {
  // Vercel provides country code in x-vercel-ip-country header
  const ipCountry = request.headers.get('x-vercel-ip-country')

  if (ipCountry === 'AU') {
    return 'AU'
  }

  // Default to international for all other countries
  if (ipCountry) {
    return 'INTL'
  }

  // In local development, default to AU (we're an Australian company)
  // This can be overridden with ?region=INTL query param
  if (process.env.NODE_ENV === 'development') {
    return 'AU'
  }

  return null // No geo header available
}

/**
 * Add region cookie to response if needed
 */
function addRegionCookie(response: NextResponse, request: NextRequest): NextResponse {
  // Don't override if user has already set a preference
  const existingRegion = request.cookies.get(REGION_COOKIE_NAME)?.value
  if (existingRegion === 'AU' || existingRegion === 'INTL') {
    return response
  }

  // Detect region from headers
  const detectedRegion = detectRegionFromHeaders(request)
  if (detectedRegion) {
    response.cookies.set(REGION_COOKIE_NAME, detectedRegion, {
      httpOnly: false, // Allow client-side reading
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
  }

  return response
}

/**
 * Add A/B experiment cookies to response
 * Assigns visitor to a variant if not already assigned
 */
function addExperimentCookies(response: NextResponse, request: NextRequest): NextResponse {
  for (const experiment of Object.values(experiments)) {
    const existingVariant = request.cookies.get(experiment.cookieName)?.value

    // Only assign if not already in experiment
    if (!existingVariant) {
      const variant = selectVariant(experiment)
      response.cookies.set(experiment.cookieName, variant, {
        httpOnly: false, // Allow client-side reading for analytics
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }
  }

  return response
}

/**
 * Add referral URL cookie on first visit
 * Captures the HTTP Referer header for later attribution
 */
function addReferralCookie(response: NextResponse, request: NextRequest): NextResponse {
  // Don't override if already captured
  const existingReferral = request.cookies.get(REFERRAL_COOKIE_NAME)?.value
  if (existingReferral) {
    return response
  }

  // Get the Referer header (note: browser spelling is "Referer" not "Referrer")
  const referer = request.headers.get('referer')

  // Only capture external referrals (not self-referrals from our own site)
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      const currentHost = request.headers.get('host') || ''

      // Skip if referrer is from our own domain
      if (refererUrl.host !== currentHost) {
        response.cookies.set(REFERRAL_COOKIE_NAME, referer, {
          httpOnly: false, // Allow client-side reading for scan API
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: '/',
        })
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return response
}

/**
 * Add all tracking cookies (region + experiments + referral)
 */
function addTrackingCookies(response: NextResponse, request: NextRequest): NextResponse {
  addRegionCookie(response, request)
  addExperimentCookies(response, request)
  addReferralCookie(response, request)
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // --- Hostname-based routing for hiringbrand.io ---
  const hostname = request.headers.get('host') || ''
  const isHiringBrand = hostname.includes('hiringbrand.io')

  if (isHiringBrand) {
    // Rewrite root to /hiringbrand landing page (URL stays as hiringbrand.io/)
    if (pathname === '/') {
      return addTrackingCookies(
        NextResponse.rewrite(new URL('/hiringbrand', request.url)),
        request
      )
    }

    // Allow HB routes, shared API routes, and static assets
    const isAllowed =
      pathname.startsWith('/hiringbrand') ||
      pathname.startsWith('/api/hiringbrand') ||
      pathname.startsWith('/api/inngest') ||
      pathname.startsWith('/api/stripe') ||
      pathname.startsWith('/_next') ||
      pathname === '/favicon.ico'

    if (!isAllowed) {
      return NextResponse.redirect(new URL('/', request.url))
    }

    // Fall through to normal auth/cookie logic for allowed paths
  }

  // Check if this is a protected path
  const isProtectedPath = PROTECTED_PATHS.some(path => pathname.startsWith(path))

  if (isProtectedPath) {
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value

    // Determine login page based on brand
    const loginPath = pathname.startsWith('/hiringbrand/') ? '/hiringbrand/login' : '/login'

    if (!sessionToken) {
      // No session - redirect to login
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('redirect', pathname)
      return NextResponse.redirect(loginUrl)
    }

    const isValid = await verifySession(sessionToken)
    if (!isValid) {
      // Invalid session - clear cookie and redirect to login
      const loginUrl = new URL(loginPath, request.url)
      loginUrl.searchParams.set('redirect', pathname)
      const response = NextResponse.redirect(loginUrl)
      response.cookies.delete(SESSION_COOKIE_NAME)
      return response
    }

    // Valid session - allow access
    return addTrackingCookies(NextResponse.next(), request)
  }

  // Skip middleware for public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return addTrackingCookies(NextResponse.next(), request)
  }

  // If coming soon mode is disabled, allow all access
  if (!COMING_SOON_ENABLED) {
    return addTrackingCookies(NextResponse.next(), request)
  }

  // Check for preview secret in URL (sets cookie for future visits)
  const previewParam = searchParams.get('preview')
  if (previewParam === PREVIEW_SECRET) {
    const response = NextResponse.next()
    response.cookies.set(PREVIEW_COOKIE_NAME, 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
    return addTrackingCookies(response, request)
  }

  // Check for existing preview cookie
  const hasPreviewAccess = request.cookies.get(PREVIEW_COOKIE_NAME)?.value === 'true'
  if (hasPreviewAccess) {
    return addTrackingCookies(NextResponse.next(), request)
  }

  // No preview access - redirect to coming soon page
  if (pathname !== '/coming-soon') {
    return NextResponse.redirect(new URL('/coming-soon', request.url))
  }

  return addTrackingCookies(NextResponse.next(), request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
