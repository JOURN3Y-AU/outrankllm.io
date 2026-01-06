import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Preview mode configuration
const PREVIEW_SECRET = process.env.PREVIEW_SECRET || 'outrankllm-preview-2024'
const PREVIEW_COOKIE_NAME = 'outrankllm-preview'
const COMING_SOON_ENABLED = process.env.COMING_SOON_ENABLED !== 'false' // Enabled by default

// Paths that should always be accessible (even in coming soon mode)
const PUBLIC_PATHS = [
  '/coming-soon',
  '/api',
  '/_next',
  '/favicon.ico',
  '/images',
]

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Skip middleware for public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  // If coming soon mode is disabled, allow all access
  if (!COMING_SOON_ENABLED) {
    return NextResponse.next()
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
    return response
  }

  // Check for existing preview cookie
  const hasPreviewAccess = request.cookies.get(PREVIEW_COOKIE_NAME)?.value === 'true'
  if (hasPreviewAccess) {
    return NextResponse.next()
  }

  // No preview access - redirect to coming soon page
  if (pathname !== '/coming-soon') {
    return NextResponse.redirect(new URL('/coming-soon', request.url))
  }

  return NextResponse.next()
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
