'use client'

import { useState } from 'react'
import { Loader2, Eye, EyeOff, Check } from 'lucide-react'

interface SetPasswordFormProps {
  sessionId: string
  email: string
  onSuccess: () => void
}

export function SetPasswordForm({ sessionId, email, onSuccess }: SetPasswordFormProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const minLength = password.length >= 8
  const hasMatch = password === confirmPassword && password.length > 0
  const isValid = minLength && hasMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isValid) {
      setError('Please fix the errors above')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to set password')
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Email display (read-only) */}
      <div>
        <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
          Email
        </label>
        <div className="font-mono text-[var(--text-mid)]" style={{ padding: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {email}
        </div>
      </div>

      {/* Password input */}
      <div>
        <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
          Create Password
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors"
            style={{ padding: '12px 48px 12px 16px' }}
            placeholder="Enter password"
            required
            minLength={8}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono" style={{ marginTop: '8px' }}>
          <Check className={`w-3 h-3 ${minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`} />
          <span className={minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}>
            At least 8 characters
          </span>
        </div>
      </div>

      {/* Confirm password input */}
      <div>
        <label className="block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider" style={{ marginBottom: '8px' }}>
          Confirm Password
        </label>
        <input
          type={showPassword ? 'text' : 'password'}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors"
          style={{ padding: '12px 16px' }}
          placeholder="Confirm password"
          required
        />
        {confirmPassword.length > 0 && (
          <div className="flex items-center gap-2 text-xs font-mono" style={{ marginTop: '8px' }}>
            <Check className={`w-3 h-3 ${hasMatch ? 'text-[var(--green)]' : 'text-red-400'}`} />
            <span className={hasMatch ? 'text-[var(--green)]' : 'text-red-400'}>
              {hasMatch ? 'Passwords match' : 'Passwords do not match'}
            </span>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="text-red-400 text-sm font-mono text-center" style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          {error}
        </div>
      )}

      {/* Submit button */}
      <button
        type="submit"
        disabled={!isValid || loading}
        className="w-full bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ padding: '16px' }}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Creating Account...
          </span>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  )
}
