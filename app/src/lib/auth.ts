import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET!
const SESSION_COOKIE_NAME = 'outrankllm-session'
export const SESSION_DURATION = 60 * 60 * 24 * 7 // 7 days in seconds

export interface Session {
  lead_id: string
  email: string
  tier: 'free' | 'starter' | 'pro' | 'agency'
  iat?: number
  exp?: number
}

/**
 * Get the current session from cookies (server-side)
 * Returns null if no valid session exists
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!token) return null

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as Session
    return {
      lead_id: decoded.lead_id,
      email: decoded.email,
      tier: decoded.tier,
    }
  } catch {
    return null
  }
}

/**
 * Require a valid session - throws if not authenticated
 * Use in API routes and server components that require auth
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}

/**
 * Create a JWT token for a session
 */
export function createSessionToken(session: Omit<Session, 'iat' | 'exp'>): string {
  return jwt.sign(
    {
      lead_id: session.lead_id,
      email: session.email,
      tier: session.tier,
    },
    JWT_SECRET,
    { expiresIn: SESSION_DURATION }
  )
}

/**
 * Get cookie options for the session cookie
 */
export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: SESSION_DURATION,
    path: '/',
  }
}
