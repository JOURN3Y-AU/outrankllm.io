'use client'

import { useEffect, useState, useCallback } from 'react'

export interface Session {
  lead_id: string
  email: string
  tier: 'free' | 'starter' | 'pro' | 'agency'
}

interface UseSessionReturn {
  session: Session | null
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Client-side hook to get the current session
 * Fetches from /api/auth/session on mount
 */
export function useSession(): UseSessionReturn {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session')
      const data = await res.json()
      setSession(data.session || null)
    } catch {
      setSession(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchSession()
  }, [fetchSession])

  return { session, loading, refresh }
}

/**
 * Login helper - calls the login API
 */
export async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Login failed' }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

/**
 * Logout helper - calls the logout API
 */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
}

/**
 * Set password helper - calls the set-password API
 */
export async function setPassword(
  sessionId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, password }),
    })

    const data = await res.json()

    if (!res.ok) {
      return { success: false, error: data.error || 'Failed to set password' }
    }

    return { success: true }
  } catch {
    return { success: false, error: 'Network error' }
  }
}
