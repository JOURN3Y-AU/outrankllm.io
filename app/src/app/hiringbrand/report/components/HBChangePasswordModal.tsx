'use client'

/**
 * HiringBrand Change Password Modal
 * Opened from the account dropdown in HBNav.
 */

import { useState, useEffect } from 'react'
import { hbColors, hbFonts } from './shared/constants'

interface HBChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HBChangePasswordModal({ isOpen, onClose }: HBChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset the form each time the modal is opened so a previous error or
  // success state doesn't linger.
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

  if (!isOpen) return null

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: hbFonts.body,
    border: `1px solid ${hbColors.slateLight}40`,
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    color: hbColors.slate,
    background: 'white',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: hbColors.slateMid,
    marginBottom: '6px',
    fontFamily: hbFonts.body,
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'rgba(30, 41, 59, 0.5)',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '420px',
          background: hbColors.surface,
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2)',
        }}
      >
        {success ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <h2
              style={{
                fontSize: '22px',
                fontWeight: 700,
                color: hbColors.slate,
                fontFamily: hbFonts.display,
                marginBottom: '8px',
              }}
            >
              Password updated
            </h2>
            <p style={{ fontSize: '15px', color: hbColors.slateMid, fontFamily: hbFonts.body }}>
              Use your new password next time you sign in.
            </p>
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '24px',
              }}
            >
              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 700,
                  color: hbColors.slate,
                  fontFamily: hbFonts.display,
                  margin: 0,
                }}
              >
                Change password
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: hbColors.slateLight,
                  fontSize: '22px',
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>Current Password</label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  required
                  autoFocus
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = hbColors.teal }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = `${hbColors.slateLight}40` }}
                />
              </div>

              <div style={{ marginBottom: '18px' }}>
                <label style={labelStyle}>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  required
                  minLength={8}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = hbColors.teal }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = `${hbColors.slateLight}40` }}
                />
                {newPassword.length > 0 && !minLength && (
                  <p style={{ fontSize: '13px', color: hbColors.error, marginTop: '6px' }}>
                    At least 8 characters
                  </p>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={labelStyle}>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter your new password"
                  required
                  minLength={8}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = hbColors.teal }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = `${hbColors.slateLight}40` }}
                />
                {confirmPassword.length > 0 && !hasMatch && (
                  <p style={{ fontSize: '13px', color: hbColors.error, marginTop: '6px' }}>
                    Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: hbColors.coralLight,
                    color: hbColors.error,
                    fontSize: '14px',
                    marginBottom: '20px',
                    fontFamily: hbFonts.body,
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!isValid || loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: hbFonts.display,
                  background: !isValid || loading ? hbColors.slateLight : hbColors.coral,
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: !isValid || loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
