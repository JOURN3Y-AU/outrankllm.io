'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, Loader2, ArrowRight, Sparkles, Building2, Users, Globe } from 'lucide-react'

// HiringBrand CSS variables
const hbStyles = {
  '--hb-teal': '#4ABDAC',
  '--hb-teal-deep': '#2D8A7C',
  '--hb-teal-light': '#E8F7F5',
  '--hb-coral': '#FC4A1A',
  '--hb-coral-light': '#FFF0EC',
  '--hb-gold': '#F7B733',
  '--hb-slate': '#1E293B',
  '--hb-slate-mid': '#475569',
  '--hb-slate-light': '#94A3B8',
  '--hb-surface': '#FFFFFF',
  '--hb-surface-dim': '#F1F5F9',
} as React.CSSProperties

type PageStatus = 'loading' | 'success' | 'error'

interface OrgData {
  name: string
  tier: string
  domain: string
}

function SuccessContent() {
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [orgData, setOrgData] = useState<OrgData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const orgId = searchParams.get('org')

    if (!orgId) {
      // No org ID - still show success but generic message
      setTimeout(() => {
        setStatus('success')
      }, 2000)
      return
    }

    // Verify the organization was set up correctly
    const verifyOrg = async () => {
      try {
        const res = await fetch(`/api/hiringbrand/verify-org?org=${orgId}`)
        const data = await res.json()

        if (!res.ok) {
          throw new Error(data.error || 'Failed to verify organization')
        }

        setOrgData({
          name: data.name,
          tier: data.tier,
          domain: data.domain,
        })
        setStatus('success')
      } catch (err) {
        console.error('Verification error:', err)
        // Even on error, show success - webhook may still be processing
        setStatus('success')
      }
    }

    // Wait for webhook to process
    setTimeout(verifyOrg, 3000)
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div style={{ textAlign: 'center' }}>
        <Loader2
          size={48}
          className="animate-spin"
          style={{ color: 'var(--hb-teal)', margin: '0 auto 24px' }}
        />
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--hb-slate)',
            marginBottom: '12px',
            fontFamily: 'var(--font-outfit)',
          }}
        >
          Setting up your account...
        </h1>
        <p style={{ color: 'var(--hb-slate-mid)', fontSize: '15px' }}>
          Please wait while we activate your subscription.
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'var(--hb-coral-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px',
          }}
        >
          <span style={{ fontSize: '28px', color: 'var(--hb-coral)' }}>!</span>
        </div>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--hb-slate)',
            marginBottom: '12px',
            fontFamily: 'var(--font-outfit)',
          }}
        >
          Something went wrong
        </h1>
        <p style={{ color: 'var(--hb-slate-mid)', fontSize: '15px', marginBottom: '24px' }}>
          {error || 'We couldn\'t verify your subscription. Please contact support.'}
        </p>
        <a
          href="mailto:support@hiringbrand.io"
          style={{
            color: 'var(--hb-teal)',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Contact Support →
        </a>
      </div>
    )
  }

  // Success state
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--hb-teal-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}
      >
        <CheckCircle size={40} style={{ color: 'var(--hb-teal)' }} />
      </div>

      <h1
        style={{
          fontSize: '32px',
          fontWeight: 700,
          color: 'var(--hb-slate)',
          marginBottom: '12px',
          fontFamily: 'var(--font-outfit)',
        }}
      >
        Welcome to HiringBrand!
      </h1>
      <p style={{ color: 'var(--hb-slate-mid)', fontSize: '16px', marginBottom: '32px' }}>
        {orgData
          ? `Your organization "${orgData.name}" is ready.`
          : 'Your subscription has been activated.'}
      </p>

      {/* Summary card */}
      {orgData && (
        <div
          style={{
            background: 'var(--hb-surface-dim)',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '32px',
            textAlign: 'left',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--hb-teal)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Building2 size={20} style={{ color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--hb-slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Organization
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--hb-slate)' }}>
                  {orgData.name}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--hb-gold)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Users size={20} style={{ color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--hb-slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Plan
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--hb-slate)' }}>
                  {orgData.tier === 'brand' ? 'Brand' :
                   orgData.tier === 'agency_10' ? 'Agency 10' :
                   orgData.tier === 'agency_20' ? 'Agency 20' : orgData.tier}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'var(--hb-teal-deep)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Globe size={20} style={{ color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--hb-slate-light)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  First Employer
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--hb-slate)' }}>
                  {orgData.domain}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* What's next */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--hb-teal-light) 0%, white 100%)',
          border: '1px solid var(--hb-teal-light)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '32px',
          textAlign: 'left',
        }}
      >
        <h2
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--hb-teal-deep)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Sparkles size={16} />
          What happens next
        </h2>
        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            'Your first employer scan is starting now',
            'Full report ready in ~15 minutes',
            'Weekly monitoring will begin automatically',
            'Add competitors and team members anytime',
          ].map((item, i) => (
            <li
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                color: 'var(--hb-slate-mid)',
              }}
            >
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: 'var(--hb-teal)',
                }}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* CTA */}
      <Link
        href={orgData ? `/hiringbrand/login?setup=${searchParams.get('org')}` : '/hiringbrand/login'}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '16px 32px',
          fontSize: '16px',
          fontWeight: 600,
          background: 'var(--hb-coral)',
          color: 'white',
          border: 'none',
          borderRadius: '12px',
          textDecoration: 'none',
          transition: 'transform 0.1s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.boxShadow = '0 6px 20px rgba(252, 74, 26, 0.35)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.boxShadow = 'none'
        }}
      >
        Set Up Your Password
        <ArrowRight size={18} />
      </Link>

      <p style={{ marginTop: '16px', fontSize: '13px', color: 'var(--hb-slate-light)' }}>
        Check your email for a confirmation and setup instructions.
      </p>
    </div>
  )
}

export default function HiringBrandSuccessPage() {
  return (
    <div style={{ ...hbStyles, minHeight: '100vh', background: 'var(--hb-surface-dim)' }}>
      {/* Nav */}
      <nav
        style={{
          background: 'var(--hb-teal)',
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
            fontFamily: 'var(--font-outfit)',
          }}
        >
          hiring<span style={{ fontWeight: 800 }}>brand</span>
          <span style={{ color: 'var(--hb-gold)' }}>.io</span>
        </Link>
      </nav>

      {/* Main content */}
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
            maxWidth: '520px',
            background: 'white',
            borderRadius: '24px',
            padding: '48px',
            boxShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
          }}
        >
          <Suspense
            fallback={
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Loader2 size={32} className="animate-spin" style={{ color: 'var(--hb-teal)', margin: '0 auto' }} />
              </div>
            }
          >
            <SuccessContent />
          </Suspense>
        </div>
      </main>

      {/* Footer */}
      <footer
        style={{
          textAlign: 'center',
          padding: '24px',
          fontSize: '13px',
          color: 'var(--hb-slate-light)',
        }}
      >
        © {new Date().getFullYear()} HiringBrand.io • AI Employer Reputation Intelligence
      </footer>
    </div>
  )
}
