'use client'

/**
 * Change Password Modal (outrankllm)
 * Opened from the account dropdown in Nav.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Check, Loader2 } from 'lucide-react'

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [mounted, setMounted] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Reset the form each time the modal opens so a previous error or success
  // state doesn't linger.
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
      setSuccess(false)
      setLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen || !mounted) return null

  const minLength = newPassword.length >= 8
  const hasMatch = newPassword === confirmPassword && newPassword.length > 0
  const isValid = currentPassword.length > 0 && minLength && hasMatch

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return

    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update password')
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)
      setTimeout(onClose, 2000)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const inputClass =
    'w-full font-mono text-sm bg-transparent border border-[var(--border)] focus:border-[var(--green)] focus:outline-none transition-colors'
  const labelClass =
    'block font-mono text-xs text-[var(--text-dim)] uppercase tracking-wider'

  const modalContent = (
    <div className="fixed inset-0 overflow-y-auto" style={{ zIndex: 9999 }}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
        style={{ zIndex: 9999 }}
      />

      <div
        className="relative flex min-h-full items-center justify-center"
        style={{ padding: '24px', zIndex: 10000 }}
      >
        <div
          className="relative w-full bg-[var(--surface)] border border-[var(--border)] shadow-2xl"
          style={{ maxWidth: '440px' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between border-b border-[var(--border)]"
            style={{ padding: '16px 20px' }}
          >
            <h2 className="text-[var(--text)] font-medium">Change Password</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {success ? (
            <div className="text-center" style={{ padding: '48px 24px' }}>
              <div
                className="inline-flex items-center justify-center bg-[var(--green)] text-[var(--bg)]"
                style={{ width: '48px', height: '48px', borderRadius: '50%', marginBottom: '16px' }}
              >
                <Check size={24} />
              </div>
              <h3 className="text-[var(--text)] font-medium" style={{ marginBottom: '8px' }}>
                Password updated
              </h3>
              <p className="text-[var(--text-dim)] text-sm">
                Use your new password next time you sign in.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label className={labelClass} style={{ marginBottom: '8px' }}>
                    Current Password
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className={inputClass}
                    style={{ padding: '12px 16px' }}
                    placeholder="Enter your current password"
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelClass} style={{ marginBottom: '8px' }}>
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className={inputClass}
                    style={{ padding: '12px 16px' }}
                    placeholder="At least 8 characters"
                    required
                    minLength={8}
                  />
                  <div
                    className="flex items-center gap-2 text-xs font-mono"
                    style={{ marginTop: '8px' }}
                  >
                    <Check
                      className={`w-3 h-3 ${minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}`}
                    />
                    <span className={minLength ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'}>
                      At least 8 characters
                    </span>
                  </div>
                </div>

                <div>
                  <label className={labelClass} style={{ marginBottom: '8px' }}>
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    style={{ padding: '12px 16px' }}
                    placeholder="Re-enter your new password"
                    required
                    minLength={8}
                  />
                  {confirmPassword.length > 0 && (
                    <div
                      className="flex items-center gap-2 text-xs font-mono"
                      style={{ marginTop: '8px' }}
                    >
                      <Check className={`w-3 h-3 ${hasMatch ? 'text-[var(--green)]' : 'text-red-400'}`} />
                      <span className={hasMatch ? 'text-[var(--green)]' : 'text-red-400'}>
                        {hasMatch ? 'Passwords match' : 'Passwords do not match'}
                      </span>
                    </div>
                  )}
                </div>

                {error && (
                  <div
                    className="text-red-400 text-sm font-mono text-center"
                    style={{
                      padding: '12px',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                    }}
                  >
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!isValid || loading}
                  className="w-full bg-[var(--green)] text-[var(--bg)] font-mono text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ padding: '14px' }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
