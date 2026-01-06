'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ScanProgressModal } from './ScanProgressModal'

interface EmailFormProps {
  onSuccess?: (data: { email: string; domain: string; scanId: string }) => void
}

export function EmailForm({ onSuccess }: EmailFormProps) {
  const [email, setEmail] = useState('')
  const [domain, setDomain] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [scanId, setScanId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [cleanedDomain, setCleanedDomain] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('loading')
    setError(null)

    // Clean domain (remove protocol if present)
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\/$/, '')
    setCleanedDomain(cleanDomain)

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

      setScanId(data.scanId)
      setShowModal(true)
      setStatus('success')
      onSuccess?.({ email: email.trim(), domain: cleanDomain, scanId: data.scanId })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const handleModalClose = () => {
    setShowModal(false)
    // Reset form for another scan
    setEmail('')
    setDomain('')
    setStatus('idle')
    setScanId(null)
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
              Starting...
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

      {/* Progress Modal */}
      {scanId && (
        <ScanProgressModal
          scanId={scanId}
          domain={cleanedDomain}
          email={email.trim()}
          isOpen={showModal}
          onClose={handleModalClose}
        />
      )}
    </div>
  )
}
