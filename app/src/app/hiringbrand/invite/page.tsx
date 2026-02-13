'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const hb = {
  teal: '#4ABDAC',
  tealDeep: '#2D8A7C',
  tealLight: '#E8F7F5',
  coral: '#FC4A1A',
  coralLight: '#FFF0EC',
  gold: '#F7B733',
  slate: '#1E293B',
  slateMid: '#475569',
  slateLight: '#94A3B8',
  surface: '#FFFFFF',
  surfaceDim: '#F1F5F9',
  error: '#EF4444',
}

const fonts = {
  display: "'Outfit', system-ui, sans-serif",
  body: "'Source Sans 3', system-ui, sans-serif",
}

interface InviteInfo {
  email: string
  organizationName: string
  role: string
  expired: boolean
  alreadyAccepted: boolean
}

function InviteContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get('token')

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null)
  const [infoLoading, setInfoLoading] = useState(true)
  const [infoError, setInfoError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Fetch invite info
  useEffect(() => {
    if (!token) {
      setInfoError('No invite token provided')
      setInfoLoading(false)
      return
    }

    fetch(`/api/hiringbrand/auth/invite-info?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setInfoError(data.error)
        } else {
          setInviteInfo(data)
        }
      })
      .catch(() => setInfoError('Failed to load invite'))
      .finally(() => setInfoLoading(false))
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (password !== confirmPassword) {
      setSubmitError('Passwords do not match')
      return
    }

    setSubmitLoading(true)

    try {
      const res = await fetch('/api/hiringbrand/auth/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, name, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || 'Failed to accept invite')
        setSubmitLoading(false)
        return
      }

      router.push('/hiringbrand/account')
    } catch {
      setSubmitError('Network error. Please try again.')
      setSubmitLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: '15px',
    fontFamily: fonts.body,
    border: `1px solid ${hb.slateLight}40`,
    borderRadius: '10px',
    outline: 'none',
    boxSizing: 'border-box',
    color: hb.slate,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 600,
    color: hb.slateMid,
    marginBottom: '6px',
    fontFamily: fonts.body,
  }

  // Loading
  if (infoLoading) {
    return (
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p style={{ color: hb.slateMid, fontSize: '15px' }}>Loading invite...</p>
      </div>
    )
  }

  // Error
  if (infoError || !inviteInfo) {
    return (
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: hb.coralLight,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}
        >
          <span style={{ fontSize: '28px', color: hb.coral }}>!</span>
        </div>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: hb.slate,
            fontFamily: fonts.display,
            marginBottom: '8px',
          }}
        >
          Invalid Invite
        </h2>
        <p style={{ fontSize: '15px', color: hb.slateMid, marginBottom: '24px' }}>
          {infoError || 'This invite link is not valid.'}
        </p>
        <Link
          href="/hiringbrand/login"
          style={{ color: hb.tealDeep, fontWeight: 500, textDecoration: 'none' }}
        >
          Go to Login
        </Link>
      </div>
    )
  }

  // Expired
  if (inviteInfo.expired) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: hb.slate,
            fontFamily: fonts.display,
            marginBottom: '8px',
          }}
        >
          Invite Expired
        </h2>
        <p style={{ fontSize: '15px', color: hb.slateMid, marginBottom: '24px' }}>
          This invite has expired. Please ask your admin to send a new one.
        </p>
      </div>
    )
  }

  // Already accepted
  if (inviteInfo.alreadyAccepted) {
    return (
      <div style={{ textAlign: 'center' }}>
        <h2
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: hb.slate,
            fontFamily: fonts.display,
            marginBottom: '8px',
          }}
        >
          Invite Already Used
        </h2>
        <p style={{ fontSize: '15px', color: hb.slateMid, marginBottom: '24px' }}>
          This invite has already been accepted.
        </p>
        <Link
          href="/hiringbrand/login"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: hb.coral,
            color: 'white',
            textDecoration: 'none',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '15px',
          }}
        >
          Go to Login
        </Link>
      </div>
    )
  }

  // Accept invite form
  return (
    <div>
      <h1
        style={{
          fontSize: '28px',
          fontWeight: 700,
          color: hb.slate,
          fontFamily: fonts.display,
          marginBottom: '8px',
          textAlign: 'center',
        }}
      >
        Join {inviteInfo.organizationName}
      </h1>
      <p
        style={{
          fontSize: '15px',
          color: hb.slateMid,
          marginBottom: '32px',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        You&apos;ve been invited as {inviteInfo.role === 'admin' ? 'an' : 'a'}{' '}
        <strong style={{ color: hb.slate }}>{inviteInfo.role}</strong>.
        Create your account to access the team&apos;s employer brand reports.
      </p>

      {/* Email display */}
      <div
        style={{
          background: hb.tealLight,
          borderRadius: '10px',
          padding: '12px 16px',
          marginBottom: '24px',
          fontSize: '14px',
          color: hb.tealDeep,
          fontWeight: 500,
        }}
      >
        Invite for: {inviteInfo.email}
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Your Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            required
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '16px' }}>
          <label style={labelStyle}>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a password (8+ characters)"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '24px' }}>
          <label style={labelStyle}>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            required
            minLength={8}
            style={inputStyle}
          />
        </div>

        {submitError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              background: hb.coralLight,
              color: hb.error,
              fontSize: '14px',
              marginBottom: '20px',
            }}
          >
            {submitError}
          </div>
        )}

        <button
          type="submit"
          disabled={submitLoading}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 600,
            fontFamily: fonts.display,
            background: submitLoading ? hb.slateLight : hb.coral,
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: submitLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {submitLoading ? 'Creating account...' : 'Accept & Join'}
        </button>
      </form>
    </div>
  )
}

export default function HiringBrandInvitePage() {
  return (
    <div style={{ minHeight: '100vh', background: hb.surfaceDim }}>
      {/* Nav */}
      <nav
        style={{
          background: hb.teal,
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Link
          href="/hiringbrand"
          style={{
            fontSize: '24px',
            fontWeight: 700,
            color: 'white',
            textDecoration: 'none',
            fontFamily: fonts.display,
          }}
        >
          hiring<span style={{ fontWeight: 800 }}>brand</span>
          <span style={{ color: hb.gold }}>.io</span>
        </Link>
      </nav>

      {/* Main */}
      <main
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 'calc(100vh - 64px)',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            background: 'white',
            borderRadius: '24px',
            padding: '48px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', padding: '40px', color: hb.slateMid }}>
                Loading...
              </div>
            }
          >
            <InviteContent />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: hb.slateLight,
        }}
      >
        &copy; {new Date().getFullYear()} HiringBrand.io
      </footer>
    </div>
  )
}
