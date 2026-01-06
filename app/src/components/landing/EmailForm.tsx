'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface EmailFormProps {
  onSuccess?: (data: { email: string; domain: string; scanId: string }) => void
}

export function EmailForm({ onSuccess }: EmailFormProps) {
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    // Clean domain (remove protocol if present)
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/\/$/, '')

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), domain: cleanDomain }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong')
      }

      setStatus('success')
      onSuccess?.({ email, domain: cleanDomain, scanId: data.scanId })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  if (status === 'success') {
    return (
      <div className="w-full">
        <div className="card text-center">
          <div className="text-[var(--green)] text-2xl mb-2">✓</div>
          <h3 className="text-lg font-medium mb-2">We&apos;re scanning your site</h3>
          <p className="tagline">
            We&apos;ll email you at <span className="text-[var(--text-mid)]">{email}</span> when
            your report is ready. This usually takes 2-3 minutes.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="form-container">
        <input
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={status === 'loading'}
          className="form-input"
        />
        <input
          type="text"
          placeholder="yourdomain.com"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          required
          disabled={status === 'loading'}
          className="form-input"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="form-button flex items-center justify-center gap-2"
        >
          {status === 'loading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning...
            </>
          ) : (
            'Get Free Report →'
          )}
        </button>
      </form>

      {error && (
        <p className="mt-3 text-[var(--red)] font-mono text-sm text-center">
          {error}
        </p>
      )}
    </div>
  )
}
